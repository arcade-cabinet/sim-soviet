/**
 * CitizenDossierModal — Full-screen Soviet-style personnel file for a citizen.
 *
 * Displays citizen stats, household info, progress bars, and procedurally
 * generated commissar notes. Slides up from the bottom with a fading backdrop.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { type CitizenDossierData, closeCitizenDossier } from '@/stores/gameStore';

// ── Class label map ──────────────────────────────────────────────────────────

const CLASS_LABELS: Record<string, string> = {
  worker: 'Worker',
  party_official: 'Party Official',
  engineer: 'Engineer',
  farmer: 'Farmer',
  soldier: 'Soldier',
  prisoner: 'Prisoner',
};

const CLASS_ICONS: Record<string, string> = {
  worker: '\u2692', // hammer and pick
  party_official: '\u2605', // star
  engineer: '\u2699', // gear
  farmer: '\u2618', // shamrock (closest to plant)
  soldier: '\u2694', // swords
  prisoner: '\u26D3', // chains
};

// ── Role label formatting ────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  head: 'Head of Household',
  spouse: 'Spouse',
  worker: 'Worker',
  elder: 'Elder',
  adolescent: 'Adolescent',
  child: 'Child',
  infant: 'Infant',
};

// ── Commissar notes generator ────────────────────────────────────────────────

function generateCommissarNotes(citizen: CitizenDossierData['citizen']): string {
  if (citizen.class === 'prisoner') {
    return 'FILE RESTRICTED \u2014 SEE DISTRICT OFFICE';
  }
  if (citizen.happiness > 70 && !citizen.assignment) {
    return 'Suspiciously idle. Bears watching.';
  }
  if (citizen.happiness < 30) {
    return 'Subject displays insufficient enthusiasm.';
  }
  if (citizen.hunger > 80) {
    return 'Reports of hunger complaints. Investigate loyalty.';
  }
  if (citizen.happiness > 80 && citizen.assignment) {
    return 'Exemplary dedication to the collective. Recommend commendation.';
  }
  return 'Fulfills quota. No further comment.';
}

// ── Draft status ─────────────────────────────────────────────────────────────

function getDraftStatus(citizen: CitizenDossierData['citizen']): string {
  if (citizen.class === 'soldier') return 'ACTIVE DUTY';
  if (citizen.class === 'prisoner') return 'INELIGIBLE';
  if (citizen.gender === 'female') return 'EXEMPT (female)';
  if (citizen.age != null && citizen.age < 18) return 'EXEMPT (minor)';
  if (citizen.age != null && citizen.age > 55) return 'EXEMPT (age)';
  return 'ELIGIBLE';
}

// ── Stat bar color thresholds ────────────────────────────────────────────────

function thresholdColor(value: number): string {
  if (value >= 60) return '#22c55e';
  if (value >= 30) return '#eab308';
  return '#ef4444';
}

/** Inverted threshold: high hunger is bad (red), low is good (green). */
function inverseThresholdColor(value: number): string {
  if (value <= 30) return '#22c55e';
  if (value <= 60) return '#eab308';
  return '#ef4444';
}

// ── Stat bar component ───────────────────────────────────────────────────────

function DossierBar({
  label,
  value,
  inverse = false,
}: {
  label: string;
  value: number;
  inverse?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const color = inverse ? inverseThresholdColor(value) : thresholdColor(value);

  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5">
        <span style={{ color: '#999' }}>{label}</span>
        <span style={{ color }}>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full" style={{ background: '#333', border: '1px solid #555' }}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 h-px" style={{ background: '#8b0000' }} />
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: '#ff4444' }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: '#8b0000' }} />
    </div>
  );
}

// ── Identity card sub-component ──────────────────────────────────────────────

