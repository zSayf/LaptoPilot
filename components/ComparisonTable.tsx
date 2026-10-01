
import React from 'react';
import type { Laptop } from '../types';
import { safeHttpUrl } from '../services/urlSafety';

/** Intl throws on a bad currency code; never let that kill the render. */
function formatPrice(laptop: Laptop, isEgypt: boolean): string {
  try {
    return new Intl.NumberFormat(isEgypt ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: /^[A-Za-z]{3}$/.test(laptop.currency ?? '') ? laptop.currency : 'USD',
      maximumFractionDigits: 0,
    }).format(laptop.price ?? 0);
  } catch {
    return String(laptop.price ?? '');
  }
}

/**
 * Column identity for React keys. The model name alone collides when two
 * recommendations are the same machine, so the retailer disambiguates —
 * this mirrors the key RecommendationsDisplay gives LaptopCard.
 */
function columnKey(laptop: Laptop): string {
  return `${laptop.modelName}-${laptop.retailer}`;
}

interface ComparisonTableProps {
  laptops: Laptop[];
  isEgypt?: boolean;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({ laptops, isEgypt }) => {
  const specsOrder: (keyof Laptop['specs'])[] = ['cpu', 'gpu', 'ram', 'storage', 'display', 'operatingSystem', 'webcam', 'keyboard', 'ports'];

  const specLabels: Record<keyof Laptop['specs'], string> = isEgypt ? {
      cpu: 'المعالج (CPU)',
      gpu: 'كارت الشاشة (GPU)',
      ram: 'الذاكرة (RAM)',
      storage: 'التخزين (SSD)',
      display: 'الشاشة',
      operatingSystem: 'نظام التشغيل',
      webcam: 'الكاميرا',
      keyboard: 'لوحة المفاتيح',
      ports: 'المنافذ'
  } : {
      cpu: 'Processor (CPU)',
      gpu: 'Graphics (GPU)',
      ram: 'Memory (RAM)',
      storage: 'Storage (SSD)',
      display: 'Display',
      operatingSystem: 'Operating System',
      webcam: 'Webcam',
      keyboard: 'Keyboard',
      ports: 'Ports'
  };

  const translations = {
    feature: isEgypt ? 'الميزة' : 'Feature',
    price: isEgypt ? 'السعر' : 'Price',
    whyThis: isEgypt ? 'ليه اللابتوب ده؟' : '"Why this laptop?"',
    bestFeature: isEgypt ? 'أفضل ميزة' : 'Best Feature',
    viewAt: isEgypt ? 'اعرضه في' : 'View at',
    notSpecified: isEgypt ? 'غير محدد' : 'Not specified',
    notAvailable: isEgypt ? 'غير متاح' : 'N/A',
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm text-start text-slate-300">
          <thead className="text-xs text-slate-200 uppercase bg-slate-700/50">
            <tr>
              <th scope="col" className="px-6 py-4 sticky start-0 bg-slate-700/50">{translations.feature}</th>
              {laptops.map((laptop) => (
                <th key={columnKey(laptop)} scope="col" className="px-6 py-4">
                  {laptop.modelName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-700">
                <td className="px-6 py-4 font-bold text-cyan-400 sticky start-0 bg-slate-800">{translations.price}</td>
                {laptops.map((laptop) => (
                    <td key={columnKey(laptop)} className="px-6 py-4 font-semibold">
                        {formatPrice(laptop, isEgypt)}
                    </td>
                ))}
            </tr>
            {specsOrder.map(specKey => (
              <tr key={specKey} className="border-b border-slate-700">
                <td className="px-6 py-4 font-bold text-cyan-400 sticky start-0 bg-slate-800">{specLabels[specKey]}</td>
                {laptops.map((laptop) => (
                  <td key={`${specKey}-${columnKey(laptop)}`} className="px-6 py-4">
                    {laptop.specs[specKey] || translations.notSpecified}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-b border-slate-700">
              <td className="px-6 py-4 font-bold text-cyan-400 sticky start-0 bg-slate-800">{translations.whyThis}</td>
              {laptops.map((laptop) => (
                <td key={columnKey(laptop)} className="px-6 py-4 italic">
                  {laptop.justification}
                </td>
              ))}
            </tr>
             <tr className="border-b border-slate-700">
              <td className="px-6 py-4 font-bold text-cyan-400 sticky start-0 bg-slate-800">{translations.bestFeature}</td>
              {laptops.map((laptop) => (
                <td key={columnKey(laptop)} className="px-6 py-4 font-semibold text-slate-100">
                  {laptop.bestFeature || translations.notAvailable}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-4 sticky start-0 bg-slate-800"></td>
              {laptops.map((laptop) => {
                  const safe = safeHttpUrl(laptop.retailerUrl);
                  return (
                <td key={columnKey(laptop)} className="px-6 py-4">
                  {safe ? (
                    <a href={safe} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-cyan-500 hover:underline">
                      {translations.viewAt} {laptop.retailer}
                    </a>
                  ) : (
                    <span className="text-slate-500 text-xs">
                      {translations.viewAt} {laptop.retailer} — {isEgypt ? 'الرابط غير متاح' : 'link unavailable'}
                    </span>
                  )}
                </td>
                  );
                })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparisonTable;