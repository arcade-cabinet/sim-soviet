/**
 * FiveYearPlanModal — directive announcing a new 5-year plan.
 *
 * Shown at game start and when a quota transitions (met → new target).
 * Parchment-themed document showing current resource levels, the new
 * quota target, plan period, and consequences. Player must accept.
 *
 * Adapted from approved prototype (src/prototypes/FiveYearPlanModal.tsx).
 */
import { Dialog, Transition } from '@headlessui/react';
import { Hammer, Star } from 'lucide-react';
import { Fragment } from 'react';

// ── Types ────────────────────────────────────────────────────────────────

export interface PlanDirective {
  quotaType: 'food' | 'vodka';
  quotaTarget: number;
  startYear: number;
  endYear: number;
  /** Current resource snapshot for context */
  currentFood: number;
  currentVodka: number;
  currentPop: number;
  currentPower: number;
  currentMoney: number;
}

interface FiveYearPlanModalProps {
  directive: PlanDirective;
  onAccept: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const DOCUMENT_FONT = { fontFamily: 'Courier New, monospace' } as const;

interface QuotaRow {
  category: string;
  current: number;
  target: number;
  unit: string;
  isActive: boolean;
}

function buildQuotaRows(d: PlanDirective): QuotaRow[] {
  const rows: QuotaRow[] = [];
  if (d.quotaType === 'food') {
    rows.push({
      category: 'Food Production',
      current: d.currentFood,
      target: d.quotaTarget,
      unit: 'units',
      isActive: true,
    });
    rows.push({
      category: 'Vodka Output',
      current: d.currentVodka,
      target: Math.round(d.quotaTarget * 0.3),
      unit: 'liters',
      isActive: false,
    });
  } else {
    rows.push({
      category: 'Vodka Production',
      current: d.currentVodka,
      target: d.quotaTarget,
      unit: 'liters',
      isActive: true,
    });
    rows.push({
      category: 'Food Output',
      current: d.currentFood,
      target: Math.round(d.quotaTarget * 0.8),
      unit: 'units',
      isActive: false,
    });
  }
  rows.push(
    {
      category: 'Population',
      current: d.currentPop,
      target: Math.max(d.currentPop + 50, Math.round(d.currentPop * 1.3)),
      unit: 'citizens',
      isActive: false,
    },
    {
      category: 'Power Supply',
      current: d.currentPower,
      target: Math.max(d.currentPower + 100, Math.round(d.currentPower * 1.5)),
      unit: 'kW',
      isActive: false,
    }
  );
  return rows;
}

function increasePercent(current: number, target: number): number {
  if (current <= 0) return target > 0 ? 999 : 0;
  return Math.round(((target - current) / current) * 100);
}

function increaseColor(pct: number): string {
  if (pct < 50) return 'text-green-700';
  if (pct <= 100) return 'text-yellow-700';
  return 'text-red-700';
}

function increaseBadgeBg(pct: number): string {
  if (pct < 50) return 'bg-green-100';
  if (pct <= 100) return 'bg-yellow-100';
  return 'bg-red-100';
}

// ── Main modal ───────────────────────────────────────────────────────────

export function FiveYearPlanModal({ directive, onAccept }: FiveYearPlanModalProps) {
  const rows = buildQuotaRows(directive);

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
                          '\u041F\u042F\u0422\u0418\u041B\u0415\u0422\u041D\u0418\u0419 \u041F\u041B\u0410\u041D'
                        }
                      </h1>
                      <p className="text-sm sm:text-lg text-[#654321]" style={DOCUMENT_FONT}>
                        FIVE-YEAR PLAN DIRECTIVE &mdash; CLASSIFIED
                      </p>
                      <p
                        className="text-xs sm:text-sm text-[#654321] mt-2 italic"
                        style={DOCUMENT_FONT}
                      >
                        By order of the State Planning Committee (Gosplan)
                      </p>
                    </div>

