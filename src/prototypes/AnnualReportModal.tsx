import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import type React from 'react';
import { Fragment, useState } from 'react';
import { Slider } from '@/components/ui/Slider';

interface ReportRow {
  category: string;
  actual: number;
  quota: number;
  unit: string;
}

interface ReportSelection {
  grain: number;
  industrial: number;
  population: number;
}

export const AnnualReportModal: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [selections, setSelections] = useState<ReportSelection>({
    grain: 8500,
    industrial: 12000,
    population: 45000,
  });

  const reportData: ReportRow[] = [
    { category: 'grain', actual: 8500, quota: 10000, unit: 'tons' },
    { category: 'industrial', actual: 12000, quota: 15000, unit: 'units' },
    { category: 'population', actual: 45000, quota: 50000, unit: 'citizens' },
  ];

  const calculateRisk = (actual: number, reported: number): number => {
    if (reported === actual) return 0;
    const deviation = Math.abs(reported - actual) / actual;
    return Math.round(deviation * 100);
  };

  const handleSliderChange = (category: string, value: number[]) => {
    setSelections((prev) => ({
      ...prev,
      [category]: value[0],
    }));
  };

  const isHonestReport = () => {
    return reportData.every(
      (row) => selections[row.category as keyof ReportSelection] === row.actual
    );
  };

  const handleSubmit = (isHonest: boolean) => {
    const action = isHonest ? 'HONEST REPORT' : 'MODIFIED REPORT';
    console.log(`Submitting ${action}:`, selections);
    setIsOpen(false);
    onClose?.();
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                    <button
                      onClick={handleClose}
                      className="absolute top-4 right-4 text-[#8b4513] hover:text-[#654321] transition-colors"
                    >
                      <X size={24} />
                    </button>

                    {/* Header with Soviet emblem */}
                    <div className="text-center mb-6 sm:mb-8 border-b-4 border-[#8b4513] pb-4 sm:pb-6">
                      <div className="flex justify-center items-center gap-4 mb-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-600 rounded-full flex items-center justify-center">
                          <div className="text-yellow-400 text-2xl sm:text-3xl font-bold">☭</div>
                        </div>
                      </div>
                      <h1
                        className="text-xl sm:text-3xl font-bold text-[#8b4513] mb-2"
                        style={{ fontFamily: 'Courier New, monospace' }}
                      >
                        ГОСУДАРСТВЕННЫЙ ОТЧЕТ
                      </h1>
                      <p
                        className="text-sm sm:text-lg text-[#654321]"
                        style={{ fontFamily: 'Courier New, monospace' }}
                      >
                        ANNUAL PRODUCTION REPORT - 1952
                      </p>
                      <p
                        className="text-xs sm:text-sm text-[#654321] mt-2"
                        style={{ fontFamily: 'Courier New, monospace' }}
                      >
                        Form No. 7-B/52 &bull; Classification: RESTRICTED
                      </p>
                    </div>

                    {/* Report rows */}
                    <div className="mb-6 sm:mb-8">
                      <div className="space-y-4 sm:space-y-0">
                        {/* Desktop: table layout */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table
                            className="w-full border-2 border-[#8b4513]"
                            style={{ fontFamily: 'Courier New, monospace' }}
                          >
                            <thead>
                              <tr className="bg-[#d4c4a0] border-b-2 border-[#8b4513]">
                                <th className="px-4 py-3 text-left text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                  CATEGORY
                                </th>
                                <th className="px-4 py-3 text-center text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                  ACTUAL
                                </th>
                                <th className="px-4 py-3 text-center text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                  QUOTA
                                </th>
                                <th className="px-4 py-3 text-center text-[#654321] font-bold">
                                  REPORTED VALUE
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportData.map((row, idx) => {
                                const currentValue =
                                  selections[row.category as keyof ReportSelection];
                                const minValue = Math.round(row.actual * 0.5);
                                const maxValue = Math.round(row.actual * 1.5);
                                const risk = calculateRisk(row.actual, currentValue);

                                return (
                                  <tr
                                    key={row.category}
                                    className={`border-b-2 border-[#8b4513] ${
                                      idx % 2 === 0 ? 'bg-[#f4e8d0]' : 'bg-[#e8dcc0]'
                                    }`}
                                  >
                                    <td className="px-4 py-4 text-[#654321] font-bold uppercase border-r-2 border-[#8b4513]">
                                      {row.category}
                                    </td>
                                    <td className="px-4 py-4 text-center text-[#654321] border-r-2 border-[#8b4513]">
                                      {row.actual.toLocaleString()} {row.unit}
                                    </td>
                                    <td className="px-4 py-4 text-center text-[#654321] font-bold border-r-2 border-[#8b4513]">
                                      {row.quota.toLocaleString()} {row.unit}
                                    </td>
                                    <td className="px-4 py-6">
                                      <div className="flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                          <span className="text-lg font-bold text-[#654321]">
                                            {currentValue.toLocaleString()} {row.unit}
                                          </span>
                                          <span
                                            className={`text-sm font-bold px-2 py-1 rounded ${
                                              risk === 0
                                                ? 'bg-green-200 text-green-800'
                                                : risk < 20
                                                  ? 'bg-yellow-200 text-yellow-800'
                                                  : 'bg-red-200 text-red-800'
                                            }`}
                                          >
                                            Risk: {risk}%
                                          </span>
                                        </div>
                                        <Slider
                                          value={[currentValue]}
                                          onValueChange={(value) =>
                                            handleSliderChange(row.category, value)
                                          }
                                          min={minValue}
                                          max={maxValue}
                                          step={100}
                                          className="w-full"
                                        />
                                        <div className="flex justify-between text-xs text-[#654321]">
                                          <span>{minValue.toLocaleString()}</span>
                                          <span className="font-bold">
                                            Actual: {row.actual.toLocaleString()}
                                          </span>
                                          <span>{maxValue.toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile: card layout */}
                        <div className="sm:hidden space-y-4">
                          {reportData.map((row) => {
                            const currentValue = selections[row.category as keyof ReportSelection];
                            const minValue = Math.round(row.actual * 0.5);
                            const maxValue = Math.round(row.actual * 1.5);
                            const risk = calculateRisk(row.actual, currentValue);

                            return (
                              <div
                                key={row.category}
                                className="border-2 border-[#8b4513] bg-[#e8dcc0] p-3"
                                style={{
                                  fontFamily: 'Courier New, monospace',
                                }}
                              >
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-bold text-[#654321] uppercase text-sm">
                                    {row.category}
                                  </span>
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                                      risk === 0
                                        ? 'bg-green-200 text-green-800'
                                        : risk < 20
                                          ? 'bg-yellow-200 text-yellow-800'
                                          : 'bg-red-200 text-red-800'
                                    }`}
                                  >
                                    Risk: {risk}%
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs text-[#654321] mb-2">
                                  <span>Actual: {row.actual.toLocaleString()}</span>
                                  <span className="font-bold">
                                    Quota: {row.quota.toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-center text-lg font-bold text-[#654321] mb-2">
                                  {currentValue.toLocaleString()} {row.unit}
                                </div>
                                <Slider
                                  value={[currentValue]}
                                  onValueChange={(value) => handleSliderChange(row.category, value)}
                                  min={minValue}
                                  max={maxValue}
                                  step={100}
                                  className="w-full"
                                />
                                <div className="flex justify-between text-[10px] text-[#654321] mt-1">
                                  <span>{minValue.toLocaleString()}</span>
                                  <span>{maxValue.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Submit buttons */}
                    <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 pt-4 sm:pt-6 border-t-4 border-[#8b4513]">
                      <button
                        onClick={() => handleSubmit(true)}
                        disabled={!isHonestReport()}
                        className={`px-6 sm:px-8 py-3 font-bold rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all border-2 min-h-[44px] ${
                          isHonestReport()
                            ? 'bg-green-700 text-white border-green-900 cursor-pointer'
                            : 'bg-gray-400 text-gray-600 border-gray-500 cursor-not-allowed opacity-50'
                        }`}
                        style={{ fontFamily: 'Courier New, monospace' }}
                      >
                        SUBMIT HONEST REPORT
                        <div className="text-xs mt-1">(Safe - No Risk)</div>
                      </button>
                      <button
                        onClick={() => handleSubmit(false)}
                        disabled={isHonestReport()}
                        className={`px-6 sm:px-8 py-3 font-bold rounded-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all border-2 min-h-[44px] ${
                          !isHonestReport()
                            ? 'bg-red-700 text-white border-red-900 cursor-pointer'
                            : 'bg-gray-400 text-gray-600 border-gray-500 cursor-not-allowed opacity-50'
                        }`}
                        style={{ fontFamily: 'Courier New, monospace' }}
                      >
                        SUBMIT MODIFIED REPORT
                        <div className="text-xs mt-1">(Risky - Consequences Possible)</div>
                      </button>
                    </div>

                    {/* Approval stamp */}
                    <div className="mt-6 text-center">
                      <div className="inline-block transform -rotate-12 bg-red-600 text-white px-6 py-2 rounded-full border-4 border-red-800 shadow-lg">
                        <span
                          className="text-lg font-bold"
                          style={{ fontFamily: 'Courier New, monospace' }}
                        >
                          ★ APPROVED ★
                        </span>
                      </div>
                    </div>

                    {/* Fine print */}
                    <div
                      className="mt-6 text-xs text-[#654321] text-center"
                      style={{ fontFamily: 'Courier New, monospace' }}
                    >
                      <p>WARNING: False reporting may result in consequences.</p>
                      <p className="mt-1">
                        All reports are subject to verification by the State Committee.
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
};
