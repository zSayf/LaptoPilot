
import React, { useState } from 'react';
import type { Laptop, GroundingSource, ChatMessage } from '../types';
import { safeHttpUrl } from '../services/urlSafety';
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

  // Latin digits inside an Arabic sentence render as an LTR island and clash
  // with the ar-EG numbers used for prices in the cards.
  const countLabel = isEgypt
    ? new Intl.NumberFormat('ar-EG').format(laptops.length)
    : String(laptops.length);

  return (
    <div lang={isEgypt ? 'ar-EG' : 'en'} className="w-full flex flex-col flex-grow space-y-8">
      <div>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-cyan-400 mb-4 md:mb-0">
            {isEgypt ? `أفضل ${countLabel} ترشيحات لك` : `Your Top ${countLabel} Recommendations`}
          </h2>
          <div className="flex items-center gap-2" role="group" aria-label={isEgypt ? 'طريقة العرض' : 'View mode'}>
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`p-2 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${view === 'cards' ? 'bg-cyan-600' : 'bg-slate-700 hover:bg-slate-600'}`}
              aria-label={isEgypt ? 'عرض البطاقات' : "Card View"}
              aria-pressed={view === 'cards'}
            >
              <ListIcon className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => setView('compare')}
              className={`p-2 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${view === 'compare' ? 'bg-cyan-600' : 'bg-slate-700 hover:bg-slate-600'}`}
              aria-label={isEgypt ? 'عرض المقارنة' : "Comparison View"}
              aria-pressed={view === 'compare'}
            >
              <TableIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {view === 'cards' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {laptops.map((laptop) => (
              <LaptopCard
                // LaptopCard keeps an internal imageError flag, so index keys
                // carried a failed image over to whichever laptop landed on
                // that index after a refined search replaced the list.
                key={`${laptop.modelName}-${laptop.retailer}`}
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
                    {sources.map((source) => {
                        const safe = safeHttpUrl(source.uri);
                        const label = source.title || (isEgypt ? 'رابط المصدر' : 'Source Link');
                        return (
                        // The service de-duplicates grounding sources by uri,
                        // so it is a stable identity for the list.
                        <li key={source.uri}>
                            {safe ? (
                                <a href={safe} target="_blank" rel="noopener noreferrer nofollow" className="text-cyan-400 hover:underline">
                                    {label}
                                </a>
                            ) : (
                                // Grounding URIs are remote-controlled; refuse any
                                // scheme that isn't plain http(s).
                                <span className="text-slate-500">{label}</span>
                            )}
                        </li>
                        );
                    })}
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