                    {/* Plan period */}
                    <div
                      className="mb-6 sm:mb-8 border-2 border-[#8b4513] bg-[#e8dcc0] p-3 sm:p-4"
                      style={DOCUMENT_FONT}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 text-[#654321]">
                        <p className="text-sm sm:text-base font-bold">
                          PLAN PERIOD:{' '}
                          <span className="text-[#8b4513]">
                            {directive.startYear} &ndash; {directive.endYear}
                          </span>
                        </p>
                        <p className="text-sm sm:text-base font-bold">
                          PRIMARY TARGET:{' '}
                          <span className="text-[#8b4513] uppercase">
                            {directive.quotaType} PRODUCTION
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Quota table heading */}
                    <h2
                      className="text-sm sm:text-base font-bold text-[#8b4513] mb-3 uppercase tracking-wider"
                      style={DOCUMENT_FONT}
                    >
                      Production Quotas
                    </h2>

                    {/* Mobile card layout */}
                    <div className="mb-6 sm:mb-8 space-y-3">
                      {rows.map((row) => {
                        const pct = increasePercent(row.current, row.target);
                        return (
                          <div
                            key={row.category}
                            className={`border-2 p-3 ${
                              row.isActive
                                ? 'border-[#8b0000] bg-[#f4e0d0]'
                                : 'border-[#8b4513] bg-[#e8dcc0]'
                            }`}
                            style={DOCUMENT_FONT}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-[#654321] text-sm">
                                {row.isActive && (
                                  <span className="text-[#8b0000] mr-1">&#9733;</span>
                                )}
                                {row.category}
                              </span>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded ${increaseColor(pct)} ${increaseBadgeBg(pct)}`}
                              >
                                +{Math.min(pct, 999)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-[#654321]">
                              <span>
                                Current: {row.current.toLocaleString()} {row.unit}
                              </span>
                              <span className="font-bold">
                                Target: {row.target.toLocaleString()} {row.unit}
                              </span>
                            </div>
                            {row.isActive && (
                              <div className="text-[10px] text-[#8b0000] mt-1 font-bold uppercase">
                                Primary directive — failure has consequences
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Consequences */}
                    <div
                      className="mb-4 sm:mb-6 border-2 border-red-700 bg-red-50/60 p-3 sm:p-4"
                      style={DOCUMENT_FONT}
                    >
                      <p className="text-xs sm:text-sm text-red-800 font-bold mb-1 uppercase tracking-wider">
                        Failure to Meet Targets:
                      </p>
                      <p className="text-xs sm:text-sm text-red-800">
                        Investigation by the State Committee for Plan Compliance. Repeated failure:
                        reassignment to corrective labor facility.
                      </p>
                    </div>

                    {/* Rewards */}
                    <div
                      className="mb-6 sm:mb-8 border-2 border-green-700 bg-green-50/60 p-3 sm:p-4"
                      style={DOCUMENT_FONT}
                    >
                      <p className="text-xs sm:text-sm text-green-800 font-bold mb-1 uppercase tracking-wider">
                        Exceeding Targets (+10%):
                      </p>
                      <p className="text-xs sm:text-sm text-green-800">
                        Commendation in your personnel file. Reduced scrutiny from the Politburo.
                      </p>
                    </div>

                    {/* Accept button */}
                    <div className="flex flex-col items-center pt-4 sm:pt-6 border-t-4 border-[#8b4513]">
                      <button
                        type="button"
                        onClick={onAccept}
                        className="px-8 sm:px-12 py-3 sm:py-4 font-bold rounded-sm bg-red-700 text-white border-2 border-red-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all min-h-[44px] flex items-center gap-2 cursor-pointer"
                        style={DOCUMENT_FONT}
                      >
                        <Hammer size={20} />
                        <span className="text-base sm:text-lg">ACCEPT DIRECTIVE</span>
                        <Star size={20} className="text-yellow-400" />
                      </button>
                      <p className="text-[10px] text-[#654321] mt-2 italic" style={DOCUMENT_FONT}>
                        (Refusal is not an option)
                      </p>
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
                        This directive supersedes all previous plans. All resources of the
                        collective are hereby requisitioned for plan fulfillment.
                      </p>
                      <p className="mt-1 font-bold">Glory to the Workers&apos; State.</p>
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
