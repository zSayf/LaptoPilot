import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Chat, ChatMessage, Laptop, AppState, GroundingSource, RecommendationArgs, Country, CompatibleModel } from './types';
import { getLaptopRecommendations, generateLaptopImage, analyzeBestFeatures, validateApiKey, getAiInstance, listCompatibleModels, getDefaultCompatibleModels, resetQuotaExhaustedFlag } from './services/geminiService';
import { getSelectedModel, setSelectedModel, hydrateModelSelection } from './services/modelStore';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import RecommendationsDisplay from './components/RecommendationsDisplay';
import ModelSelector from './components/ModelSelector';
import { COUNTRIES } from './constants';
import { CountryIcon, MoneyIcon, ErrorIcon, KeyIcon } from './components/icons';

type Direction = 'ltr' | 'rtl';

interface ErrorNotificationProps {
  message: string | null;
  onDismiss: () => void;
  /** When provided, renders a Retry button (ported from origin/main). */
  onRetry?: () => void;
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({ message, onDismiss, onRetry }) => {
  if (!message) return null;

  return (
    <div 
        className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 bg-red-600 border border-red-700 text-white rounded-lg shadow-2xl z-50 flex items-start justify-between animate-fade-in-down" 
        role="alert"
    >
      <div className="flex items-start">
        <ErrorIcon className="w-6 h-6 mr-3 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-medium">{message}</p>
      </div>
      <div className="flex items-center space-x-2 flex-shrink-0 ms-4">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-xs font-bold uppercase rounded-md bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Retry"
          >
            Retry
          </button>
        )}
        <button onClick={onDismiss} className="-mt-1 -me-1 p-1 rounded-full hover:bg-red-700 transition-colors" aria-label="Dismiss">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('apiKeySetup');
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [budget, setBudget] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('');
  const [direction, setDirection] = useState<Direction>('ltr');
  const [budgetConfig, setBudgetConfig] = useState<{min: number; max: number; step: number} | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [recommendations, setRecommendations] = useState<Laptop[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [favorites, setFavorites] = useState<Laptop[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [models, setModels] = useState<CompatibleModel[]>([]);
  const [selectedModel, setSelected] = useState<string>(() => getSelectedModel());
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);
  const [modelNotice, setModelNotice] = useState<string | null>(null);

  const userArgs = useRef<RecommendationArgs | null>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  // Remembers which screen the user came from before opening the model picker.
  const returnStateRef = useRef<AppState>('welcome');
  // Holds a retry callback for the most recent retryable failure, so the error
  // banner can offer a Retry button (ported from origin/main).
  const retryAction = useRef<(() => void) | null>(null);

  // ---- Cancellation / staleness bookkeeping -------------------------------
  // Everything below talks to Gemini over a link that can take tens of seconds
  // (retry + exponential backoff + fallback-chain walk), and none of the SDK
  // calls accept an AbortSignal. So in-flight work is made harmless by
  // generation counters rather than by cancelling promises: a counter is
  // bumped whenever the user abandons a session, and every async path snapshots
  // it before its first await and bails out if it has moved on.

  // Bumped by "Start Over", "Change API Key" and by every keystroke in the key
  // box. An in-flight search or conversation that resolves against an old value
  // belongs to a session that no longer exists, so it must not write state.
  const requestGenerationRef = useRef<number>(0);
  // The key currently in the input box, mirrored into a ref. Async
  // continuations need to answer "is the key I started with still the current
  // one?" and React state cannot answer that from a microtask: the commit that
  // would apply it hasn't happened yet.
  const currentApiKeyRef = useRef<string>('');
  // Set synchronously when the conversation bootstrap is issued, cleared when
  // it settles or is abandoned. The `!chat` guard looked equivalent but is not
  // atomic - `chat` is only assigned several awaits later, so an effect re-run
  // inside that window fired a second opening generateContent for the same turn.
  const conversationStartedRef = useRef<boolean>(false);
  // Bumped by the conversation bootstrap right after it installs the discovery
  // chat, to force the results effect to (re)build the results-context chat
  // afterwards. See the comment at its call site for why the write order must
  // not be left to React's batching schedule.
  const [resultsChatNonce, setResultsChatNonce] = useState<number>(0);

  const isEgypt = country === 'Egypt';

  // Load API key from localStorage on component mount
  useEffect(() => {
    hydrateModelSelection();
    setSelected(getSelectedModel());

    const savedApiKey = localStorage.getItem('geminiApiKey');
    if (!savedApiKey) return;

    setApiKey(savedApiKey);
    currentApiKeyRef.current = savedApiKey;

    // `validateApiKey` walks the whole fallback chain with retry + backoff and
    // can run for a long time, so its result needs two guards before it is
    // allowed to decide the fate of the app:
    //   * `cancelled` covers unmount (and StrictMode's intentional double-invoke).
    //   * the key comparison covers the user typing, or submitting, a different
    //     key while this one is still being checked. Without it the late result
    //     for the *old* key would call setIsApiKeyValid(false) and tear down a
    //     session that is now running on a perfectly good new key.
    let cancelled = false;
    const isStale = () => cancelled || currentApiKeyRef.current !== savedApiKey;

    // Validate the saved API key
    validateApiKey(savedApiKey).then(check => {
        if (isStale()) return;
        if (check.valid) {
          setIsApiKeyValid(true);
          setAppState('welcome'); // Skip API key setup if key is valid
        } else if (check.reason === 'model') {
          // The key authenticated fine; the models this app tried are simply not
          // available on it. Blocking with "invalid key" would be wrong and
          // offers the user nothing they can act on.
          setIsApiKeyValid(true);
          setAppState('welcome');
          setError(
            "Your key works, but none of the models this app tried are available on it. Pick a different model, or use a key with access to Gemini 3."
          );
        } else if (check.transient) {
          // Google's servers are overloaded, not the user's key. Blocking here
          // would lock someone out over a capacity blip, so let them proceed -
          // a genuinely bad key fails fast with 400 and is caught below.
          setIsApiKeyValid(true);
          setAppState('welcome');
          setError(
            "Google's servers are busy right now, so your key couldn't be verified. You can continue, but requests may fail until it recovers."
          );
        } else {
          setIsApiKeyValid(false);
          setAppState('welcome'); // Still go to welcome page but show option to change key
          setError(
            "Your saved API key appears to be invalid. You can change it using the 'Change API Key' button."
          );
        }
      }).catch(err => {
        console.error("Error validating saved API key:", err);
        // If validation fails, we'll still go to welcome page but show option to change key
        if (isStale()) return;
        setIsApiKeyValid(false);
        setAppState('welcome');
        setError("There was an error validating your saved API key. You can change it using the 'Change API Key' button.");
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
    // index.html hardcodes lang="en". Without this, screen readers announce the
    // Arabic UI with English pronunciation.
    document.documentElement.lang = direction === 'rtl' ? 'ar' : 'en';
  }, [direction]);

  useEffect(() => {
    if (appState === 'results') {
      setTimeout(() => {
        mainContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [appState]);

  // Fetch every model this key can use, filtered to the ones that can actually
  // run this app. Re-runs whenever the key changes.
  const loadModels = useCallback(async (key: string) => {
    if (!key) return;
    setModelsLoading(true);
    setModelNotice(null);
    try {
      const found = await listCompatibleModels(key);

      // If the catalogue can't be fetched (rate limited / offline), fall back to
      // the built-in chain so the picker is never empty and unusable.
      const usable = found.length ? found : getDefaultCompatibleModels();
      setModels(usable);

      // A previously saved model may not be available on this key (different
      // tier, retired, or outside the key's region) - fall back to the best one.
      if (usable.length && !usable.some(m => m.id === getSelectedModel())) {
        const best = usable[0];
        setSelectedModel(best.id, usable);
        setSelected(best.id);
        setModelNotice(
          isEgypt
            ? `النموذج السابق غير متاح لهذا المفتاح. تم التبديل إلى ${best.displayName}.`
            : `Your previous model isn't available on this key. Switched to ${best.displayName}.`
        );
      }
    } catch (err) {
      console.error('Failed to list models:', err);
      // Keep the picker usable even when the catalogue request fails outright.
      setModels(getDefaultCompatibleModels());
      setModelNotice(
        isEgypt
          ? 'تعذر جلب قائمة النماذج. يتم عرض النماذج الافتراضية.'
          : "Couldn't fetch the model list. Showing the default models."
      );
    } finally {
      setModelsLoading(false);
    }
  }, [isEgypt]);

  // Fetch the compatible model list once we have a *validated* key.
  //
  // Deliberately not keyed on `apiKey` directly: that state updates on every
  // keystroke, so a dependency on it fired a full paginated models.list() per
  // character typed - dozens of wasted requests against a quota that is
  // already the bottleneck. `isApiKeyValid` flips once, on submit or restore.
  useEffect(() => {
    if (apiKey && isApiKeyValid) loadModels(apiKey);
  }, [apiKey, isApiKeyValid, loadModels]);

  /**
   * Save the user's model choice.
   *
   * Deliberately makes NO API call. An earlier version ran a capability probe on
   * every change, which cost 1-2 requests each time - enough to burn through the
   * 250 requests/day free-tier quota just by clicking around the dropdown. If a
   * picked model genuinely cannot do grounding, the fallback chain absorbs the
   * failure at call time for free and the search still succeeds.
   */
  const handleModelSelect = useCallback((id: string) => {
    if (id === getSelectedModel()) return;
    setSelectedModel(id, models);
    setSelected(id);
    setModelNotice(null);
  }, [models]);

  const handleChangeModel = () => {
    returnStateRef.current = appState;
    setAppState('modelSelect');
  };

  const handleDismissError = () => {
    setError(null);
    retryAction.current = null;
  };

  const handleRetry = () => {
    const actionToRetry = retryAction.current;
    handleDismissError();
    if (actionToRetry) actionToRetry();
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    // Mirror the key for the staleness checks in async continuations, and
    // invalidate the current session: any request still in flight was made with
    // a different key, so it no longer has the right to write results.
    currentApiKeyRef.current = e.target.value;
    requestGenerationRef.current += 1;
    setIsApiKeyValid(false); // Reset validation when user types
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your Gemini API key");
      return;
    }

    // Snapshot the session generation: validation is slow, and a result that
    // arrives after the user has started editing the key again must not drag
    // them onto the welcome screen with a key they didn't submit.
    const generation = requestGenerationRef.current;
    const submittedKey = apiKey;

    setLoadingMessage('Validating API key...');
    try {
      const check = await validateApiKey(submittedKey);
      if (generation !== requestGenerationRef.current) return;
      if (check.valid) {
        setIsApiKeyValid(true);
        // Save to localStorage
        localStorage.setItem('geminiApiKey', submittedKey);
        setAppState('welcome');
        setError(null);
      } else if (check.reason === 'model') {
        // Key is fine, the models aren't. Don't blame the key.
        setIsApiKeyValid(true);
        localStorage.setItem('geminiApiKey', submittedKey);
        setAppState('welcome');
        setError(
          "Your key works, but none of the models this app tried are available on it. You can pick a different model."
        );
      } else if (check.transient) {
        // Overload, not a bad key - accept it so the user isn't locked out.
        setIsApiKeyValid(true);
        localStorage.setItem('geminiApiKey', submittedKey);
        setAppState('welcome');
        setError(
          "Google's servers are busy right now, so the key couldn't be verified. Continuing, but requests may fail until it recovers."
        );
      } else {
        setIsApiKeyValid(false);
        setError("Invalid API key. Please check your key and try again.");
      }
      // A key that failed on a busy API is worth retrying.
      retryAction.current = check.valid || check.transient ? handleApiKeySubmit : null;
    } catch (err) {
      if (generation !== requestGenerationRef.current) return;
      setError("Error validating API key. Please try again.");
      console.error("API key validation error:", err);
    } finally {
      // Always cleared: this label doubles as the submit button's disabled
      // state, so a stale string here would permanently lock the button.
      setLoadingMessage('');
    }
  };

  const handleCountryChange = (selectedCountryName: string) => {
    const selectedCountry = COUNTRIES.find(c => c.name === selectedCountryName);
    if (selectedCountry) {
        setCountry(selectedCountry.name);
        setCurrency(selectedCountry.currency);
        setDirection(selectedCountry.code === 'EG' || selectedCountry.code === 'SA' || selectedCountry.code === 'AE' ? 'rtl' : 'ltr');
        const config = { min: selectedCountry.budgetMin, max: selectedCountry.budgetMax, step: selectedCountry.budgetStep };
        setBudgetConfig(config);
        setBudget(config.min + (config.max - config.min) / 4);
        setError(null);
    } else {
        setCountry('');
        setCurrency('');
        setDirection('ltr');
        setBudgetConfig(null);
        setBudget(0);
    }
  };

  const handleStartChat = () => {
    if (!country) {
        const errorMessage = isEgypt ? "برجاء اختيار بلد للبدء." : "Please select a country to begin.";
        setError(errorMessage);
        return;
    }
    // Without a verified key the conversation effect below is skipped, which
    // previously dumped the user into an empty, unresponsive chat screen with no
    // explanation and no way forward. Fail loudly and route them back.
    if (!isApiKeyValid) {
        setError(
            isEgypt
                ? 'مفتاح الـ API غير صالح. برجاء إدخال مفتاح صحيح للبدء.'
                : 'Your API key could not be verified. Please enter a working key to start.'
        );
        setAppState('apiKeySetup');
        return;
    }
    // A new conversation: release the in-flight guard so the bootstrap effect
    // is allowed to fire, and start a fresh generation so a previous session's
    // stragglers can't interfere with this one.
    conversationStartedRef.current = false;
    requestGenerationRef.current += 1;
    setError(null);
    setAppState('chatting');
  };

  // Add a helper function to handle function calls
  const handleFunctionCall = async (match: RegExpMatchArray, responseText: string, functionCallRegex: RegExp) => {
    // Snapshot the session generation *before* the first await. Everything below
    // is multi-request work (search + feature analysis + one image per laptop),
    // so there is a wide window in which the user can hit "Start Over" or swap
    // the API key. Without this check the search would resume afterwards and
    // call setAppState('results'), yanking the user back into a search they had
    // already abandoned.
    const generation = requestGenerationRef.current;
    const isStale = () => generation !== requestGenerationRef.current;

    // Extract function call parameters
    const paramsString = match[1];
    const paramRegex = /(\w+)=["']([^"']*)["']/g;
    const params: Record<string, string> = {};
    let paramMatch;
    
    while ((paramMatch = paramRegex.exec(paramsString)) !== null) {
      params[paramMatch[1]] = paramMatch[2];
    }
    
    // Extract budget value and currency.
    //
    // This must fall back to the budget/currency the user already chose on the
    // welcome screen. The old regex had no fallback and mis-parsed ordinary
    // formatting: "3,000 USD" matched at the "000" (commas aren't \w) and
    // yielded budget 0, so the search ran against a zero budget and silently
    // returned the cheapest laptops or nothing.
    let budgetValue = 0;
    let currencyValue = '';
    if (params.budget) {
      // Strip thousands separators and currency symbols before reading digits.
      const cleaned = params.budget.replace(/[,_\s]/g, '');
      const budgetMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]{3})?/);
      if (budgetMatch) {
        budgetValue = parseFloat(budgetMatch[1]) || 0;
        currencyValue = budgetMatch[2] ?? '';
      }
    }
    if (!budgetValue) budgetValue = budget;
    if (!currencyValue) currencyValue = currency;

    // Create recommendation args
    const recommendationArgs: RecommendationArgs = {
      country: params.country || params.location || country,
      budget: budgetValue,
      currency: currencyValue,
      primaryUse: params.primary_use || 'general',
      specificNeeds: `Usage: ${params.usage_location || 'general'}, Battery: ${params.battery_life_importance || 'not specified'}, Screen: ${params.screen_size || 'not specified'} ${params.screen_refresh_rate || ''}`
    };
    
    // Execute the function
    setLoadingMessage(isEgypt ? 'جاري البحث في الويب عن لابتوبات...' : 'Searching the web for laptops...');
    // A fresh search deserves a fresh attempt at fetching images.
    resetQuotaExhaustedFlag();
    const { laptops, sources } = await getLaptopRecommendations(recommendationArgs, apiKey);
    if (isStale()) return;
    
    // Add best features to laptops
    if (laptops.length > 0) {
      try {
        setLoadingMessage(isEgypt ? 'جاري تحليل أبرز الميزات...' : 'Analyzing best features...');
        const features = await analyzeBestFeatures(laptops, recommendationArgs, apiKey, isEgypt);
        if (isStale()) return;
        laptops.forEach((laptop, index) => {
          laptop.bestFeature = features[index];
        });
      } catch (featureError) {
        console.warn("Could not analyze best features:", featureError);
        // Set a default message for all laptops if feature analysis fails
        laptops.forEach((laptop) => {
          laptop.bestFeature = "Feature analysis could not be generated due to API limitations.";
        });
      }
      
      // Try to get images for laptops
      try {
        setLoadingMessage(isEgypt ? 'جاري جلب صور المنتجات...' : 'Fetching product images...');
        await Promise.all(laptops.map(async (laptop) => {
          const imageUrl = await generateLaptopImage(laptop.modelName, apiKey);
          if (imageUrl) {
            laptop.imageUrl = imageUrl;
          }
        }));
        if (isStale()) return;
      } catch (imageError) {
        console.warn("Could not generate laptop images:", imageError);
        // This is non-critical, so we continue without images
      }
    }
    
    // Final guard immediately before touching state.
    if (isStale()) return;

    // Update state with recommendations
    setRecommendations(laptops);
    setSources(sources);
    setAppState('results');
    
    // Add the AI response to chat history
    const aiResponseText = responseText.replace(functionCallRegex, '').trim() || 
      (isEgypt ? "تمام كده! بما إن كل حاجة مظبوطة، دلوقتي هدورلك على أفضل الترشيحات اللي تناسب كل متطلباتك وميزانيتك." : 
       "Great! Now I'll find the best laptop recommendations that match all your requirements and budget.");
    setChatHistory(prev => [...prev, { role: 'model', text: aiResponseText }]);
  };

  // Effect to start the AI conversation.
  useEffect(() => {
    const startAiConversation = async () => {
      if (appState === 'chatting' && !chat && isApiKeyValid) {
        // `!chat` on its own is not an atomic "already started" check: `chat` is
        // only assigned several awaits later, so any effect re-run inside that
        // window (a dependency changing, StrictMode's double-invoke) issued a
        // second opening generateContent for the same turn, and both runs raced
        // to overwrite the transcript. The flag is claimed synchronously, as the
        // first thing in this block, before the first await.
        if (conversationStartedRef.current) return;
        conversationStartedRef.current = true;

        // Same generation guard as the search: a session the user has abandoned
        // must not be able to drag them back to a chat or to the welcome page.
        const generation = requestGenerationRef.current;
        const isStale = () => generation !== requestGenerationRef.current;

        setLoadingMessage(isEgypt ? 'بوقظ الذكاء الاصطناعي...' : 'Waking up the AI...');
        setError(null);

        let systemInstruction: string;
        if (isEgypt) {
            systemInstruction = `You are "LaptoPilot", a friendly and expert AI assistant. You MUST communicate with the user exclusively in Egyptian Arabic. Your primary goal is to guide the user through a structured, multi-phase conversation to gather all necessary information to find the perfect laptop. The user has already set their budget to approximately ${budget} ${currency}. You MUST use this information and you MUST NOT ask for their budget again. You MUST follow these rules: 1. Follow the phases in order. Do not skip a phase. 2. Ask questions ONE AT A TIME. Do not ask multiple questions in a single message. 3. **For questions with multiple options, break them down into a series of simple 'yes' or 'no' questions. Ask about one feature at a time.** Use the following script as a strong guideline for your questions (but skip the budget question): **المرحلة الأولى: فهم الاستخدام الأساسي** 1. ابدأ بترحيب ودود ومباشر. ثم اسأل المستخدم عن استخدامه الأساسي للابتوب. * **مثال على الرسالة الأولى الممتازة:** "أهلاً بيك! عشان أساعدك تختار اللابتوب-Sah، قولي إيه استخدامك الأساسي ليه؟ (دراسة، شغل، جيمز، تصميم، أو استخدام يومي)" **المرحلة الثانية: التعمق في تفاصيل الاستخدام (أسئلة ديناميكية)** * لو جيمر: اسأل عن نوع الألعاب (تنافسية، AAA رسوميات عالية)، ثم اسأل لو يخطط للبث المباشر. * لو مبدع: اسأل عن مجاله الإبداعي (مونتاج فيديو 4K/1080p، تصميم جرافيك، 3D). * لو مبرمج: اسأل عن مهامه المتكررة (أنظمة وهمية VMs، عمل Compile لمشاريع ضخمة). **المرحلة الثالثة: أسلوب الحياة والتنقل** 1. اسأل أين سيستخدم اللابتوب أغلب الوقت (مكتب، تنقل، سفر دائم). 2. اسأل عن أهمية عمر البطارية. 3. اسأل عن حجم الشاشة المفضل. **المرحلة الرابعة: التفضيلات الشخصية والميزات الإضافية** 1. اسأل عن أولوياته في الشاشة سؤال سؤال (مثلاً: "هل معدل التحديث العالي للشاشة مهم بالنسبالك؟"). 2. اسأل عن تفضيلات الكيبورد بأسئلة نعم/لا (مثلاً: "هل محتاج لوحة أرقام Numpad في الكيبورد؟"). 3. اسأل عن المداخل (Ports) المهمة واحد واحد (مثلاً: "هل لازم يكون فيه مخرج HDMI؟"). **المرحلة الخامسة: التأكيد النهائي** 1. المستخدم في ${country} وميزانيته حوالي ${budget} ${currency}. 2. قدم ملخصًا لكل المتطلبات التي جمعتها. 3. اطلب منه التأكيد. 4. بمجرد أن يؤكد، يجب عليك استدعاء دالة \`findLaptopRecommendations\` مع كتابة الأمر كالتالي: <call:findLaptopRecommendations budget="${budget} ${currency}" location="${country}" primary_use="..." ... />. لا تقدم توصيات بنفسك.`;
        } else {
            systemInstruction = `You are "LaptoPilot", a friendly and expert AI assistant that helps users find the perfect laptop. Your primary goal is to guide the user through a structured, multi-phase conversation to gather all necessary information. The user has already set their budget to approximately ${budget} ${currency}. You MUST use this information and you MUST NOT ask for their budget again. You MUST follow these rules: 1. Follow the phases in order. Do not skip a phase. 2. Ask questions ONE AT A TIME. Do not ask multiple questions in a single message. 3. **For questions with multiple options (like display features or ports), break them down into a series of simple 'yes' or 'no' questions. Ask about one feature at a time.** **Phase 1: The Icebreaker** 1. Introduce yourself and ask for the user's primary use case (e.g., Student, Professional, Gamer, Creative, Daily Use). **Phase 2: The Deep Dive (Ask questions relevant to the user's primary use)** * **If Gamer:** Ask about the types of games they play (e.g., Competitive FPS, AAA titles). Then ask if they plan to stream. * **If Creative:** Ask about their primary creative field (e.g., Video Editing 4K/1080p, Graphic Design, 3D Modeling). * **If Programmer:** Ask about their common tasks (e.g., running Virtual Machines, compiling large projects, web development). **Phase 3: Lifestyle & Portability** 1. Ask where they will use the laptop most (e.g., at a desk, commuting, traveling). 2. Ask about the importance of battery life on a scale of 1-5. 3. Ask for their preferred screen size (e.g., 13-14", 15-16", 17"+). **Phase 4: Finishing Touches** 1. Ask about display priorities one by one (e.g., "Is a high refresh rate important for smooth motion?"). 2. Ask about keyboard preferences using yes/no questions (e.g., "Do you need a keyboard with a number pad?"). 3. Ask about essential ports one by one (e.g., "Is an HDMI port a must-have for you?"). **Phase 5: Final Confirmation** 1. The user is in ${country} with a budget of ${budget} ${currency}. 2. Provide a concise summary of all the user's requirements you have gathered. 3. Ask for their confirmation. 4. Once they confirm, you MUST call the \`findLaptopRecommendations\` function with all the collected details including the budget by writing it as: <call:findLaptopRecommendations budget="${budget} ${currency}" location="${country}" primary_use="..." ... />. Do not provide recommendations yourself. Do not end the conversation without calling the function.`;
        }

        try {
          const initialUserMessageText = isEgypt ? "أهلاً، يلا نبدأ." : "Hello, let's get started.";
          const initialUserMessage: ChatMessage = { role: 'user', text: initialUserMessageText };
          setChatHistory([initialUserMessage]);

          // Use generateContent for the first turn to establish history robustly.
          const ai = getAiInstance(apiKey);
          const firstTurnResult = await ai.models.generateContent({
              model: getSelectedModel(),
              contents: [{ role: 'user', parts: [{ text: initialUserMessageText }] }],
              config: {
                systemInstruction,
                tools: [], // We'll handle function calls differently
              },
          });

          if (firstTurnResult.text && firstTurnResult.candidates?.[0]?.content) {
              if (isStale()) return;
              const modelResponseText = firstTurnResult.text;
              const modelResponseContent = firstTurnResult.candidates[0].content;
              
              // Check if the response contains a function call
              const functionCallRegex = /<call:findLaptopRecommendations\s+([^>]*)\/>/;
              const match = modelResponseText.match(functionCallRegex);
              
              if (match) {
                // Handle function call in initial response
                await handleFunctionCall(match, modelResponseText, functionCallRegex);
                if (isStale()) return;
              } else {
                // No function call, just add the response to chat history
                setChatHistory(prev => [...prev, { role: 'model', text: modelResponseText }]);
              }

              // Now, create the chat session with the established history.
              const newChat = ai.chats.create({
                  model: getSelectedModel(),
                  config: {
                      systemInstruction,
                      tools: [], // We'll handle function calls differently
                  },
                  history: [
                      { role: 'user', parts: [{ text: initialUserMessageText }] },
                      modelResponseContent,
                  ],
              });
              setChat(newChat);

              // The write above is the *discovery* chat, whose system instruction
              // knows nothing about the laptops. When the opening turn contained
              // a function call, handleFunctionCall has already switched the app
              // to 'results' and the results effect has built a chat that does
              // list them - so if this write landed last it would wipe that
              // context and the follow-up chat would no longer know what was
              // recommended. Bumping the nonce makes the results effect rebuild
              // its chat *after* this write, deterministically instead of relying
              // on the order React happens to flush these two effects in.
              setResultsChatNonce(n => n + 1);
          } else {
              throw new Error("The AI didn't respond. Please try starting over.");
          }

        } catch (e) {
          console.error("Failed to start conversation:", e);

          // An abandoned session must not report failures into whatever the user
          // is doing now.
          if (isStale()) return;

          let apiError = '';
          if (e instanceof Error) {
              apiError = e.message;
          }
          
          let errorMessage: string;

          if (apiError.toLowerCase().includes('quota')) {
            errorMessage = isEgypt 
                ? "عذرًا، لقد استهلكت الحصة اليومية من الطلبات لهذا النموذج. جاري تجربة نموذج بديل تلقائيًا..."
                : "Sorry, you've reached the daily request limit for this model. Trying fallback models automatically...";
          } else if (apiError.toLowerCase().includes('api_key')) {
            errorMessage = isEgypt
                ? "مفتاح API غير صحيح أو مفقود. يرجى التحقق من الإعدادات."
                : "Invalid or missing API key. Please check your configuration.";
          } else {
            errorMessage = isEgypt 
                ? "حدث خطأ في الاتصال بالذكاء الاصطناعي. برجاء التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى." 
                : "There was a problem communicating with the AI. Please check your internet connection and try again.";
          }

          // Release the start-guard so the user can try again from the welcome
          // screen; the new attempt re-enters this block and re-claims it.
          conversationStartedRef.current = false;
          setError(errorMessage);
          setChatHistory([]);
          setAppState('welcome'); // Go back to welcome screen on failure
          setChat(null); // Ensure chat is reset
          // Offer a retry: the failure is usually a transient 503, not a bad setup.
          if (!isStale()) retryAction.current = startAiConversation;
        } finally {
          // Skipped when stale: whoever invalidated this session has already
          // cleared the label, and clearing it again could wipe the spinner
          // belonging to whatever the user started next.
          if (!isStale()) setLoadingMessage('');
        }
      }
    };
    startAiConversation();
  }, [appState, country, budget, currency, isEgypt, apiKey, isApiKeyValid]);

  // Effect to create the *results-context* chat session when results are
  // displayed, so follow-ups can talk about the laptops that were found.
  useEffect(() => {
    if (appState === 'results' && recommendations.length > 0 && isApiKeyValid) {
        const recommendationContext = recommendations.map((r, i) => `${i+1}. ${r.modelName} (${r.price} ${r.currency})`).join('\n');
        
        let systemInstruction: string;
        if (isEgypt) {
            systemInstruction = `أنت "LaptoPilot"، مساعد ذكاء اصطناعي خبير وودود. لقد قدمت بالفعل للمستخدم أفضل 5 ترشيحات للابتوب التالية:
${recommendationContext}

هدفك الجديد هو مساعدة المستخدم في تحليل هذه الخيارات.
- أجب على أسئلته الإضافية حول هذه اللابتوبات المحددة.
- قارن بين اللابتوبات بناءً على أسئلته (مثلاً: "أيهما أخف وزنًا؟"، "أيهما يمتلك شاشة أفضل للألعاب؟").
- إذا لم يكن المستخدم راضيًا، يمكنك بدء بحث جديد عن طريق طرح أسئلات توضيحية ثم استدعاء دالة \`findLaptopRecommendations\` مرة أخرى بالمعايير المعدلة، مع كتابة الأمر كالتالي: <call:findLaptopRecommendations budget="..." location="..." primary_use="..." ... />.
- استمر في التواصل باللغة العربية (اللهجة المصرية).`;
        } else {
            systemInstruction = `You are "LaptoPilot", a friendly and expert AI assistant. You have already provided the user with the following top 5 laptop recommendations:\n${recommendationContext}\n\nYour new goal is to help the user analyze these options. - Answer their follow-up questions about these specific laptops. - Compare the laptops based on their questions (e.g., "Which is lighter?", "Which has a better screen for gaming?"). - If the user is unsatisfied, you can start a new search by asking clarifying questions and then calling the \`findLaptopRecommendations\` function again with the refined criteria, writing it as: <call:findLaptopRecommendations budget="..." location="..." primary_use="..." ... />.`;
        }
        
        // Seed the session with the transcript the UI is already showing. It used
        // to be created empty, so every refined search threw the conversation
        // away on the floor while the messages stayed visible on screen: the
        // model then answered follow-ups ("cheaper but still a dedicated GPU?")
        // as if it had never been asked anything.
        //
        // The SDK requires history that alternates user/model and starts with a
        // user turn, so it is normalised defensively rather than risking a thrown
        // error while the user is looking at their results.
        const merged = chatHistory.reduce<ChatMessage[]>((acc, msg) => {
            if (!msg.text) return acc;
            const last = acc[acc.length - 1];
            if (last && last.role === msg.role) last.text = `${last.text}\n${msg.text}`;
            else acc.push({ role: msg.role, text: msg.text });
            return acc;
        }, []);
        const firstUserTurn = merged.findIndex(m => m.role === 'user');
        const seedHistory = firstUserTurn === -1 ? [] : merged.slice(firstUserTurn);

        const ai = getAiInstance(apiKey);
        const newChat = ai.chats.create({
            model: getSelectedModel(),
            config: {
                systemInstruction,
                tools: [], // We'll handle function calls differently
            },
            ...(seedHistory.length > 0
                ? { history: seedHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })) }
                : {}),
        });
        setChat(newChat);
    }
    // `chatHistory` is read but deliberately NOT a dependency: this effect creates
    // one session per search, so depending on the transcript would rebuild the
    // session - and drop the live conversation - on every message.
    // `resultsChatNonce` is the handle the conversation bootstrap uses to have
    // this chat rebuilt *after* it installs the discovery chat, so the
    // results-context session is always the last writer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [appState, recommendations, country, isEgypt, apiKey, isApiKeyValid, resultsChatNonce]);


  const handleSendMessage = useCallback(async (message: string) => {
    if (!chat) {
        setError(isEgypt ? "جلسة المحادثة غير مفعلة. برجاء البدء من جديد." : "Chat session not initialized. Please start over.");
        return;
    }
    const updatedHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: message }];
    setChatHistory(updatedHistory);
    setLoadingMessage(isEgypt ? 'بفكر...' : 'Thinking...');
    setError(null);

    try {
      const response = await chat.sendMessage({ message });

      if (response.text) {
        // Check if the response contains a function call
        const functionCallRegex = /<call:findLaptopRecommendations\s+([^>]*)\/>/;
        const match = response.text.match(functionCallRegex);
        
        if (match) {
          // Handle function call in response
          await handleFunctionCall(match, response.text, functionCallRegex);
        } else {
          // No function call, just add the response to chat history
          setChatHistory(prev => [...prev, { role: 'model', text: response.text }]);
        }
      } else {
        throw new Error("I received an unexpected response. Please try rephrasing your request.");
      }

    } catch (e) {
      console.error("Error during chat:", e);

      let apiError = '';
      if (e instanceof Error) {
        apiError = e.message;
      }
      
      let errorMessage: string;

      if (apiError.toLowerCase().includes('quota')) {
        errorMessage = isEgypt 
            ? "عذرًا، لقد استهلكت الحصة اليومية من الطلبات لهذا النموذج. جاري تجربة نموذج بديل تلقائيًا..."
            : "Sorry, you've reached the daily request limit for this model. Trying fallback models automatically...";
      } else if (apiError.toLowerCase().includes('api_key')) {
        errorMessage = isEgypt
            ? "مفتاح API غير صحيح أو مفقود. يرجى التحقق من الإعدادات."
            : "Invalid or missing API key. Please check your configuration.";
      } else {
          errorMessage = e instanceof Error ? e.message : (isEgypt ? 'حدث خطأ غير معروف. برجاء إعادة صياغة رسالتك أو الضغط على "ابدأ من جديد".' : 'An unknown error occurred. Please try rephrasing your message or click "Start Over".');
      }
      
      setError(errorMessage);
      // Let the user resend the message that failed.
      retryAction.current = () => handleSendMessage(message);
    } finally {
        setLoadingMessage('');
    }
  }, [chat, chatHistory, isEgypt, apiKey, country, handleFunctionCall]);
  
