import React from 'react';
import { RobotIcon } from './icons';

/** Small inline chip icon for the model switcher. */
const ModelIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);

interface HeaderProps {
    onReset: () => void;
    showReset: boolean;
    isEgypt?: boolean;
    onChangeApiKey?: () => void;
    onChangeModel?: () => void;
    /** Shown next to the model name so users can see what they're paying for. */
    currentModel?: string;
}

const Header: React.FC<HeaderProps> = ({ onReset, showReset, isEgypt, onChangeApiKey, onChangeModel, currentModel }) => {
  // The model label is hidden below the `sm` breakpoint, leaving only the icon,
  // so the button needs its own name for assistive tech.
  const modelButtonLabel = isEgypt ? 'تغيير نموذج الذكاء الاصطناعي' : 'Change AI model';

  return (
    <header lang={isEgypt ? 'ar-EG' : 'en'} className="bg-slate-900/70 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center space-x-3">
                <RobotIcon className="w-8 h-8 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white tracking-tight">
                Lapto<span className="text-cyan-400">Pilot</span>
                </h1>
            </div>
            <div className="flex items-center space-x-2">
                {onChangeModel && (
                    <button
                        type="button"
                        onClick={onChangeModel}
                        title={currentModel}
                        aria-label={currentModel ? `${modelButtonLabel}: ${currentModel}` : modelButtonLabel}
                        className="border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold py-2 px-3 rounded-lg transition-colors duration-300 text-xs sm:text-sm flex items-center gap-2"
                    >
                        <ModelIcon className="w-4 h-4 text-cyan-400" />
                        <span className="hidden sm:inline max-w-[10rem] truncate">
                            {currentModel || (isEgypt ? 'النموذج' : 'Model')}
                        </span>
                    </button>
                )}
                {onChangeApiKey && (
                    <button
                        type="button"
                        onClick={onChangeApiKey}
                        className="border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors duration-300 text-sm"
                    >
                        {isEgypt ? 'تغيير مفتاح API' : 'Change API Key'}
                    </button>
                )}
                {showReset && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors duration-300 text-sm"
                    >
                        {isEgypt ? 'ابدأ من جديد' : 'Start Over'}
                    </button>
                )}
            </div>
        </div>
    </header>
  );
};

export default Header;