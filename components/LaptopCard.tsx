
import React, { useState } from 'react';
import type { Laptop } from '../types';
import { HeartIcon, ExternalLinkIcon, CpuIcon, GpuIcon, RamIcon, StorageIcon, DisplayIcon, PhotoIcon, StarIcon, OsIcon, WebcamIcon, KeyboardIcon, PortsIcon } from './icons';

interface LaptopCardProps {
  laptop: Laptop;
  isFavorite: boolean;
  onToggleFavorite: (laptop: Laptop) => void;
  isEgypt?: boolean;
}

const SpecItem: React.FC<{ icon: React.ReactNode, label: string }> = ({ icon, label }) => (
    <div className="flex items-center gap-2 text-slate-300 text-sm">
        {icon}
        <span>{label}</span>
    </div>
);

const isValidUrl = (url: string) => {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

const LaptopCard: React.FC<LaptopCardProps> = ({ laptop, isFavorite, onToggleFavorite, isEgypt }) => {
  const [imageError, setImageError] = useState(false);
  
  const formatter = new Intl.NumberFormat(isEgypt ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency: laptop.currency,
    maximumFractionDigits: 0,
  });

  const hasValidUrl = laptop.retailerUrl && isValidUrl(laptop.retailerUrl);

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col h-full transform hover:scale-[1.02] transition-transform duration-300 border border-slate-700">
      <div className="w-full h-48 bg-slate-700 flex items-center justify-center">
        {laptop.imageUrl && !imageError ? (
            <img 
                src={laptop.imageUrl} 
                alt={laptop.modelName} 
                className="w-full h-full object-cover" 
                onError={() => setImageError(true)}
            />
        ) : (
            <div className="flex flex-col items-center justify-center text-slate-500">
                <PhotoIcon className="w-16 h-16" />
                <p className="mt-2 text-sm">{isEgypt ? 'الصورة غير متاحة' : 'Image not available'}</p>
            </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-bold text-white mb-2 flex-1">{laptop.modelName}</h3>
          <button onClick={() => onToggleFavorite(laptop)} className="p-2 -mt-1 -mr-1 text-slate-400 hover:text-red-500 transition-colors">
            <HeartIcon className={`w-6 h-6 ${isFavorite ? 'text-red-500 fill-current' : ''}`} />
          </button>
        </div>
        <p className="text-2xl font-semibold text-cyan-400 mb-4">{formatter.format(laptop.price)}</p>

        {laptop.bestFeature && (
            <div className="mb-4 bg-cyan-900/50 border border-cyan-800 p-3 rounded-lg flex items-center gap-3">
                <StarIcon className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <p className="text-sm text-cyan-200">{laptop.bestFeature}</p>
            </div>
        )}

        <div className="space-y-3 mb-4">
            {laptop.specs.cpu && <SpecItem icon={<CpuIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.cpu} />}
            {laptop.specs.gpu && <SpecItem icon={<GpuIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.gpu} />}
            {laptop.specs.ram && <SpecItem icon={<RamIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.ram} />}
            {laptop.specs.storage && <SpecItem icon={<StorageIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.storage} />}
            {laptop.specs.display && <SpecItem icon={<DisplayIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.display} />}
            {laptop.specs.operatingSystem && <SpecItem icon={<OsIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.operatingSystem} />}
            {laptop.specs.webcam && <SpecItem icon={<WebcamIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.webcam} />}
            {laptop.specs.keyboard && <SpecItem icon={<KeyboardIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.keyboard} />}
            {laptop.specs.ports && <SpecItem icon={<PortsIcon className="w-5 h-5 text-cyan-400"/>} label={laptop.specs.ports} />}
        </div>

        <div className="mt-auto pt-4">
          <div className="bg-slate-700/50 p-4 rounded-md mb-4">
              <p className="text-slate-300 text-sm italic">"{laptop.justification}"</p>
          </div>
          {hasValidUrl ? (
            <a
              href={laptop.retailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block text-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
            >
              <span className="flex items-center justify-center gap-2">
                {isEgypt ? 'اعرضه في' : 'View at'} {laptop.retailer}
                <ExternalLinkIcon className="w-4 h-4" />
              </span>
            </a>
          ) : (
             <button
                disabled
                className="w-full block text-center bg-slate-600 text-slate-400 font-bold py-2 px-4 rounded-lg cursor-not-allowed"
             >
                {isEgypt ? 'الرابط غير متاح' : 'Link Unavailable'}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaptopCard;