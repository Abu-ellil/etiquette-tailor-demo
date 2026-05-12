import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../contexts/I18nContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Worker {
  id: number;
  name: string;
  worker_type?: string | null;
  base_salary: number;
}

interface WorkerRate {
  id?: number;
  user_id: number;
  piece_type: string;
  wage_type: 'percentage' | 'fixed';
  rate: number;
  season_start?: string;
  season_end?: string;
}

interface PieceType {
  id: number;
  name_en: string;
  name_ar: string;
  category: string;
  base_price: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WorkerPayRatesPage() {
  const { t, currency } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [rates, setRates] = useState<Record<string, WorkerRate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pieceTypes, setPieceTypes] = useState<PieceType[]>([]);
  const [calcPrice, setCalcPrice] = useState(50);

  /* ---- Load workers ---- */

  const loadWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const [data, pt] = await Promise.all([
        window.electronAPI.workers.getAll(),
        window.electronAPI.pieceTypes.getAll(),
      ]);
      setWorkers(data || []);
      setPieceTypes(pt || []);
      if (data && data.length > 0 && !selectedWorkerId) {
        setSelectedWorkerId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load workers:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkerId]);

  useEffect(() => {
    loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Load rates when worker changes ---- */

  useEffect(() => {
    if (!selectedWorkerId) return;
    const loadRates = async () => {
      try {
        const data: WorkerRate[] = await window.electronAPI.workers.getRates(selectedWorkerId);
        const rateMap: Record<string, WorkerRate> = {};
        for (const r of data || []) {
          rateMap[r.piece_type] = r;
        }
        setRates(rateMap);
        setDirty(false);
      } catch (err) {
        console.error('Failed to load rates:', err);
        setRates({});
      }
    };
    loadRates();
  }, [selectedWorkerId]);

  /* ---- Selected worker info ---- */

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  /* ---- Rate helpers ---- */

  const getOrCreateRate = (pieceType: string): WorkerRate => {
    return (
      rates[pieceType] || {
        user_id: selectedWorkerId!,
        piece_type: pieceType,
        wage_type: 'percentage' as const,
        rate: 0,
      }
    );
  };

  const updateRate = (pieceType: string, field: string, value: any) => {
    setRates((prev) => ({
      ...prev,
      [pieceType]: { ...getOrCreateRate(pieceType), [field]: value },
    }));
    setDirty(true);
  };

  const configuredCount = Object.keys(rates).filter((k) => rates[k].rate > 0).length;

  /* ---- Save all rates ---- */

  const handleSave = async () => {
    if (!selectedWorkerId) return;
    try {
      setSaving(true);
      for (const pt of pieceTypes) {
        const rate = rates[pt.name_en];
        if (rate && rate.rate > 0) {
          await window.electronAPI.workers.setRate({
            user_id: selectedWorkerId,
            piece_type: pt.name_en,
            wage_type: rate.wage_type,
            rate: rate.rate,
            season_start: rate.season_start || undefined,
            season_end: rate.season_end || undefined,
          });
        }
      }
      setDirty(false);
    } catch (err) {
      console.error('Failed to save rates:', err);
    } finally {
      setSaving(false);
    }
  };

  /* ---- Discard changes ---- */

  const handleDiscard = async () => {
    if (!selectedWorkerId) return;
    try {
      const data: WorkerRate[] = await window.electronAPI.workers.getRates(selectedWorkerId);
      const rateMap: Record<string, WorkerRate> = {};
      for (const r of data || []) {
        rateMap[r.piece_type] = r;
      }
      setRates(rateMap);
      setDirty(false);
    } catch (err) {
      console.error('Failed to reload rates:', err);
    }
  };

  /* ---- Calculate wage for preview ---- */

  const calcWage = (rate: WorkerRate, price: number): string => {
    if (!rate || rate.rate <= 0) return '--';
    const wage = rate.wage_type === 'percentage' ? price * (rate.rate / 100) : rate.rate;
    return rate.wage_type === 'percentage'
      ? `${price} x ${rate.rate}% = ${wage.toFixed(0)} ${t(currency)}`
      : `${wage.toFixed(0)} ${t(currency)}`;
  };

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        {t('Loading workers...')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ---- Header ---- */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">
            {t('Worker Rates')}
          </h1>
          <p className="text-secondary mt-1 text-lg">
            {t('Set wages per piece type — percentage or fixed amount.')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDiscard}
            disabled={!dirty}
            className="px-5 py-3 text-sm font-semibold text-secondary hover:bg-surface-container-high rounded-lg transition-colors disabled:opacity-40"
          >
            {t('Discard')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {saving && (
              <span className="material-symbols-outlined animate-spin text-base">
                progress_activity
              </span>
            )}
            {saving ? t('Saving...') : t('Save Rates')}
          </button>
        </div>
      </div>

      {/* ---- Worker Selector + Info ---- */}
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">
            {t('Select Worker')}
          </label>
          <div className="relative">
            <select
              value={selectedWorkerId || ''}
              onChange={(e) => setSelectedWorkerId(Number(e.target.value))}
              className="input-field pr-10 min-w-[280px] appearance-none cursor-pointer"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">
              expand_more
            </span>
          </div>
        </div>

        {selectedWorker && (
          <div className="flex items-center gap-4 mt-6 px-5 py-3 bg-surface-container-low rounded-lg">
            <span className="material-symbols-outlined text-secondary">
              {selectedWorker.worker_type === 'master_cutter' ? 'content_cut' : 'styler'}
            </span>
            <span className="font-semibold text-on-surface">{selectedWorker.name}</span>
            <span className="text-xs text-secondary uppercase">
              {selectedWorker.worker_type === 'master_cutter' ? t('Master Cutter') : selectedWorker.worker_type === 'tailor' ? t('Tailor') : t('Worker')}
            </span>
            {selectedWorker.base_salary > 0 && (
              <span className="text-xs font-semibold text-primary">
                {t('+ {amount} QAR salary').replace('{amount}', String(selectedWorker.base_salary)).replaceAll('QAR', t(currency))}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ---- Quick Calculator ---- */}
      {workers.length > 0 && (
        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary">calculate</span>
              <span className="font-semibold text-on-surface">{t('Quick Calculator')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">{t('Fallback price:')}</span>
              <input
                type="number"
                min="0"
                value={calcPrice}
                onChange={(e) => setCalcPrice(Number(e.target.value) || 0)}
                className="w-24 h-9 px-3 text-sm font-bold text-right bg-surface-container-lowest rounded-lg border-none focus:ring-2 focus:ring-primary/30 outline-none"
              />
              <span className="text-sm text-secondary">{t(currency)}</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {pieceTypes
                .filter((pt) => rates[pt.name_en]?.rate > 0)
                .map((pt) => {
                  const rate = rates[pt.name_en];
                  const price = pt.base_price || calcPrice;
                  const wage =
                    rate.wage_type === 'percentage'
                      ? price * (rate.rate / 100)
                      : rate.rate;
                  return (
                    <div key={pt.name_en} className="flex items-center gap-2 text-sm">
                      <span className="text-secondary">{pt.name_en}:</span>
                      <span className="text-secondary text-xs">({price} × {rate.rate}% =</span>
                      <span className="font-bold text-primary">{wage.toFixed(0)} {t(currency)})</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {workers.length === 0 ? (
        <div className="text-center py-16 text-secondary">
          <span className="material-symbols-outlined text-5xl mb-3 text-outline">badge</span>
          <p className="font-headline font-bold text-lg">{t('No workers yet')}</p>
          <p className="text-sm mt-1">{t('Add workers first, then set their rates.')}</p>
        </div>
      ) : (
        <>
          {/* ---- Rates Table ---- */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant/15">
                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-widest text-secondary">
                      {t('Piece Type')}
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-widest text-secondary">
                      {t('Base Price')}
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-widest text-secondary">
                      {t('Wage Type')}
                    </th>
                    <th className="text-right px-4 py-4 text-xs font-bold uppercase tracking-widest text-secondary">
                      {t('Rate')}
                    </th>
                    <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-widest text-secondary">
                      {t('Seasonal')}
                    </th>
                    <th className="text-right px-6 py-4 text-xs font-bold uppercase tracking-widest text-secondary">
                      {t('Preview')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pieceTypes.map((pt, idx) => {
                    const rate = getOrCreateRate(pt.name_en);
                    const hasSeasonal = !!(rate.season_start || rate.season_end);
                    const isEven = idx % 2 === 0;

                    return (
                      <React.Fragment key={pt.name_en}>
                        <tr className={`${isEven ? 'bg-surface' : 'bg-surface-container-lowest'} hover:bg-primary/5 transition-colors`}>
                          {/* Piece Type */}
                          <td className="px-6 py-4">
                            <p className="font-semibold text-on-surface">{pt.name_en}</p>
                            <p className="text-xs text-secondary">{pt.name_ar}</p>
                          </td>

                          {/* Base Price */}
                          <td className="px-4 py-4 text-center">
                            <div className="flex justify-center">
                              <div className="relative w-24">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={pt.base_price || ''}
                                  onChange={async (e) => {
                                    const newPrice = parseFloat(e.target.value) || 0;
                                    try {
                                      await window.electronAPI.pieceTypes.updateBasePrice(pt.name_en, newPrice);
                                      setPieceTypes((prev) =>
                                        prev.map((p) =>
                                          p.name_en === pt.name_en ? { ...p, base_price: newPrice } : p
                                        )
                                      );
                                    } catch (err) {
                                      console.error('Failed to update base_price:', err);
                                    }
                                  }}
                                  className="w-full h-9 pl-2 pr-8 text-right text-sm font-bold text-on-surface bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/30 outline-none"
                                  placeholder="0"
                                />
                                <span className="absolute right-2 top-2 text-secondary text-xs">{t(currency)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Wage Type Toggle */}
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() =>
                                updateRate(
                                  pt.name_en,
                                  'wage_type',
                                  rate.wage_type === 'percentage' ? 'fixed' : 'percentage'
                                )
                              }
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-colors"
                              style={{
                                background:
                                  rate.wage_type === 'percentage'
                                    ? 'rgba(103,80,164,0.1)'
                                    : 'rgba(0,105,92,0.1)',
                                color:
                                  rate.wage_type === 'percentage'
                                    ? 'rgb(103,80,164)'
                                    : 'rgb(0,105,92)',
                              }}
                            >
                              <span className="material-symbols-outlined text-sm">
                                {rate.wage_type === 'percentage' ? 'percent' : 'payments'}
                              </span>
                              {rate.wage_type === 'percentage' ? t('Percentage') : t('Fixed')}
                            </button>
                          </td>

                          {/* Rate Input */}
                          <td className="px-4 py-4">
                            <div className="flex justify-end">
                              <div className="relative w-28">
                                <input
                                  type="number"
                                  min="0"
                                  step={rate.wage_type === 'percentage' ? '0.5' : '0.01'}
                                  value={rate.rate || ''}
                                  onChange={(e) =>
                                    updateRate(pt.name_en, 'rate', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full h-10 pl-3 pr-10 text-right font-bold text-on-surface bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/30 outline-none"
                                  placeholder="0"
                                />
                                <span className="absolute right-3 top-2.5 text-secondary text-xs font-medium">
                                  {rate.wage_type === 'percentage' ? '%' : t(currency)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Seasonal Toggle */}
                          <td className="px-4 py-4 text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={hasSeasonal}
                                onChange={(e) => {
                                  if (!e.target.checked) {
                                    updateRate(pt.name_en, 'season_start', undefined);
                                    updateRate(pt.name_en, 'season_end', undefined);
                                  } else {
                                    updateRate(pt.name_en, 'season_start', '');
                                    updateRate(pt.name_en, 'season_end', '');
                                  }
                                }}
                                className="w-4 h-4 rounded accent-primary"
                              />
                              <span className="text-xs text-secondary">{t('Season')}</span>
                            </label>
                          </td>

                          {/* Preview */}
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-bold text-primary">
                              {calcWage(rate, pt.base_price || calcPrice)}
                            </span>
                          </td>
                        </tr>

                        {/* Seasonal Dates Row */}
                        {hasSeasonal && (
                          <tr className={`${isEven ? 'bg-surface' : 'bg-surface-container-lowest'}`}>
                            <td colSpan={6} className="px-6 py-3">
                              <div className="flex items-center gap-3 ml-auto justify-end">
                                <span className="text-xs text-secondary">{t('From')}</span>
                                <input
                                  type="date"
                                  value={rate.season_start || ''}
                                  onChange={(e) =>
                                    updateRate(pt.name_en, 'season_start', e.target.value)
                                  }
                                  className="h-8 px-3 text-sm bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/30 outline-none"
                                />
                                <span className="text-xs text-secondary">{t('To')}</span>
                                <input
                                  type="date"
                                  value={rate.season_end || ''}
                                  onChange={(e) =>
                                    updateRate(pt.name_en, 'season_end', e.target.value)
                                  }
                                  className="h-8 px-3 text-sm bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/30 outline-none"
                                />
                                {hasSeasonal && (
                                  <button
                                    onClick={() => {
                                      updateRate(pt.name_en, 'season_start', undefined);
                                      updateRate(pt.name_en, 'season_end', undefined);
                                    }}
                                    className="text-xs text-error hover:underline"
                                  >
                                    {t('Clear')}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-6 py-3 border-t border-outline-variant/10 flex justify-between items-center text-xs text-secondary">
              <span>{t('{count} of {total} rates configured').replace('{count}', String(configuredCount)).replace('{total}', String(pieceTypes.length))}</span>
              <span>{t('Preview uses base_price per piece type, fallback: {price} QAR').replace('{price}', String(calcPrice)).replaceAll('QAR', t(currency))}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