  const toggleFavorite = (laptop: Laptop) => {
    setFavorites(prev =>
      prev.find(fav => fav.modelName === laptop.modelName)
        ? prev.filter(fav => fav.modelName !== laptop.modelName)
        : [...prev, laptop]
    );
  };
  
  const handleReset = () => {
    // Invalidate everything that is still in flight *before* tearing state down.
    // Requests already awaiting a response would otherwise resume afterwards and
    // call setAppState('results') / setRecommendations, dragging the user straight
    // back into the search they just abandoned.
    requestGenerationRef.current += 1;
    conversationStartedRef.current = false;

    setAppState('welcome');
    setCountry('');
    setBudget(0);
    setCurrency('');
    setBudgetConfig(null);
    setDirection('ltr');
    setChatHistory([]);
    setChat(null);
    setRecommendations([]);
    setSources([]);
    // Favourites are snapshots of laptops from the abandoned search (price,
    // retailer, link) and they are matched by model name - so a later search that
    // surfaces a same-named laptop renders a filled star next to the old price
    // and a dead URL. They are part of the session, so they go with it.
    setFavorites([]);
    setError(null);
    setLoadingMessage('');
    userArgs.current = null;
  };

  const handleChangeApiKey = () => {
    // Same reason as handleReset: abandon in-flight work for the old key. The
    // loading label is cleared too, because on this screen it doubles as the
    // submit button's disabled state - a leftover "Finding the best
    // recommendations..." would leave the button permanently dead.
    requestGenerationRef.current += 1;
    conversationStartedRef.current = false;
    setAppState('apiKeySetup');
    setIsApiKeyValid(false);
    setLoadingMessage('');
  };

