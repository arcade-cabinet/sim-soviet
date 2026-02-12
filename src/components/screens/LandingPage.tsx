/**
 * LandingPage — Tabbed dossier main menu for SimSoviet 2000.
 *
 * Manila-folder tabbed interface matching Soviet bureaucratic aesthetic.
 * Four tabs: New Game | Load | Settings | Credits
 *
 * Uses parchment (light) theme tokens for the document/dossier feel,
 * with concrete (dark) accent for the manila folder tabs.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Folder, Info, Settings, Star } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { LOADING_QUOTES } from '@/content/worldbuilding';
import { accent, concrete, DOCUMENT_FONT, parchment, SOVIET_FONT } from '@/design/tokens';
import { cn } from '@/lib/utils';

export interface LandingPageProps {
  onNewGame: () => void;
  onContinue: () => void;
  onLoadGame: () => void;
  hasSavedGame: boolean;
}

type Tab = 'new' | 'load' | 'settings' | 'credits';

const TABS: { id: Tab; label: string; icon: typeof Star }[] = [
  { id: 'new', label: 'NEW GAME', icon: Star },
  { id: 'load', label: 'LOAD', icon: Folder },
  { id: 'settings', label: 'SETTINGS', icon: Settings },
  { id: 'credits', label: 'CREDITS', icon: Info },
];

export function LandingPage({ onNewGame, onContinue, onLoadGame, hasSavedGame }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('new');
  const quote = useMemo(
    () => LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)]!,
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-30 flex flex-col items-center justify-center px-3 py-4"
      style={{
        fontFamily: SOVIET_FONT,
        background: `radial-gradient(ellipse at center, ${concrete.surface.panel} 0%, ${concrete.surface.deep} 70%)`,
      }}
    >
      {/* Header — title + star */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-center mb-4"
      >
        <div className="flex items-center justify-center gap-3 mb-1">
          <Star className="w-5 h-5" style={{ color: accent.gold }} fill={accent.gold} />
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-[0.2em] uppercase"
            style={{ color: accent.redText }}
          >
            SIMSOVET 2000
          </h1>
          <Star className="w-5 h-5" style={{ color: accent.gold }} fill={accent.gold} />
        </div>
        <div className="w-48 sm:w-64 h-0.5 mx-auto" style={{ background: accent.gold }} />
      </motion.div>

      {/* Dossier card with manila-folder tabs */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="w-full max-w-lg"
      >
        {/* Tab bar — manila folder tabs */}
        <div className="flex">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-t-2 border-x',
                  active ? 'border-b-0 relative z-10' : 'border-b-2 hover:brightness-110'
                )}
                style={{
                  fontFamily: SOVIET_FONT,
                  background: active ? parchment.surface.paper : concrete.surface.panel,
                  borderColor: active ? parchment.border.primary : concrete.border.subtle,
                  color: active ? parchment.text.primary : concrete.text.muted,
                  // Tab shape: rounded top corners
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                  // Active tab overlaps the content border
                  marginBottom: active ? '-2px' : '0',
                  paddingBottom: active ? 'calc(0.5rem + 2px)' : '0.5rem',
                }}
              >
                <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content — parchment dossier body */}
        <div
          className="border-2 border-t-2 min-h-[280px] max-h-[50vh] overflow-y-auto"
          data-testid="dossier-content"
          style={{
            background: parchment.surface.paper,
            borderColor: parchment.border.primary,
            color: parchment.text.primary,
            fontFamily: DOCUMENT_FONT,
          }}
        >
          <AnimatePresence mode="wait">
            {activeTab === 'new' && (
              <TabContent key="new">
                <NewGameTab
                  onNewGame={onNewGame}
                  onContinue={onContinue}
                  hasSavedGame={hasSavedGame}
                />
              </TabContent>
            )}
            {activeTab === 'load' && (
              <TabContent key="load">
                <LoadTab
                  onLoadGame={onLoadGame}
                  onContinue={onContinue}
                  hasSavedGame={hasSavedGame}
                />
              </TabContent>
            )}
            {activeTab === 'settings' && (
              <TabContent key="settings">
                <SettingsTab />
              </TabContent>
            )}
            {activeTab === 'credits' && (
              <TabContent key="credits">
                <CreditsTab />
              </TabContent>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Bottom quote */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.8 }}
        className="mt-4 text-center text-xs italic max-w-md leading-relaxed"
        style={{ color: concrete.text.muted, fontFamily: DOCUMENT_FONT }}
      >
        &ldquo;{quote}&rdquo;
      </motion.p>
    </motion.div>
  );
}

