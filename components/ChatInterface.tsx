
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { UserIcon, RobotIcon, SendIcon, PhotoIcon, CpuIcon } from './icons';

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
  isRtl: boolean;
}

// A simple search icon for the loading state
const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
);


const getLoadingIcon = (message: string): React.ReactNode => {
    const lowerCaseMessage = message.toLowerCase();
    const iconClass = "w-6 h-6 text-white animate-pulse-glow";

    if (lowerCaseMessage.includes('search') || lowerCaseMessage.includes('بحث')) {
        return <SearchIcon className={iconClass} />;
    }
    if (lowerCaseMessage.includes('analyzing') || lowerCaseMessage.includes('تحليل')) {
        return <CpuIcon className={iconClass} />;
    }
    if (lowerCaseMessage.includes('image') || lowerCaseMessage.includes('صور')) {
        return <PhotoIcon className={iconClass} />;
    }
    // Default
    return <RobotIcon className={iconClass} />;
};


const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, isRtl }) => {
  const isModel = msg.role === 'model';
  
  // In LTR: Model is on the left, User is on the right.
  // In RTL: Model is on the right, User is on the left.
  const alignmentClass = isModel
    ? (isRtl ? 'justify-end' : 'justify-start')
    : (isRtl ? 'justify-start' : 'justify-end');

  const bubbleColorClass = isModel ? 'bg-slate-700/50' : 'bg-cyan-700';
  
  // Tail of the bubble
  const bubbleTailClass = isModel
    ? (isRtl ? 'rounded-br-none' : 'rounded-bl-none')
    : (isRtl ? 'rounded-bl-none' : 'rounded-br-none');

  const bubbleContent = (
    <div className={`max-w-md md:max-w-lg px-5 py-3 rounded-2xl ${bubbleColorClass} ${bubbleTailClass} message-bubble animate-message-enter`}>
      <p className={`text-slate-100 whitespace-pre-wrap ${isRtl ? 'text-right' : 'text-left'}`}>{msg.text}</p>
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
      <div className="flex items-start gap-4">
        {isRtl ? (isModel ? <>{bubbleContent}{icon}</> : <>{icon}{bubbleContent}</>)
                : (isModel ? <>{icon}{bubbleContent}</> : <>{bubbleContent}{icon}</>)}
      </div>
    </div>
  );
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatHistory, onSendMessage, isLoading, loadingMessage, direction = 'ltr', isEgypt = false }) => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [chatHistory, input]);

  useEffect(() => {
    // After the AI is done loading, focus the input field so the user can type immediately.
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
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
      setIsSending(true);
      onSendMessage(input.trim());
      setInput('');
      setTimeout(() => setIsSending(false), 300); // Animation duration
    }
  };

  const isRtl = direction === 'rtl';
  const loadingIcon = getLoadingIcon(loadingMessage || '');

  const placeholder = isEgypt ? "أجب عن الأسئلة أو أضف تفاصيل أخرى..." : "Answer the questions or add more details...";
  const loadingPlaceholder = isEgypt ? "برجاء الانتظار..." : "Please wait...";

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full bg-slate-800 rounded-lg shadow-xl overflow-hidden">
      <div className="flex-grow p-6 overflow-y-auto space-y-6">
        {chatHistory.map((msg, index) => (
          <div key={index} style={{ animationDelay: `${index * 0.1}s` }}>
            <MessageBubble msg={msg} isRtl={isRtl} />
          </div>
        ))}
        
        { isLoading && (
            <div className={`w-full flex ${isRtl ? 'justify-end' : 'justify-start'} animate-fadeInSlideUp`}>
                <div className="flex items-start gap-4">
                    {!isRtl && 
                        <div className="w-10 h-10 rounded-full bg-cyan-500 flex-shrink-0 flex items-center justify-center">
                            {loadingIcon}
                        </div>
                    }
                    <div className={`flex items-baseline gap-3 max-w-md md:max-w-lg px-5 py-3 rounded-2xl bg-slate-700/50 ${isRtl ? 'rounded-br-none' : 'rounded-bl-none'}`}>
                        {loadingMessage && <p className="text-slate-300 italic">{loadingMessage}</p>}
                        <div className="flex items-center space-x-1.5">
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                        </div>
                    </div>
                     {isRtl && 
                        <div className="w-10 h-10 rounded-full bg-cyan-500 flex-shrink-0 flex items-center justify-center">
                            {loadingIcon}
                        </div>
                    }
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <form onSubmit={handleSubmit} className={`flex items-center gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? loadingPlaceholder : placeholder}
            className={`flex-grow p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:outline-none transition-all duration-200 resize-none max-h-40 ${isRtl ? 'text-right' : ''}`}
            rows={1}
            disabled={isLoading}
            aria-label="Chat input"
          />
          <button 
            type="submit" 
            disabled={isLoading} 
            className={`bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 self-end ${isSending ? 'animate-button-press' : 'animate-button-pop'}`}
          >
            <SendIcon className={`w-6 h-6 ${isRtl ? 'transform -scale-x-100' : ''}`} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
