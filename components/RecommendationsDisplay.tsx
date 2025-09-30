
import React, { useState } from 'react';
import type { Laptop, GroundingSource, ChatMessage } from '../types';
import LaptopCard from './LaptopCard';
import ComparisonTable from './ComparisonTable';
import ChatInterface from './ChatInterface';
import { ListIcon, TableIcon, InfoIcon } from './icons';

interface RecommendationsDisplayProps {
  laptops: Laptop[];
  sources: GroundingSource[];
  favorites: Laptop[];
  toggleFavorite: (laptop: Laptop) => void;
  // Chat props for continuous conversation
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  loadingMessage?: string;
  direction?: 'ltr' | 'rtl';
  isEgypt?: boolean;
}

const RecommendationsDisplay: React.FC<RecommendationsDisplayProps> = ({ 
    laptops, 
    sources, 
    favorites, 
    toggleFavorite,
    chatHistory,
    onSendMessage,
    isLoading,
    loadingMessage,
    direction,
    isEgypt
}) => {
  const [view, setView] = useState<'cards' | 'compare'>('cards');

  return (
    <div className="w-full flex flex-col flex-grow space-y-8">
      <div>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-cyan-400 mb-4 md:mb-0">
            {isEgypt ? `أفضل ${laptops.length} ترشيحات لك` : `Your Top ${laptops.length} Recommendations`}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('cards')}
              className={`p-2 rounded-md transition-colors ${view === 'cards' ? 'bg-cyan-600' : 'bg-slate-700 hover:bg-slate-600'}`}
              aria-label={isEgypt ? 'عرض البطاقات' : "Card View"}
            >
              <ListIcon className="w-6 h-6" />
            </button>
            <button
              onClick={() => setView('compare')}
              className={`p-2 rounded-md transition-colors ${view === 'compare' ? 'bg-cyan-600' : 'bg-slate-700 hover:bg-slate-600'}`}
              aria-label={isEgypt ? 'عرض المقارنة' : "Comparison View"}
            >
              <TableIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {view === 'cards' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {laptops.map((laptop, index) => (
              <LaptopCard
                key={index}
                laptop={laptop}
                isFavorite={favorites.some(fav => fav.modelName === laptop.modelName)}
                onToggleFavorite={toggleFavorite}
                isEgypt={isEgypt}
              />
            ))}
          </div>
        ) : (
          <ComparisonTable laptops={laptops} isEgypt={isEgypt} />
        )}
        
        {sources.length > 0 && (
            <div className="mt-12 bg-slate-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <InfoIcon className="w-5 h-5" />
                    {isEgypt ? 'مصادر البيانات' : 'Data Sources'}
                </h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                    {sources.map((source, index) => (
                        <li key={index}>
                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                                {source.title || (isEgypt ? 'رابط المصدر' : 'Source Link')}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>
      
      {/* Continuous Conversation Section */}
      <div className="h-[70vh] min-h-[500px] flex flex-col">
         <h3 className="text-xl font-bold text-slate-200 mb-4 text-center">{isEgypt ? 'عندك أسئلة تانية؟' : 'Have more questions?'}</h3>
         <div className="flex-grow">
            <ChatInterface
                chatHistory={chatHistory}
                onSendMessage={onSendMessage}
                isLoading={isLoading}
                loadingMessage={loadingMessage}
                direction={direction}
                isEgypt={isEgypt}
            />
         </div>
      </div>
    </div>
  );
};

export default RecommendationsDisplay;