function IdentityCard({
  citizen,
  household,
}: {
  citizen: CitizenDossierData['citizen'];
  household: CitizenDossierData['household'];
}) {
  const classLabel = CLASS_LABELS[citizen.class] ?? citizen.class;
  const classIcon = CLASS_ICONS[citizen.class] ?? '\u2638';
  const roleLabel = citizen.memberRole
    ? (ROLE_LABELS[citizen.memberRole] ?? citizen.memberRole)
    : undefined;

  return (
    <div className="flex gap-4 items-start">
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: 64,
          height: 72,
          background: '#222',
          border: '1px solid #555',
          fontSize: 28,
        }}
        aria-hidden="true"
      >
        {classIcon}
      </div>
      <div className="flex-1 text-sm" style={{ color: '#ccc' }}>
        {citizen.age != null && (
          <p>
            <span style={{ color: '#999' }}>Age: </span>
            {citizen.age}
          </p>
        )}
        {citizen.gender && (
          <p>
            <span style={{ color: '#999' }}>Gender: </span>
            {citizen.gender === 'male' ? 'Male' : 'Female'}
          </p>
        )}
        {roleLabel && (
          <p>
            <span style={{ color: '#999' }}>Role: </span>
            {roleLabel}
          </p>
        )}
        <p>
          <span style={{ color: '#999' }}>Class: </span>
          {classLabel}
        </p>
        {household && (
          <p>
            <span style={{ color: '#999' }}>Dvor: </span>
            {household.surname} Household
          </p>
        )}
        {citizen.assignment && (
          <p>
            <span style={{ color: '#999' }}>Assignment: </span>
            {citizen.assignment}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Household section sub-component ──────────────────────────────────────────

function HouseholdSection({
  household,
}: {
  household: NonNullable<CitizenDossierData['household']>;
}) {
  const headMember = household.members.find(
    (m) => m.name === household.headOfHousehold || m.role === 'head'
  );
  const children = household.members.filter(
    (m) => m.role === 'child' || m.role === 'infant' || m.role === 'adolescent'
  );

  return (
    <>
      <SectionDivider label="Household" />
      <div className="text-sm" style={{ color: '#ccc' }}>
        {headMember && (
          <p className="mb-1">
            <span style={{ color: '#999' }}>Head: </span>
            {headMember.name}
            {headMember.age > 0 ? ` (${headMember.age})` : ''}
            {headMember.gender ? `, ${headMember.gender}` : ''}
          </p>
        )}
        {children.length > 0 && (
          <p className="mb-1">
            <span style={{ color: '#999' }}>Children: </span>
            {children.map((c) => `${c.name} (${c.age})`).join(', ')}
          </p>
        )}
        <p>
          <span style={{ color: '#999' }}>Members: </span>
          {household.members.length}
        </p>
      </div>
    </>
  );
}

// ── Political record sub-component ───────────────────────────────────────────

function PoliticalRecord({ citizen }: { citizen: CitizenDossierData['citizen'] }) {
  const commissarNotes = generateCommissarNotes(citizen);
  const draftStatus = getDraftStatus(citizen);

  return (
    <>
      <SectionDivider label="Political Record" />
      <div className="text-sm mb-1" style={{ color: '#ccc' }}>
        <p className="mb-1">
          <span style={{ color: '#999' }}>Commissar notes: </span>
          <em>&ldquo;{commissarNotes}&rdquo;</em>
        </p>
        <p>
          <span style={{ color: '#999' }}>Draft status: </span>
          {draftStatus}
        </p>
      </div>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export interface CitizenDossierProps {
  data: CitizenDossierData;
}

export function CitizenDossierModal({ data }: CitizenDossierProps) {
  const { citizen, household } = data;

  return (
    <AnimatePresence>
      <motion.div
        key="citizen-dossier-backdrop"
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0, 0, 0, 0.85)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={closeCitizenDossier}
        role="dialog"
        aria-modal="true"
        aria-label={`Personnel file for ${citizen.name}`}
      >
        <motion.div
          key="citizen-dossier-panel"
          className="w-full max-w-md max-h-[90dvh] overflow-y-auto"
          style={{
            background: '#1a1a1a',
            border: '2px solid #8b0000',
            fontFamily: "'VT323', monospace",
            boxShadow: '0 0 40px rgba(139, 0, 0, 0.3)',
          }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header stripe */}
          <div
            className="px-4 py-3 text-center"
            style={{
              background: 'linear-gradient(180deg, #8b0000 0%, #5c0000 100%)',
              borderBottom: '2px solid #ff4444',
            }}
          >
            <p
              className="text-[10px] uppercase tracking-[0.3em] mb-1"
              style={{ color: 'rgba(255, 255, 255, 0.6)' }}
            >
              USSR Ministry of Internal Affairs
            </p>
            <h2 className="text-lg font-bold uppercase tracking-wider" style={{ color: '#fff' }}>
              Personnel File: {citizen.name}
            </h2>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            <IdentityCard citizen={citizen} household={household} />

            {household && <HouseholdSection household={household} />}

            <SectionDivider label="Stats" />
            <DossierBar label="Morale" value={citizen.happiness} />
            <DossierBar label="Hunger" value={citizen.hunger} inverse />
            {household && <DossierBar label="Loyalty" value={household.loyaltyToCollective} />}

            <PoliticalRecord citizen={citizen} />

            {/* Dismiss button */}
            <div className="mt-4 mb-1">
              <button
                type="button"
                className="w-full py-2.5 text-sm font-bold uppercase tracking-wider cursor-pointer transition-all"
                style={{
                  background: 'rgba(139, 0, 0, 0.3)',
                  border: '1px solid #8b0000',
                  color: '#ff4444',
                }}
                onClick={closeCitizenDossier}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 0, 0, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 0, 0, 0.3)';
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