  const renderContent = () => {
    switch (appState) {
      case 'apiKeySetup':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h2 className="text-3xl md:text-4xl font-bold text-cyan-400 mb-4">Gemini API Key Setup</h2>
            <p className="text-slate-300 mb-8 max-w-2xl">
              To use this application, you need to provide your own Gemini API key. 
              This key will be stored locally in your browser and will only be used to make requests to Google's Gemini API.
            </p>
            <div className="w-full max-w-md bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-6">
              <div className="text-left">
                <label htmlFor="api-key" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                  <KeyIcon className="w-5 h-5" />
                  Gemini API Key
                </label>
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="Enter your Gemini API key"
                  className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Get your API key from{' '}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
              
              <button 
                onClick={handleApiKeySubmit}
                disabled={!apiKey.trim() || !!loadingMessage}
                className={`w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ${apiKey.trim() && !loadingMessage ? 'animate-button-glow' : ''}`}
              >
                {loadingMessage ? loadingMessage : 'Validate and Continue'}
              </button>
              
              {error && (
                <div className="text-red-400 text-sm text-center">
                  {error}
                </div>
              )}
            </div>
          </div>
        );
      case 'chatting':
        return <ChatInterface
                  chatHistory={chatHistory}
                  onSendMessage={handleSendMessage}
                  isLoading={!!loadingMessage}
                  loadingMessage={loadingMessage}
                  direction={direction}
                  isEgypt={isEgypt}
                />;
      case 'results':
        return <RecommendationsDisplay 
                  laptops={recommendations} 
                  sources={sources}
                  favorites={favorites} 
                  toggleFavorite={toggleFavorite}
                  chatHistory={chatHistory}
                  onSendMessage={handleSendMessage}
                  isLoading={!!loadingMessage}
                  loadingMessage={loadingMessage}
                  direction={direction}
                  isEgypt={isEgypt}
               />;
      case 'modelSelect':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h2 className="text-3xl md:text-4xl font-bold text-cyan-400 mb-4">
              {isEgypt ? 'اختر نموذج الذكاء الاصطناعي' : 'Choose Your AI Model'}
            </h2>
            <p className="text-slate-300 mb-8 max-w-2xl">
              {isEgypt
                ? 'دي كل النماذج المتاحة لمفتاحك. اختار النموذج اللي يناسبك، وهيتستخدم للمحادثة والبحث عن الأسعار.'
                : 'These are every model your API key can use. Pick the one you want for chat, live search and extraction.'}
            </p>
            <div className="w-full max-w-md bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-6">
              <ModelSelector
                models={models}
                selectedModel={selectedModel}
                onSelect={handleModelSelect}
                isLoading={modelsLoading}
                error={null}
                onRefresh={() => loadModels(apiKey)}
                isEgypt={isEgypt}
              />

              {modelNotice && (
                <p className="text-xs text-amber-400 text-left" role="status">{modelNotice}</p>
              )}

              <button
                onClick={() => setAppState(returnStateRef.current)}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
              >
                {isEgypt ? 'تم' : 'Done'}
              </button>
            </div>
          </div>
        );
      case 'welcome':
      default:
        const isButtonEnabled = !!country;
        const textAlignClass = isEgypt ? 'text-right' : 'text-left';