// ── Tab animation wrapper ─────────────────────────────────

function TabContent({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="p-4 sm:p-5"
    >
      {children}
    </motion.div>
  );
}

// ── Tab: New Game ─────────────────────────────────────────

function NewGameTab({
  onNewGame,
  onContinue,
  hasSavedGame,
}: {
  onNewGame: () => void;
  onContinue: () => void;
  hasSavedGame: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader>Assignment Orders</SectionHeader>
      <p className="text-xs leading-relaxed opacity-70">
        By order of the Central Committee, you are hereby assigned to establish and manage a new
        Soviet settlement. Report to the Ministry of Planning for further instructions.
      </p>

      <DossierButton onClick={onNewGame} primary>
        BEGIN NEW ASSIGNMENT
      </DossierButton>

      {hasSavedGame && (
        <DossierButton onClick={onContinue}>CONTINUE PREVIOUS ASSIGNMENT</DossierButton>
      )}

      <div className="border-t pt-3 mt-3" style={{ borderColor: `${parchment.border.primary}44` }}>
        <p className="text-[10px] opacity-50 italic">
          Form NP-1 &mdash; Ministry of Planning &mdash; Classification: RESTRICTED
        </p>
      </div>
    </div>
  );
}

// ── Tab: Load Game ────────────────────────────────────────

function LoadTab({
  onLoadGame,
  onContinue,
  hasSavedGame,
}: {
  onLoadGame: () => void;
  onContinue: () => void;
  hasSavedGame: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader>Personnel Archives</SectionHeader>
      <p className="text-xs leading-relaxed opacity-70">
        Access previously filed assignment records. All saves are maintained in the central
        registry.
      </p>

      {hasSavedGame ? (
        <>
          <DossierButton onClick={onContinue} primary>
            RESUME AUTOSAVE
          </DossierButton>
          <DossierButton onClick={onLoadGame}>LOAD FROM FILE</DossierButton>
        </>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm opacity-60 italic">No assignment records found in the archive.</p>
          <p className="text-[10px] opacity-40 mt-2">
            Begin a new assignment to create your first save.
          </p>
        </div>
      )}

      <div className="border-t pt-3 mt-3" style={{ borderColor: `${parchment.border.primary}44` }}>
        <p className="text-[10px] opacity-50 italic">
          Form AR-7 &mdash; Central Archive &mdash; Classification: CONFIDENTIAL
        </p>
      </div>
    </div>
  );
}

// ── Tab: Settings ─────────────────────────────────────────

function SettingsTab() {
  const [musicVol, setMusicVol] = useState(50);
  const [sfxVol, setSfxVol] = useState(70);

  return (
    <div className="space-y-4">
      <SectionHeader>Administrative Directives</SectionHeader>

      <SettingsGroup label="Audio Levels">
        <SettingsSlider label="Music" value={musicVol} onChange={setMusicVol} />
        <SettingsSlider label="Effects" value={sfxVol} onChange={setSfxVol} />
      </SettingsGroup>

      <SettingsGroup label="Display">
        <p className="text-[10px] opacity-60 italic">
          Additional display settings available in-game via the drawer panel.
        </p>
      </SettingsGroup>

      <div className="border-t pt-3 mt-3" style={{ borderColor: `${parchment.border.primary}44` }}>
        <p className="text-[10px] opacity-50 italic">
          Directive 42-B &mdash; Configuration Bureau &mdash; v0.1.0
        </p>
      </div>
    </div>
  );
}

