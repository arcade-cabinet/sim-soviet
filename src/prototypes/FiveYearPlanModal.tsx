import { Dialog, Transition } from '@headlessui/react';
import { Hammer, Star } from 'lucide-react';
import type React from 'react';
import { Fragment, useState } from 'react';
import { cn } from '@/lib/utils';

interface QuotaRow {
  category: string;
  current: number;
  target: number;
  unit: string;
}

const QUOTA_DATA: QuotaRow[] = [
  { category: 'Grain Production', current: 8500, target: 14000, unit: 'tons' },
  {
    category: 'Industrial Output',
    current: 12000,
    target: 22000,
    unit: 'units',
  },
  { category: 'Housing Capacity', current: 200, target: 500, unit: 'beds' },
  { category: 'Power Generation', current: 500, target: 1200, unit: 'kW' },
  {
    category: 'Population Growth',
    current: 1247,
    target: 2500,
    unit: 'citizens',
  },
  {
    category: 'Vodka Production',
    current: 400,
    target: 800,
    unit: 'liters',
  },
];

const DOCUMENT_FONT = { fontFamily: 'Courier New, monospace' } as const;

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

export const FiveYearPlanModal: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleAccept = () => {
    setIsOpen(false);
    onClose?.();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
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
                  {/* Aged paper texture overlay */}
                  <div className="absolute inset-0 opacity-10 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#000_2px,#000_4px)]" />

                  <div className="relative p-4 sm:p-8">
                    {/* ===== HEADER ===== */}
                    <div className="text-center mb-6 sm:mb-8 border-b-4 border-[#8b4513] pb-4 sm:pb-6">
                      <div className="flex justify-center items-center gap-4 mb-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-600 rounded-full flex items-center justify-center border-4 border-red-800">
                          <div className="text-yellow-400 text-2xl sm:text-3xl font-bold">☭</div>
                        </div>
                      </div>
                      <h1
                        className="text-xl sm:text-3xl font-bold text-[#8b4513] mb-2"
                        style={DOCUMENT_FONT}
                      >
                        ПЯТИЛЕТНИЙ ПЛАН
                      </h1>
                      <p className="text-sm sm:text-lg text-[#654321]" style={DOCUMENT_FONT}>
                        DIRECTIVE No. 12-A/1953 &mdash; CLASSIFIED
                      </p>
                      <p
                        className="text-xs sm:text-sm text-[#654321] mt-2 italic"
                        style={DOCUMENT_FONT}
                      >
                        By order of the State Planning Committee (Gosplan)
                      </p>
                    </div>

                    {/* ===== PLAN PERIOD ===== */}
                    <div
                      className="mb-6 sm:mb-8 border-2 border-[#8b4513] bg-[#e8dcc0] p-3 sm:p-4"
                      style={DOCUMENT_FONT}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 text-[#654321]">
                        <p className="text-sm sm:text-base font-bold">
                          PLAN PERIOD: <span className="text-[#8b4513]">1953 &ndash; 1958</span>
                        </p>
                        <p className="text-sm sm:text-base font-bold">
                          ASSIGNED TO:{' '}
                          <span className="text-[#8b4513]">
                            Collective Zarya, Sverdlovsk Oblast
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* ===== QUOTA TABLE (desktop) ===== */}
                    <div className="mb-6 sm:mb-8">
                      <h2
                        className="text-sm sm:text-base font-bold text-[#8b4513] mb-3 uppercase tracking-wider"
                        style={DOCUMENT_FONT}
                      >
                        Production Quotas
                      </h2>

                      {/* Desktop table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full border-2 border-[#8b4513]" style={DOCUMENT_FONT}>
                          <thead>
                            <tr className="bg-[#d4c4a0] border-b-2 border-[#8b4513]">
                              <th className="px-4 py-3 text-left text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                CATEGORY
                              </th>
                              <th className="px-4 py-3 text-center text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                CURRENT
                              </th>
                              <th className="px-4 py-3 text-center text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                TARGET
                              </th>
                              <th className="px-4 py-3 text-center text-[#654321] font-bold">
                                INCREASE
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {QUOTA_DATA.map((row, idx) => {
                              const pct = increasePercent(row.current, row.target);
                              return (
                                <tr
                                  key={row.category}
                                  className={cn(
                                    'border-b-2 border-[#8b4513]',
                                    idx % 2 === 0 ? 'bg-[#f4e8d0]' : 'bg-[#e8dcc0]'
                                  )}
                                >
                                  <td className="px-4 py-3 text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                    {row.category}
                                  </td>
                                  <td className="px-4 py-3 text-center text-[#654321] border-r-2 border-[#8b4513]">
                                    {row.current.toLocaleString()} {row.unit}
                                  </td>
                                  <td className="px-4 py-3 text-center text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                    {row.target.toLocaleString()} {row.unit}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={cn(
                                        'font-bold px-2 py-1 rounded',
                                        increaseColor(pct),
                                        increaseBadgeBg(pct)
                                      )}
                                    >
                                      +{pct}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile card layout */}
                      <div className="sm:hidden space-y-3">
                        {QUOTA_DATA.map((row) => {
                          const pct = increasePercent(row.current, row.target);
                          return (
                            <div
                              key={row.category}
                              className="border-2 border-[#8b4513] bg-[#e8dcc0] p-3"
                              style={DOCUMENT_FONT}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-[#654321] text-sm">
                                  {row.category}
                                </span>
                                <span
                                  className={cn(
                                    'text-xs font-bold px-2 py-0.5 rounded',
                                    increaseColor(pct),
                                    increaseBadgeBg(pct)
                                  )}
                                >
                                  +{pct}%
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
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ===== CONSEQUENCES ===== */}
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

                    {/* ===== REWARDS ===== */}
                    <div
                      className="mb-6 sm:mb-8 border-2 border-green-700 bg-green-50/60 p-3 sm:p-4"
                      style={DOCUMENT_FONT}
                    >
                      <p className="text-xs sm:text-sm text-green-800 font-bold mb-1 uppercase tracking-wider">
                        Exceeding Targets:
                      </p>
                      <p className="text-xs sm:text-sm text-green-800">
                        Order of the Red Banner of Labour. Additional resource allocation for next
                        period.
                      </p>
                    </div>

                    {/* ===== ACCEPT BUTTON ===== */}
                    <div className="flex flex-col items-center pt-4 sm:pt-6 border-t-4 border-[#8b4513]">
                      <button
                        type="button"
                        onClick={handleAccept}
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

                    {/* ===== APPROVAL STAMP ===== */}
                    <div className="mt-6 flex justify-end">
                      <div className="inline-block transform -rotate-12 bg-red-600 text-white px-6 py-2 rounded-full border-4 border-red-800 shadow-lg">
                        <span
                          className="text-base sm:text-lg font-bold tracking-wider"
                          style={DOCUMENT_FONT}
                        >
                          ★ УТВЕРЖДЕНО ★
                        </span>
                      </div>
                    </div>

                    {/* ===== FINE PRINT ===== */}
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
};
