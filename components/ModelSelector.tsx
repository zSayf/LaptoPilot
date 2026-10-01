import React from 'react';
import type { CompatibleModel, ModelTier } from '../types';

interface ModelSelectorProps {
    models: CompatibleModel[];
    selectedModel: string;
    onSelect: (id: string) => void;
    isLoading?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    isEgypt?: boolean;
}

const TIER_LABEL: Record<ModelTier, string> = {
    pro: 'Pro',
    flash: 'Flash',
    'flash-lite': 'Flash Lite',
    standard: 'Standard',
};

/** Order the optgroups best-first, skipping any tier with no entries. */
const TIER_ORDER: ModelTier[] = ['pro', 'flash', 'flash-lite', 'standard'];

function formatTokens(n?: number): string {
    if (!n || !isFinite(n)) return '';
    if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
    models,
    selectedModel,
    onSelect,
    isLoading,
    error,
    onRefresh,
    isEgypt,
}) => {
    const grouped = TIER_ORDER.map((tier) => ({
        tier,
        items: models.filter((m) => m.tier === tier),
    })).filter((g) => g.items.length > 0);

    const current = models.find((m) => m.id === selectedModel);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <label
                    htmlFor="model-select"
                    className="text-sm font-medium text-slate-300"
                >
                    {isEgypt ? 'نموذج الذكاء الاصطناعي' : 'AI Model'}
                </label>
                {onRefresh && (
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading
                            ? (isEgypt ? 'جارٍ التحديث...' : 'Refreshing...')
                            : (isEgypt ? 'تحديث القائمة' : 'Refresh list')}
                    </button>
                )}
            </div>

            {isLoading && models.length === 0 ? (
                <div className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-400 flex items-center gap-2">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="ms-2">
                        {isEgypt ? 'جارٍ جلب النماذج المتاحة...' : 'Fetching available models...'}
                    </span>
                </div>
            ) : models.length === 0 ? (
                <div className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-400">
                    {error
                        ? error
                        : (isEgypt
                            ? 'لم يتم العثور على نماذج متوافقة.'
                            : 'No compatible models found for this key.')}
                </div>
            ) : (
                <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => onSelect(e.target.value)}
                    aria-label={isEgypt ? 'نموذج الذكاء الاصطناعي' : 'AI Model'}
                    className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                >
                    {grouped.map((g) => (
                        <optgroup key={g.tier} label={TIER_LABEL[g.tier]}>
                            {g.items.map((m) => {
                                const ctx = formatTokens(m.inputTokenLimit);
                                return (
                                    <option key={m.id} value={m.id}>
                                        {ctx ? `${m.displayName} (${ctx} ctx)` : m.displayName}
                                    </option>
                                );
                            })}
                        </optgroup>
                    ))}
                </select>
            )}

            {/* Show the context window and what the selection actually changes. */}
            {current && (
                <p className="text-xs text-slate-400">
                    {isEgypt
                        ? `يُستخدم هذا النموذج للمحادثة والبحث والاستخراج، مع تحويل تلقائي إلى ${models.length > 1 ? 'نماذج بديلة' : 'لا يوجد بديل'} عند تجاوز الحصة.`
                        : `Used for chat, live search and extraction${
                            current.inputTokenLimit
                              ? ` · ${current.inputTokenLimit.toLocaleString()} token context`
                              : ''
                          }. Falls back automatically if it hits a quota limit.`}
                </p>
            )}

            {error && models.length > 0 && (
                <p className="text-xs text-amber-400">{error}</p>
            )}
        </div>
    );
};

export default ModelSelector;