// ── Tab: Credits ──────────────────────────────────────────

function CreditsTab() {
  return (
    <div className="space-y-4">
      <SectionHeader>Official Acknowledgments</SectionHeader>

      <CreditBlock title="Development">
        <CreditLine label="Lead Architect" name="The Central Committee" />
        <CreditLine label="AI Assistant" name="Claude (Anthropic)" />
      </CreditBlock>

      <CreditBlock title="Technology">
        <CreditLine label="Rendering" name="Canvas 2D + React 19" />
        <CreditLine label="State" name="Miniplex 2 ECS" />
        <CreditLine label="Build" name="Vite 7 + TypeScript 5.9" />
        <CreditLine label="Styling" name="Tailwind CSS 4" />
        <CreditLine label="Animation" name="Framer Motion" />
      </CreditBlock>

      <CreditBlock title="Assets">
        <CreditLine label="Sprites" name="Blender → PNG pipeline" />
        <CreditLine label="Characters" name="Google Imagen API" />
        <CreditLine label="Music" name="Marxists Internet Archive" />
        <CreditLine label="Font" name="VT323 (Peter Hull)" />
      </CreditBlock>

      <CreditBlock title="Inspiration">
        <CreditLine label="Gameplay" name="SimCity 2000 (Maxis, 1993)" />
        <CreditLine label="Aesthetic" name="Soviet constructivist posters" />
        <CreditLine label="Humor" name="M*A*S*H (dark sardonic survival)" />
      </CreditBlock>

      <div className="border-t pt-3 mt-3" style={{ borderColor: `${parchment.border.primary}44` }}>
        <p className="text-[10px] opacity-50 italic text-center">
          SimSovet 2000 &mdash; A Five-Year Plan for Urban Development
        </p>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs font-bold uppercase tracking-[0.15em] pb-1.5 mb-1 border-b"
      style={{
        fontFamily: SOVIET_FONT,
        color: accent.red,
        borderColor: `${parchment.border.primary}66`,
      }}
    >
      {children}
    </div>
  );
}

function DossierButton({
  children,
  onClick,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full py-2.5 px-4 text-sm font-bold uppercase tracking-[0.15em]',
        'border-2 transition-all duration-150 cursor-pointer',
        'active:translate-y-0.5 active:brightness-75',
        primary ? 'text-white hover:brightness-110' : 'hover:brightness-95'
      )}
      style={{
        fontFamily: SOVIET_FONT,
        background: primary ? accent.red : parchment.surface.alt,
        borderColor: primary ? accent.red : parchment.border.primary,
        color: primary ? '#ffffff' : parchment.text.primary,
      }}
    >
      {children}
    </button>
  );
}

function CreditBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10px] font-bold uppercase tracking-wider mb-1"
        style={{ color: parchment.border.primary }}
      >
        {title}
      </div>
      <div className="space-y-0.5 ml-2">{children}</div>
    </div>
  );
}

function CreditLine({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex text-[11px]">
      <span className="opacity-50 w-24 flex-shrink-0">{label}:</span>
      <span className="font-bold">{name}</span>
    </div>
  );
}

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[10px] font-bold uppercase tracking-wider mb-2"
        style={{ color: parchment.border.primary }}
      >
        {label}
      </div>
      <div className="space-y-2 ml-2">{children}</div>
    </div>
  );
}

function SettingsSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] opacity-70 w-16 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={handleChange}
        className="flex-1 h-1.5 accent-[#8b0000] cursor-pointer"
      />
      <span className="text-[10px] opacity-50 w-8 text-right">{value}%</span>
    </div>
  );
}
