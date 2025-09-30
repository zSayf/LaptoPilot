import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Chat, ChatMessage, Laptop, AppState, GroundingSource, RecommendationArgs, Country } from './types';
import { getLaptopRecommendations, generateLaptopImage, analyzeBestFeatures, validateApiKey, getAiInstance } from './services/geminiService';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import RecommendationsDisplay from './components/RecommendationsDisplay';
import { COUNTRIES } from './constants';
import { CountryIcon, MoneyIcon, ErrorIcon, KeyIcon } from './components/icons';

type Direction = 'ltr' | 'rtl';

interface ErrorNotificationProps {
  message: string | null;
  onDismiss: () => void;
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({ message, onDismiss }) => {
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
      <button onClick={onDismiss} className="-mt-1 -mr-1 p-1 rounded-full hover:bg-red-700 transition-colors" aria-label="Dismiss">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
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

  const userArgs = useRef<RecommendationArgs | null>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  
  const isEgypt = country === 'Egypt';

  // Load API key from localStorage on component mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('geminiApiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      // Validate the saved API key
      validateApiKey(savedApiKey).then(isValid => {
        if (isValid) {
          setIsApiKeyValid(true);
          setAppState('welcome'); // Skip API key setup if key is valid
        } else {
          // If validation fails, we'll show a notification but still allow access
          // This could happen if the key was valid before but is now invalid
          setIsApiKeyValid(false);
          setAppState('welcome'); // Still go to welcome page but show option to change key
          setError("Your saved API key appears to be invalid. You can change it using the 'Change API Key' button.");
        }
      }).catch(err => {
        console.error("Error validating saved API key:", err);
        // If validation fails, we'll still go to welcome page but show option to change key
        setIsApiKeyValid(false);
        setAppState('welcome');
        setError("There was an error validating your saved API key. You can change it using the 'Change API Key' button.");
      });
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  useEffect(() => {
    if (appState === 'results') {
      setTimeout(() => {
        mainContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [appState]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    setIsApiKeyValid(false); // Reset validation when user types
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your Gemini API key");
      return;
    }

    setLoadingMessage('Validating API key...');
    try {
      const isValid = await validateApiKey(apiKey);
      if (isValid) {
        setIsApiKeyValid(true);
        // Save to localStorage
        localStorage.setItem('geminiApiKey', apiKey);
        setAppState('welcome');
        setError(null);
      } else {
        setError("Invalid API key. Please check your key and try again.");
        setIsApiKeyValid(false);
      }
    } catch (err) {
      setError("Error validating API key. Please try again.");
      console.error("API key validation error:", err);
    } finally {
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
    setError(null);
    setAppState('chatting');
  };
  
  // Add a helper function to handle function calls
  const handleFunctionCall = async (match: RegExpMatchArray, responseText: string, functionCallRegex: RegExp) => {
    // Extract function call parameters
    const paramsString = match[1];
    const paramRegex = /(\w+)=["']([^"']*)["']/g;
    const params: Record<string, string> = {};
    let paramMatch;
    
    while ((paramMatch = paramRegex.exec(paramsString)) !== null) {
      params[paramMatch[1]] = paramMatch[2];
    }
    
    // Extract budget value and currency
    let budgetValue = 0;
    let currencyValue = '';
    if (params.budget) {
      const budgetMatch = params.budget.match(/(\d+(?:\.\d+)?)\s*(\w+)/);
      if (budgetMatch) {
        budgetValue = parseFloat(budgetMatch[1]);
        currencyValue = budgetMatch[2];
      }
    }
    
    // Create recommendation args
    const recommendationArgs: RecommendationArgs = {
      country: params.location || country,
      budget: budgetValue,
      currency: currencyValue,
      primaryUse: params.primary_use || 'general',
      specificNeeds: `Usage: ${params.usage_location || 'general'}, Battery: ${params.battery_life_importance || 'not specified'}, Screen: ${params.screen_size || 'not specified'} ${params.screen_refresh_rate || ''}`
    };
    
    // Execute the function
    setLoadingMessage(isEgypt ? 'جاري البحث عن أفضل الترشيحات...' : 'Finding the best recommendations...');
    const { laptops, sources } = await getLaptopRecommendations(recommendationArgs, apiKey);
    
    // Add best features to laptops
    if (laptops.length > 0) {
      try {
        const features = await analyzeBestFeatures(laptops, recommendationArgs, apiKey, isEgypt);
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
        await Promise.all(laptops.map(async (laptop) => {
          const imageUrl = await generateLaptopImage(laptop.modelName, apiKey);
          if (imageUrl) {
            laptop.imageUrl = imageUrl;
          }
        }));
      } catch (imageError) {
        console.warn("Could not generate laptop images:", imageError);
        // This is non-critical, so we continue without images
      }
    }
    
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
              model: 'gemini-2.5-pro', // Use the higher-tier model first
              contents: [{ role: 'user', parts: [{ text: initialUserMessageText }] }],
              config: {
                systemInstruction,
                tools: [], // We'll handle function calls differently
              },
          });

          if (firstTurnResult.text && firstTurnResult.candidates?.[0]?.content) {
              const modelResponseText = firstTurnResult.text;
              const modelResponseContent = firstTurnResult.candidates[0].content;
              
              // Check if the response contains a function call
              const functionCallRegex = /<call:findLaptopRecommendations\s+([^>]*)\/>/;
              const match = modelResponseText.match(functionCallRegex);
              
              if (match) {
                // Handle function call in initial response
                await handleFunctionCall(match, modelResponseText, functionCallRegex);
              } else {
                // No function call, just add the response to chat history
                setChatHistory(prev => [...prev, { role: 'model', text: modelResponseText }]);
              }

              // Now, create the chat session with the established history.
              const newChat = ai.chats.create({
                  model: 'gemini-2.5-pro', // Use the higher-tier model first
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
          } else {
              throw new Error("The AI didn't respond. Please try starting over.");
          }

        } catch (e) {
          console.error("Failed to start conversation:", e);
          
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

          setError(errorMessage);
          setChatHistory([]);
          setAppState('welcome'); // Go back to welcome screen on failure
          setChat(null); // Ensure chat is reset
        } finally {
          setLoadingMessage('');
        }
      }
    };
    startAiConversation();
  }, [appState, country, budget, currency, isEgypt, apiKey, isApiKeyValid]);

  // Effect to create a *new* chat session when results are displayed, to handle the context change.
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
        
        const ai = getAiInstance(apiKey);
        const newChat = ai.chats.create({
            model: 'gemini-2.5-pro',
            config: {
                systemInstruction,
                tools: [], // We'll handle function calls differently
            },
        });
        setChat(newChat);
    }
}, [appState, recommendations, country, isEgypt, apiKey, isApiKeyValid]);


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
    setError(null);
    setLoadingMessage('');
    userArgs.current = null;
  };

  const handleChangeApiKey = () => {
    setAppState('apiKeySetup');
    setIsApiKeyValid(false);
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
      case 'welcome':
      default:
        const isButtonEnabled = !!country;
        const textAlignClass = isEgypt ? 'text-right' : 'text-left';

        const translations = {
            welcomeTitle: isEgypt ? "أهلاً بك في لابتوبايلوت" : "Welcome to LaptoPilot",
            welcomeSubtitle: isEgypt ? "مساعدك الذكي لاختيار اللابتوب المثالي. لنبدأ بتحديد اختياراتك." : "Your personal AI co-pilot for the perfect laptop. Let's start by setting up your search.",
            selectCountryLabel: isEgypt ? "٢. اختر بلدك" : "1. Select Your Country",
            setBudgetLabel: isEgypt ? "٢. حدد ميزانيتك التقريبية" : "2. Set Your Approximate Budget",
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
      <Header onReset={handleReset} showReset={appState !== 'apiKeySetup'} isEgypt={isEgypt} onChangeApiKey={handleChangeApiKey} />
      <ErrorNotification message={error} onDismiss={() => setError(null)} />
      <main ref={mainContentRef} className="flex-grow container mx-auto p-4 flex flex-col">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;