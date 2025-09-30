import React from 'react';
import { RobotIcon } from './icons';

interface HeaderProps {
    onReset: () => void;
    showReset: boolean;
    isEgypt?: boolean;
    onChangeApiKey?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onReset, showReset, isEgypt, onChangeApiKey }) => {
  return (
    <header className="bg-slate-900/70 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center space-x-3">
                <RobotIcon className="w-8 h-8 text-cyan-400" />
                <h1 className="text-2xl font-bold text-white tracking-tight">
                Lapto<span className="text-cyan-400">Pilot</span>
                </h1>
            </div>
            <div className="flex space-x-2">
                {onChangeApiKey && (
                    <button
                        onClick={onChangeApiKey}
                        className="border border-slate-600 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors duration-300 text-sm"
                    >
                        {isEgypt ? 'تغيير مفتاح API' : 'Change API Key'}
                    </button>
                )}
                {showReset && (
                    <button
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