        const translations = {
            welcomeTitle: isEgypt ? "أهلاً بك في لابتوبايلوت" : "Welcome to LaptoPilot",
            welcomeSubtitle: isEgypt ? "مساعدك الذكي لاختيار اللابتوب المثالي. لنبدأ بتحديد اختياراتك." : "Your personal AI co-pilot for the perfect laptop. Let's start by setting up your search.",
            selectCountryLabel: isEgypt ? "٢. اختر بلدك" : "1. Select Your Country",
            setBudgetLabel: isEgypt ? "٣. حدد ميزانيتك التقريبية" : "2. Set Your Approximate Budget",
            selectCountryPlaceholder: isEgypt ? "اختر بلد..." : "Select a country...",
            selectCountryFirst: isEgypt ? "اختر البلد أولاً" : "Select a country first",
            startDiscovery: isEgypt ? "ابدأ البحث" : "Start Discovery",
        };
        
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <h2 className="text-3xl md:text-4xl font-bold text-cyan-400 mb-4">{translations.welcomeTitle}</h2>
            <p className="text-slate-300 mb-8 max-w-2xl">{translations.welcomeSubtitle}</p>
            <div className="w-full max-w-sm bg-slate-800 p-6 rounded-lg border border-slate-700 space-y-6">
              <div className={textAlignClass}>
                  <label htmlFor="country-select" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2"><CountryIcon className="w-5 h-5"/>{translations.selectCountryLabel}</label>
                  <select 
                    id="country-select"
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  >
                    <option value="">{translations.selectCountryPlaceholder}</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                  </select>
              </div>

