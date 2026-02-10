import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { AnnualReportModal } from '@/prototypes/AnnualReportModal';
import { SovietToastDemo } from '@/prototypes/SovietToastStack';
import { SovietGameHUDDemo } from '@/prototypes/SovietGameHUD';
import { RadialBuildMenuDemo } from '@/prototypes/RadialBuildMenu';
import { FiveYearPlanModal } from '@/prototypes/FiveYearPlanModal';
import { SettlementUpgradeModal } from '@/prototypes/SettlementUpgradeModal';

type PrototypeName =
  | 'annual-report'
  | 'notifications'
  | 'game-hud'
  | 'toolbar'
  | 'five-year-plan'
  | 'settlement-upgrade'
  | null;

const BACK_BUTTON =
  'fixed top-3 left-3 z-[999] bg-[#2d2a2a] border-2 border-[#8a1c1c] text-[#cfaa48] px-3 py-2 text-sm hover:bg-[#3a3535] transition-colors min-h-[44px]';

interface ProtoCard {
  id: PrototypeName;
  title: string;
  desc: string;
  status: 'approved' | 'review';
}

const CARDS: ProtoCard[] = [
  {
    id: 'annual-report',
    title: 'Annual Report (Pripiski)',
    desc: 'Bureaucratic form where player falsifies statistics. Slider-based value adjustment with risk indicators.',
    status: 'approved',
  },
  {
    id: 'notifications',
    title: 'Notification Toasts',
    desc: 'Three severity levels (warning/critical/evacuation) with directional arrows, auto-dismiss, and cascade.',
    status: 'approved',
  },
  {
    id: 'game-hud',
    title: 'Game HUD + Hamburger Drawer',
    desc: 'Full-screen layout: top resource bar, speed controls, bottom info strip, and hamburger slide-out drawer.',
    status: 'approved',
  },
  {
    id: 'toolbar',
    title: 'Radial Build Menu',
    desc: 'Tap grid to open pie menu. Inner ring: categories. Outer ring: buildings. Greyed out if it won\'t fit.',
    status: 'approved',
  },
  {
    id: 'five-year-plan',
    title: '5-Year Plan Directive',
    desc: 'Moscow assigns impossible quotas. Parchment decree with quota table, consequences, and mandatory acceptance.',
    status: 'approved',
  },
  {
    id: 'settlement-upgrade',
    title: 'Settlement Upgrade Ceremony',
    desc: 'Dramatic decree when your settlement tiers up. Animated stamp, unlock list, title change.',
    status: 'approved',
  },
];

function FullScreenProto({
  children,
  onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className={BACK_BUTTON}
        style={{ fontFamily: "'VT323', monospace" }}
      >
        &larr; BACK TO GALLERY
      </button>
      {children}
    </div>
  );
}

function PrototypeViewer() {
  const [active, setActive] = useState<PrototypeName>(null);
  const back = () => setActive(null);

  // Full-screen prototypes
  if (active === 'notifications')
    return (
      <FullScreenProto onBack={back}>
        <SovietToastDemo />
      </FullScreenProto>
    );
  if (active === 'game-hud')
    return (
      <FullScreenProto onBack={back}>
        <SovietGameHUDDemo />
      </FullScreenProto>
    );
  if (active === 'toolbar')
    return (
      <FullScreenProto onBack={back}>
        <RadialBuildMenuDemo />
      </FullScreenProto>
    );

  // Gallery
  return (
    <div
      className="min-h-screen bg-[#1a1818] text-[#dcdcdc] p-4"
      style={{ fontFamily: "'VT323', monospace" }}
    >
      <h1 className="text-3xl text-[#cfaa48] mb-2">
        ☭ SIMSOVET 2000 — UI PROTOTYPES
      </h1>
      <p className="text-sm text-[#888] mb-8">
        Click a prototype to view it. Resize browser to test mobile
        responsiveness.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <button
            key={card.id}
            onClick={() => setActive(card.id)}
            className="bg-[#2d2a2a] border-2 border-[#8a1c1c] p-4 text-left hover:bg-[#3a3535] transition-colors min-h-[100px]"
          >
            <div className="text-[#cfaa48] text-lg mb-1">{card.title}</div>
            <div className="text-[#888] text-sm">{card.desc}</div>
            <div
              className={`text-xs mt-2 ${card.status === 'approved' ? 'text-green-500' : 'text-[#8a1c1c]'}`}
            >
              {card.status === 'approved'
                ? 'Status: APPROVED \u2713'
                : 'Status: Ready for review'}
            </div>
          </button>
        ))}
      </div>

      {/* Modal prototypes render as overlays */}
      {active === 'annual-report' && (
        <AnnualReportModal onClose={back} />
      )}
      {active === 'five-year-plan' && (
        <FiveYearPlanModal onClose={back} />
      )}
      {active === 'settlement-upgrade' && (
        <SettlementUpgradeModal onClose={back} />
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <PrototypeViewer />
  </React.StrictMode>,
);
