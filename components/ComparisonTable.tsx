
import React from 'react';
import type { Laptop } from '../types';

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
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm text-left text-slate-300">
          <thead className="text-xs text-slate-200 uppercase bg-slate-700/50">
            <tr>
              <th scope="col" className="px-6 py-4 sticky left-0 bg-slate-700/50">{translations.feature}</th>
              {laptops.map((laptop, index) => (
                <th key={index} scope="col" className="px-6 py-4">
                  {laptop.modelName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-700">
                <td className="px-6 py-4 font-bold text-cyan-400 sticky left-0 bg-slate-800">{translations.price}</td>
                {laptops.map((laptop, index) => (
                    <td key={index} className="px-6 py-4 font-semibold">
                        {new Intl.NumberFormat(isEgypt ? 'ar-EG' : 'en-US', { style: 'currency', currency: laptop.currency, maximumFractionDigits: 0 }).format(laptop.price)}
                    </td>
                ))}
            </tr>
            {specsOrder.map(specKey => (
              <tr key={specKey} className="border-b border-slate-700">
                <td className="px-6 py-4 font-bold text-cyan-400 sticky left-0 bg-slate-800">{specLabels[specKey]}</td>
                {laptops.map((laptop, index) => (
                  <td key={index} className="px-6 py-4">
                    {laptop.specs[specKey] || 'Not specified'}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-b border-slate-700">
              <td className="px-6 py-4 font-bold text-cyan-400 sticky left-0 bg-slate-800">{translations.whyThis}</td>
              {laptops.map((laptop, index) => (
                <td key={index} className="px-6 py-4 italic">
                  {laptop.justification}
                </td>
              ))}
            </tr>
             <tr className="border-b border-slate-700">
              <td className="px-6 py-4 font-bold text-cyan-400 sticky left-0 bg-slate-800">{translations.bestFeature}</td>
              {laptops.map((laptop, index) => (
                <td key={index} className="px-6 py-4 font-semibold text-slate-100">
                  {laptop.bestFeature || 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-4 sticky left-0 bg-slate-800"></td>
              {laptops.map((laptop, index) => (
                <td key={index} className="px-6 py-4">
                  <a href={laptop.retailerUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-500 hover:underline">
                    {translations.viewAt} {laptop.retailer}
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ComparisonTable;