              {/* Credit Section */}
              <div className="text-center py-4 border-t border-slate-700">
                <p className="text-slate-400 text-sm">
                  Developed by Seif Elsayed
                </p>
                <div className="flex justify-center space-x-4 mt-2">
                  <a 
                    href="https://github.com/zSayf" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-slate-300 hover:text-cyan-400 transition-colors"
                  >
                    GitHub
                  </a>
                  <a 
                    href="https://www.linkedin.com/in/seif-elsayed" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-slate-300 hover:text-cyan-400 transition-colors"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>
              {/* End Credit Section */}

              <div className={`transition-opacity duration-500 ${textAlignClass} ${country ? 'opacity-100' : 'opacity-50'}`}>
                <label htmlFor="budget-slider" className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2"><MoneyIcon className="w-5 h-5"/>{translations.setBudgetLabel}</label>
                <div className="text-2xl font-bold text-cyan-400 mb-3 text-center" aria-live="polite">
                   {country ? new Intl.NumberFormat(isEgypt ? 'ar-EG' : 'en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(budget) : translations.selectCountryFirst}
                </div>
                <input
                  id="budget-slider"
                  type="range"
                  min={budgetConfig?.min ?? 0}
                  max={budgetConfig?.max ?? 1}
                  step={budgetConfig?.step ?? 1}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  disabled={!country}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500"
                  aria-label="Budget slider"
                />
              </div>
              
              <button 
                onClick={handleStartChat}
                disabled={!isButtonEnabled}
                className={`w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ${isButtonEnabled ? 'animate-button-glow' : ''}`}
              >
                {translations.startDiscovery}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <style>{`
        @keyframes button-glow {
            0%, 100% { 
                box-shadow: 0 0 5px rgba(56, 189, 248, 0.3),
                            0 0 10px rgba(56, 189, 248, 0.2);
            }
            50% { 
                box-shadow: 0 0 20px rgba(56, 189, 248, 0.7),
                            0 0 30px rgba(56, 189, 248, 0.4);
            }
        }
        .animate-button-glow {
            animation: button-glow 2s infinite ease-in-out;
        }
        @keyframes fade-in-down {
            0% {
                opacity: 0;
                transform: translate(-50%, -20px);
            }
            100% {
                opacity: 1;
                transform: translate(-50%, 0);
            }
        }
        .animate-fade-in-down {
            animation: fade-in-down 0.5s ease-out forwards;
        }
        @keyframes fadeInSlideUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInSlideUp {
            animation: fadeInSlideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        @keyframes message-enter {
            0% {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        .animate-message-enter {
            animation: message-enter 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .message-bubble {
            transition: all 0.2s ease-in-out;
        }
        .message-bubble:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
        }
        @keyframes typing-pulse {
            0%, 60%, 100% {
                transform: translateY(0) scale(1);
                opacity: 0.4;
            }
            30% {
                transform: translateY(-5px) scale(1.1);
                opacity: 1;
            }
        }
        .typing-dot {
            width: 8px;
            height: 8px;
            background-color: #94a3b8;
            border-radius: 50%;
            animation: typing-pulse 1.8s infinite ease-in-out;
            animation-fill-mode: both;
            display: inline-block;
        }
        .typing-dot:nth-child(1) {
            animation-delay: -0.32s;
        }
        .typing-dot:nth-child(2) {
            animation-delay: -0.16s;
        }
        .typing-dot:nth-child(3) {
            animation-delay: 0s;
        }
        @keyframes icon-glow {
            0%, 100% {
                filter: drop-shadow(0 0 2px rgba(56, 189, 248, 0.6));
            }
            50% {
                filter: drop-shadow(0 0 8px rgba(56, 189, 248, 1));
            }
        }
        .animate-icon-glow {
            animation: icon-glow 2s infinite ease-in-out;
        }
        @keyframes pulse-glow {
            0%, 100% {
                filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.7));
                transform: scale(1);
            }
            50% {
                filter: drop-shadow(0 0 12px rgba(56, 189, 248, 1));
                transform: scale(1.05);
            }
        }
        .animate-pulse-glow {
            animation: pulse-glow 2.5s infinite ease-in-out;
        }
        @keyframes button-pop {
            0% {
                transform: scale(0.8);
                opacity: 0;
            }
            80% {
                transform: scale(1.05);
            }
            100% {
                transform: scale(1);
                opacity: 1;
            }
        }
        .animate-button-pop {
            animation: button-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes skeleton-loading {
            0% {
                background-color: #334155;
            }
            50% {
                background-color: #475569;
            }
            100% {
                background-color: #334155;
            }
        }
        .animate-skeleton {
            animation: skeleton-loading 1.5s infinite ease-in-out;
            border-radius: 0.5rem;
        }
      `}</style>
      <Header
        onReset={handleReset}
        showReset={appState !== 'apiKeySetup' && appState !== 'modelSelect'}
        isEgypt={isEgypt}
        onChangeApiKey={handleChangeApiKey}
        onChangeModel={apiKey ? handleChangeModel : undefined}
        currentModel={selectedModel}
      />
      <ErrorNotification
        message={error}
        onDismiss={handleDismissError}
        onRetry={retryAction.current ? handleRetry : undefined}
      />
      <main ref={mainContentRef} className="flex-grow container mx-auto p-4 flex flex-col">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;