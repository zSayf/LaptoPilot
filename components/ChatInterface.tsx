
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { UserIcon, RobotIcon, SendIcon, PhotoIcon, CpuIcon } from './icons';

/**
 * Search affordance for the loading indicator. Kept local rather than in
 * icons.tsx, matching origin/main.
 */
const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
);

/**
 * Pick an icon that matches what the app is actually doing, so the loader says
 * something useful. Ported from origin/main; recognises both English and Arabic
 * status strings.
 */
const getLoadingIcon = (message?: string): React.ReactNode => {
    const m = (message ?? '').toLowerCase();
    const iconClass = 'w-6 h-6 text-white animate-pulse-glow';
    if (m.includes('search') || m.includes('بحث')) return <SearchIcon className={iconClass} />;
    if (m.includes('analyz') || m.includes('تحليل')) return <CpuIcon className={iconClass} />;
    if (m.includes('image') || m.includes('صور')) return <PhotoIcon className={iconClass} />;
    return <RobotIcon className={iconClass} />;
};

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  loadingMessage?: string;
  direction?: 'ltr' | 'rtl';
  isEgypt?: boolean;
}

interface MessageBubbleProps {
  msg: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg }) => {
  const isModel = msg.role === 'model';

  // `justify-start`/`justify-end` are logical, so they already mirror when the
  // document flips to dir=rtl. Adding an isRtl branch here double-flipped the
  // layout and put the model on the same side in both directions.
  const alignmentClass = isModel ? 'justify-start' : 'justify-end';

  const bubbleColorClass = isModel ? 'bg-slate-700/50' : 'bg-cyan-700';

  // Tail of the bubble: the square corner is the bottom one nearest the avatar,
  // which always sits at the inline start for the model and inline end for the
  // user. Logical radii keep that true in both directions.
  const bubbleTailClass = isModel ? 'rounded-es-none' : 'rounded-ee-none';

  const bubbleContent = (
    <div className={`max-w-md md:max-w-lg px-5 py-3 rounded-2xl ${bubbleColorClass} ${bubbleTailClass} message-bubble animate-message-enter`}>
      <p className="text-slate-100 whitespace-pre-wrap text-start">{msg.text}</p>
    </div>
  );

  const icon = isModel
    ? (
      <div className="w-10 h-10 rounded-full bg-cyan-500 flex-shrink-0 flex items-center justify-center">
        <RobotIcon className="w-6 h-6 text-white" />
      </div>
    ) : (
      <div className="w-10 h-10 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center">
        <UserIcon className="w-6 h-6 text-white" />
      </div>
    );

  return (
    <div className={`w-full flex ${alignmentClass} animate-fadeInSlideUp`}>
      {/* The icon always precedes the model's bubble and follows the user's;
          flex row direction mirrors that automatically under dir=rtl. */}
      <div className="flex items-start gap-4">
        {isModel ? <>{icon}{bubbleContent}</> : <>{bubbleContent}{icon}</>}
      </div>
    </div>
  );
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatHistory, onSendMessage, isLoading, loadingMessage, direction = 'ltr', isEgypt = false }) => {
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sawLoadingRef = useRef(false);

  // Scroll the transcript container itself instead of scrollIntoView on the end
  // sentinel: scrollIntoView walks every scrollable ancestor, so a smooth
  // scroll fired on each keystroke could drag the whole page.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatHistory]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    // After the AI is done loading, focus the input field so the user can type
    // immediately. Skipped on the very first idle pass: that is mount, not the
    // end of a turn, and focusing there yanked focus (and the viewport) away
    // from the freshly rendered recommendations.
    if (isLoading) {
      sawLoadingRef.current = true;
      return;
    }
    if (sawLoadingRef.current && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [isLoading]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const isRtl = direction === 'rtl';

  const placeholder = isEgypt ? "أجب عن الأسئلة أو أضف تفاصيل أخرى..." : "Answer the questions or add more details...";
  const loadingPlaceholder = isEgypt ? "برجاء الانتظار..." : "Please wait...";
  const inputLabel = isEgypt ? 'اكتب سؤالك هنا' : 'Chat input';
  const sendLabel = isEgypt ? 'إرسال الرسالة' : 'Send message';
  const transcriptLabel = isEgypt ? 'المحادثة' : 'Chat transcript';

  return (
    <div lang={isEgypt ? 'ar-EG' : 'en'} className="flex flex-col h-full max-w-4xl mx-auto w-full bg-slate-800 rounded-lg shadow-xl overflow-hidden">
      {/* role="log" announces each new turn instead of leaving the transcript
          silent for screen reader users. aria-busy holds announcements back
          while the model is still streaming its reply. */}
      <div
        ref={messagesRef}
        className="flex-grow p-6 overflow-y-auto space-y-6"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={isLoading}
        aria-label={transcriptLabel}
      >
        {chatHistory.map((msg, index) => (
          <div
            key={`${msg.role}-${msg.functionCall?.name ?? 'text'}-${index}`}
            // Delay grows with the transcript, so an appended message inherits a
            // large delay and appears seconds after it arrives.
            style={{ animationDelay: `${Math.min(index, 3) * 0.1}s` }}
          >
            <MessageBubble msg={msg} />
          </div>
        ))}

        { isLoading && (
            <div className="w-full flex justify-start animate-fadeInSlideUp">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-cyan-500 flex-shrink-0 flex items-center justify-center">
                        <>{getLoadingIcon(loadingMessage)}</>
                    </div>
                    <div className="flex items-center gap-3 max-w-md md:max-w-lg px-5 py-3 rounded-2xl bg-slate-700/50 rounded-es-none">
                        {loadingMessage && <p className="text-slate-300 italic">{loadingMessage}</p>}
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        {/* No flex-row-reverse: a flex row already lays out right-to-left once
            the document is dir=rtl, so reversing it undid the mirroring. */}
        <form onSubmit={handleSubmit} className="flex items-center gap-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? loadingPlaceholder : placeholder}
            className="flex-grow p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition-all duration-200 resize-none max-h-40 text-start"
            rows={1}
            disabled={isLoading}
            aria-label={inputLabel}
          />
          <button
            type="submit"
            disabled={isLoading}
            aria-label={sendLabel}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 self-end animate-button-pop focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
          >
            <SendIcon className={`w-6 h-6 ${isRtl ? '-scale-x-100' : ''}`} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
