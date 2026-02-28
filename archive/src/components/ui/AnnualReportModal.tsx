/**
 * AnnualReportModal — pripiski (report falsification) system.
 *
 * Shown at 5-year-plan deadline years. Displays actual production
 * metrics vs quota targets. Player can adjust sliders to inflate
 * numbers (pripiski), risking investigation, or submit honestly.
 *
 * Adapted from approved prototype (src/prototypes/AnnualReportModal.tsx).
 */
import { Dialog, Transition } from '@headlessui/react';
import { FileText, Star } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Slider } from '@/components/ui/Slider';

// ── Types ────────────────────────────────────────────────────────────────

export interface AnnualReportData {
  year: number;
  quotaType: 'food' | 'vodka';
  quotaTarget: number;
  /** Cumulative production of the quota resource this plan period. */
  quotaCurrent: number;
  actualFood: number;
  actualVodka: number;
  actualPop: number;
}

export interface ReportSubmission {
  /** Reported value for the primary quota resource. */
  reportedQuota: number;
  /** Reported value for the secondary resource. */
  reportedSecondary: number;
  /** Reported population. */
  reportedPop: number;
}

interface AnnualReportModalProps {
  data: AnnualReportData;
  onSubmit: (submission: ReportSubmission) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const DOCUMENT_FONT = { fontFamily: 'Courier New, monospace' } as const;

interface ReportCategory {
  key: string;
  label: string;
  actual: number;
  quota: number;
  unit: string;
  isPrimary: boolean;
}

function buildCategories(d: AnnualReportData): ReportCategory[] {
  const cats: ReportCategory[] = [];

  if (d.quotaType === 'food') {
    cats.push({
      key: 'quota',
      label: 'Food Production',
      actual: d.quotaCurrent,
      quota: d.quotaTarget,
      unit: 'units',
      isPrimary: true,
    });
    cats.push({
      key: 'secondary',
      label: 'Vodka Output',
      actual: d.actualVodka,
      quota: Math.round(d.actualVodka * 1.2) || 10,
      unit: 'liters',
      isPrimary: false,
    });
  } else {
    cats.push({
      key: 'quota',
      label: 'Vodka Production',
      actual: d.quotaCurrent,
      quota: d.quotaTarget,
      unit: 'liters',
      isPrimary: true,
    });
    cats.push({
      key: 'secondary',
      label: 'Food Output',
      actual: d.actualFood,
      quota: Math.round(d.actualFood * 1.2) || 10,
      unit: 'units',
      isPrimary: false,
    });
  }

  cats.push({
    key: 'pop',
    label: 'Population',
    actual: d.actualPop,
    quota: Math.max(d.actualPop + 20, Math.round(d.actualPop * 1.15)),
    unit: 'citizens',
    isPrimary: false,
  });

  return cats;
}

function calculateRisk(actual: number, reported: number): number {
  if (actual === 0 && reported === 0) return 0;
  if (actual === 0) return 100;
  return Math.round((Math.abs(reported - actual) / actual) * 100);
}

function riskColor(risk: number): string {
  if (risk === 0) return 'text-green-800';
  if (risk < 20) return 'text-yellow-800';
  return 'text-red-800';
}

function riskBg(risk: number): string {
  if (risk === 0) return 'bg-green-200';
  if (risk < 20) return 'bg-yellow-200';
  return 'bg-red-200';
}

function sliderStep(actual: number): number {
  if (actual < 50) return 1;
  if (actual < 500) return 5;
  if (actual < 5000) return 25;
  return 100;
}

function sliderRange(actual: number, quota: number): { min: number; max: number } {
  const min = Math.max(0, Math.round(actual * 0.5));
  const max = Math.max(Math.round(actual * 1.5), Math.round(quota * 1.2), actual + 10);
  return { min, max };
}

// ── Main modal ───────────────────────────────────────────────────────────

export function AnnualReportModal({ data, onSubmit }: AnnualReportModalProps) {
  const categories = useMemo(() => buildCategories(data), [data]);

  const [selections, setSelections] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const cat of categories) {
      init[cat.key] = cat.actual;
    }
    return init;
  });

  const isHonest = categories.every((cat) => selections[cat.key] === cat.actual);

  const handleSubmit = () => {
    onSubmit({
      reportedQuota: selections.quota ?? categories[0]!.actual,
      reportedSecondary: selections.secondary ?? categories[1]!.actual,
      reportedPop: selections.pop ?? categories[2]!.actual,
    });
  };

  return (
    <Transition appear show as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-sm bg-[#f4e8d0] shadow-2xl transition-all border-4 border-[#8b4513]">
                <div className="relative">
                  {/* Aged paper texture */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#000_2px,#000_4px)]" />

                  <div className="relative p-4 sm:p-8">
                    {/* Header */}
                    <div className="text-center mb-6 sm:mb-8 border-b-4 border-[#8b4513] pb-4 sm:pb-6">
                      <div className="flex justify-center items-center gap-4 mb-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-600 rounded-full flex items-center justify-center border-4 border-red-800">
                          <div className="text-yellow-400 text-2xl sm:text-3xl font-bold">
                            &#9773;
                          </div>
                        </div>
                      </div>
                      <h1
                        className="text-xl sm:text-3xl font-bold text-[#8b4513] mb-2"
                        style={DOCUMENT_FONT}
                      >
                        {
                          '\u0413\u041E\u0421\u0423\u0414\u0410\u0420\u0421\u0422\u0412\u0415\u041D\u041D\u042B\u0419 \u041E\u0422\u0427\u0415\u0422'
                        }
                      </h1>
                      <p className="text-sm sm:text-lg text-[#654321]" style={DOCUMENT_FONT}>
                        ANNUAL PRODUCTION REPORT &mdash; {data.year}
                      </p>
                      <p
                        className="text-xs sm:text-sm text-[#654321] mt-2 italic"
                        style={DOCUMENT_FONT}
                      >
                        Form No. 7-B/{String(data.year).slice(-2)} &bull; Classification: RESTRICTED
                      </p>
                    </div>

                    {/* Plan context */}
                    <div
                      className="mb-6 sm:mb-8 border-2 border-[#8b4513] bg-[#e8dcc0] p-3 sm:p-4"
                      style={DOCUMENT_FONT}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 text-[#654321]">
                        <p className="text-sm sm:text-base font-bold">
                          PRIMARY TARGET:{' '}
                          <span className="text-[#8b4513] uppercase">
                            {data.quotaType} PRODUCTION
                          </span>
                        </p>
                        <p className="text-sm sm:text-base font-bold">
                          QUOTA:{' '}
                          <span className="text-[#8b4513]">
                            {data.quotaTarget.toLocaleString()} units
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Report categories — card layout */}
                    <h2
                      className="text-sm sm:text-base font-bold text-[#8b4513] mb-3 uppercase tracking-wider"
                      style={DOCUMENT_FONT}
                    >
                      Production Report &mdash; Adjust Values
                    </h2>

                    <div className="mb-6 sm:mb-8 space-y-4">
                      {categories.map((cat) => {
                        const currentValue = selections[cat.key] ?? cat.actual;
                        const risk = calculateRisk(cat.actual, currentValue);
                        const range = sliderRange(cat.actual, cat.quota);
                        const step = sliderStep(cat.actual);

                        return (
                          <div
                            key={cat.key}
                            className={`border-2 p-3 sm:p-4 ${
                              cat.isPrimary
                                ? 'border-[#8b0000] bg-[#f4e0d0]'
                                : 'border-[#8b4513] bg-[#e8dcc0]'
                            }`}
                            style={DOCUMENT_FONT}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-[#654321] text-sm">
                                {cat.isPrimary && (
                                  <span className="text-[#8b0000] mr-1">&#9733;</span>
                                )}
                                {cat.label}
                              </span>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded ${riskColor(risk)} ${riskBg(risk)}`}
                              >
                                Risk: {Math.min(risk, 100)}%
                              </span>
                            </div>

                            <div className="flex justify-between text-xs text-[#654321] mb-2">
                              <span>
                                Actual: {cat.actual.toLocaleString()} {cat.unit}
                              </span>
                              <span className="font-bold">
                                Quota: {cat.quota.toLocaleString()} {cat.unit}
                              </span>
                            </div>

                            <div className="text-center text-lg font-bold text-[#654321] mb-2">
                              {currentValue.toLocaleString()} {cat.unit}
                            </div>

                            <Slider
                              value={[currentValue]}
                              onValueChange={(value) =>
                                setSelections((prev) => ({
                                  ...prev,
                                  [cat.key]: value[0]!,
                                }))
                              }
                              min={range.min}
                              max={range.max}
                              step={step}
                              className="w-full"
                            />

                            <div className="flex justify-between text-[10px] text-[#654321] mt-1">
                              <span>{range.min.toLocaleString()}</span>
                              <span className="font-bold">
                                Actual: {cat.actual.toLocaleString()}
                              </span>
                              <span>{range.max.toLocaleString()}</span>
                            </div>

                            {cat.isPrimary && (
                              <div className="text-[10px] text-[#8b0000] mt-1 font-bold uppercase">
                                Primary directive &mdash; falsification carries severe consequences
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Warning box */}
                    <div
                      className="mb-4 sm:mb-6 border-2 border-red-700 bg-red-50/60 p-3 sm:p-4"
                      style={DOCUMENT_FONT}
                    >
                      <p className="text-xs sm:text-sm text-red-800 font-bold mb-1 uppercase tracking-wider">
                        Warning:
                      </p>
                      <p className="text-xs sm:text-sm text-red-800">
                        False reporting (&laquo;pripiski&raquo;) may trigger an investigation by the
                        State Committee for Plan Compliance. Higher deviations increase risk.
                      </p>
                    </div>

                    {/* Submit buttons */}
                    <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 pt-4 sm:pt-6 border-t-4 border-[#8b4513]">
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!isHonest}
                        className={`px-6 sm:px-8 py-3 font-bold rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all border-2 min-h-[44px] flex items-center justify-center gap-2 ${
                          isHonest
                            ? 'bg-green-700 text-white border-green-900 cursor-pointer'
                            : 'bg-gray-400 text-gray-600 border-gray-500 cursor-not-allowed opacity-50'
                        }`}
                        style={DOCUMENT_FONT}
                      >
                        <FileText size={18} />
                        <div>
                          <div className="text-sm sm:text-base">SUBMIT HONEST REPORT</div>
                          <div className="text-[10px]">(Safe &mdash; No Investigation Risk)</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isHonest}
                        className={`px-6 sm:px-8 py-3 font-bold rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all border-2 min-h-[44px] flex items-center justify-center gap-2 ${
                          !isHonest
                            ? 'bg-red-700 text-white border-red-900 cursor-pointer'
                            : 'bg-gray-400 text-gray-600 border-gray-500 cursor-not-allowed opacity-50'
                        }`}
                        style={DOCUMENT_FONT}
                      >
                        <Star size={18} />
                        <div>
                          <div className="text-sm sm:text-base">SUBMIT MODIFIED REPORT</div>
                          <div className="text-[10px]">(Risky &mdash; Consequences Possible)</div>
                        </div>
                      </button>
                    </div>

                    {/* Approval stamp */}
                    <div className="mt-6 flex justify-end">
                      <div className="inline-block transform -rotate-12 bg-red-600 text-white px-6 py-2 rounded-full border-4 border-red-800 shadow-lg">
                        <span
                          className="text-base sm:text-lg font-bold tracking-wider"
                          style={DOCUMENT_FONT}
                        >
                          &#9733; {'\u0423\u0422\u0412\u0415\u0420\u0416\u0414\u0415\u041D\u041E'}{' '}
                          &#9733;
                        </span>
                      </div>
                    </div>

                    {/* Fine print */}
                    <div
                      className="mt-6 text-[10px] sm:text-xs text-[#654321] text-center leading-relaxed"
                      style={DOCUMENT_FONT}
                    >
                      <p>
                        All reports are subject to verification by the State Committee for Plan
                        Compliance. Discrepancies will be noted in your personnel file.
                      </p>
                      <p className="mt-1 font-bold">
                        Serve the State with honesty&hellip; or cunning.
                      </p>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
