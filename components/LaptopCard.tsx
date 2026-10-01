
import React, { useState } from 'react';
import type { Laptop } from '../types';
import { safeHttpUrl, displayHost } from '../services/urlSafety';
import { HeartIcon, ExternalLinkIcon, CpuIcon, GpuIcon, RamIcon, StorageIcon, DisplayIcon, PhotoIcon, StarIcon, OsIcon, WebcamIcon, KeyboardIcon, PortsIcon, ClipboardIcon, CheckIcon } from './icons';

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

const LaptopCard: React.FC<LaptopCardProps> = ({ laptop, isFavorite, onToggleFavorite, isEgypt }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!laptop.imageUrl);
  const [isCopied, setIsCopied] = useState(false);
  const [isAnimatingFavorite, setIsAnimatingFavorite] = useState(false);

  const handleToggleFavorite = () => {
    setIsAnimatingFavorite(true);
    onToggleFavorite(laptop);
    setTimeout(() => setIsAnimatingFavorite(false), 400);
  };

  // Copy the specs as labelled text. Ported from origin/main.
  const handleCopy = () => {
    const specLabels: Record<string, string> = isEgypt ? {
        cpu: 'المعالج',
        gpu: 'كارت الشاشة',
        ram: 'الذاكرة',
        storage: 'التخزين',
        display: 'الشاشة',
        operatingSystem: 'نظام التشغيل',
        webcam: 'الكاميرا',
        keyboard: 'لوحة المفاتيح',
        ports: 'المنافذ'
    } : {
        cpu: 'CPU',
        gpu: 'GPU',
        ram: 'RAM',
        storage: 'Storage',
        display: 'Display',
        operatingSystem: 'Operating System',
        webcam: 'Webcam',
        keyboard: 'Keyboard',
        ports: 'Ports'
    };

    const specsText = Object.entries(laptop.specs ?? {})
        .filter(([, value]) => value)
        .map(([key, value]) => `${specLabels[key] || key}: ${value}`)
        .join('\n');

    navigator.clipboard
        .writeText(`${laptop.modelName}\n\n--- Specs ---\n${specsText}`)
        .then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2500);
        })
        .catch(err => {
            console.error('Failed to copy specs: ', err);
        });
  };

  // Intl.NumberFormat throws RangeError on anything that isn't a 3-letter code,
  // which would unmount the whole tree during render. The service normalises
  // this, but a card must never be able to take down the app on its own.
  let priceLabel: string;
  try {
    priceLabel = new Intl.NumberFormat(isEgypt ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: /^[A-Za-z]{3}$/.test(laptop.currency ?? '') ? laptop.currency : 'USD',
      maximumFractionDigits: 0,
    }).format(laptop.price ?? 0);
  } catch {
    priceLabel = String(laptop.price ?? '');
  }

  // Scheme-allowlisted: retailerUrl comes from web-grounded model output.
  const safeRetailerUrl = safeHttpUrl(laptop.retailerUrl);
  const retailerHost = displayHost(laptop.retailerUrl);

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden flex flex-col h-full transform hover:scale-[1.02] transition-transform duration-300 border border-slate-700">
      <div className="w-full h-48 bg-slate-700 flex items-center justify-center relative">
        {imageLoading && <div className="absolute inset-0 animate-skeleton"></div>}
        {laptop.imageUrl && !imageError ? (
            <img
                src={laptop.imageUrl}
                alt={laptop.modelName}
                className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setImageLoading(false)}
                onError={() => { setImageError(true); setImageLoading(false); }}
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
          <button
            onClick={handleCopy}
            // Icon-only, so the label and title carry both the action and the
            // confirmation state (ported from origin/main).
            title={isEgypt ? 'نسخ المواصفات' : 'Copy specs'}
            aria-label={isCopied
              ? (isEgypt ? 'تم نسخ المواصفات بنجاح' : 'Specifications copied successfully')
              : (isEgypt ? 'نسخ المواصفات' : 'Copy specs')}
            className="p-2 -mt-1 text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            {isCopied
              ? <CheckIcon className="w-6 h-6 text-green-500" />
              : <ClipboardIcon className="w-6 h-6" />}
            <span className="text-sm">{isCopied
              ? (isEgypt ? 'تم النسخ!' : 'Copied!')
              : (isEgypt ? 'نسخ' : 'Copy')}</span>
          </button>
          <button
            onClick={handleToggleFavorite}
            // HeartIcon is aria-hidden, so this label is the button's only accessible
            // name. It stays constant across states because aria-pressed carries the
            // on/off meaning; a label that flipped with the state would fight it.
            aria-label={isEgypt ? 'إضافة إلى المفضلة' : 'Add to favourites'}
            aria-pressed={isFavorite}
            // -me-1, not -mr-1: the negative offset hugs the title's trailing edge,
            // which is the left edge under dir=rtl.
            className="p-2 -mt-1 -me-1 text-slate-400 hover:text-red-500 transition-colors"
          >
            <HeartIcon className={`w-6 h-6 ${isFavorite ? 'text-red-500 fill-current' : ''} ${isAnimatingFavorite ? 'animate-heart-pop' : ''}`} />
          </button>
        </div>
        <p className="text-2xl font-semibold text-cyan-400 mb-4">{priceLabel}</p>

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
          {safeRetailerUrl ? (
            <a
              href={safeRetailerUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="w-full block text-center bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
            >
              <span className="flex items-center justify-center gap-2">
                {isEgypt ? 'اعرضه في' : 'View at'} {laptop.retailer}
                <ExternalLinkIcon className="w-4 h-4" />
              </span>
              {/* Show the real destination: the retailer name is model output too. */}
              {retailerHost && (
                <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                  {retailerHost}
                </span>
              )}
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