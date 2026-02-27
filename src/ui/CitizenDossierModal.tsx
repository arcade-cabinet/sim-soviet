/**
 * CitizenDossierModal — Individual citizen/worker personnel dossier.
 *
 * Triggered from the RadialInspectMenu when inspecting a citizen or from
 * the WorkerRosterPanel. Shows full KGB-style personnel file: name, class,
 * age, health, morale/loyalty bars, skill level, current assignment,
 * vodka dependency, and commissar notes.
 *
 * Reads citizen data from the ECS citizens archetype and WorkerSystem stats.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { citizens, dvory } from '../ecs/archetypes';
import { getEngine } from '../bridge/GameInit';
import { getBuildingDef } from '../data/buildingDefs';
import type { CitizenComponent, DvorComponent, Entity } from '../ecs/world';

// ── Class config ────────────────────────────────────────────────────────────

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
  farmer: '\u2618', // shamrock
  soldier: '\u2694', // swords
  prisoner: '\u26D3', // chains
};

// ── Commissar notes generator ───────────────────────────────────────────────

function generateCommissarNotes(
  cls: string,
  morale: number,
  loyalty: number,
  vodkaDep: number,
  assignment: string | null
): string {
  if (cls === 'prisoner') {
    return 'FILE RESTRICTED -- SEE DISTRICT OFFICE';
  }
  if (morale > 80 && assignment) {
    return 'Exemplary dedication to the collective. Recommend commendation.';
  }
  if (morale > 70 && !assignment) {
    return 'Suspiciously idle. Bears watching.';
  }
  if (loyalty < 25) {
    return 'DANGER: Subject exhibits counter-revolutionary tendencies. Recommend immediate reassignment to gulag labor detail.';
  }
  if (morale < 30) {
    return 'Subject displays insufficient enthusiasm for socialist construction.';
  }
  if (vodkaDep > 70) {
    return 'Subject has developed concerning dependency on state vodka rations. Production efficiency compromised.';
  }
  if (loyalty > 80 && morale > 60) {
    return 'Reliable comrade. No deviations noted.';
  }
  return 'Fulfills quota. No further comment.';
}

/** Draft status based on citizen properties. */
function getDraftStatus(
  cls: string,
  gender: string | undefined,
  age: number | undefined
): string {
  if (cls === 'soldier') return 'ACTIVE DUTY';
  if (cls === 'prisoner') return 'INELIGIBLE';
  if (gender === 'female') return 'EXEMPT (female)';
  if (age != null && age < 18) return 'EXEMPT (minor)';
  if (age != null && age > 55) return 'EXEMPT (age)';
  return 'ELIGIBLE';
}

/** Color for bar based on value (0-100). */
function thresholdColor(value: number): string {
  if (value >= 60) return Colors.termGreen;
  if (value >= 30) return Colors.sovietGold;
  return '#ef4444';
}

/** Inverted threshold: high is bad (red), low is good (green). */
function inverseThresholdColor(value: number): string {
  if (value <= 30) return Colors.termGreen;
  if (value <= 60) return Colors.sovietGold;
  return '#ef4444';
}

// ── Find citizen helpers ────────────────────────────────────────────────────

/** Find a citizen entity by index into the citizens archetype. */
function findCitizenByIndex(index: number): Entity | null {
  const list = citizens.entities;
  if (index >= 0 && index < list.length) {
    return list[index] ?? null;
  }
  return null;
}

/** Find the dvor (household) for a citizen. */
function findDvor(citizen: CitizenComponent): DvorComponent | null {
  if (!citizen.dvorId) return null;
  for (const d of dvory.entities) {
    if (d.dvor.id === citizen.dvorId) {
      return d.dvor;
    }
  }
  return null;
}

// ── Stat Bar ────────────────────────────────────────────────────────────────

const DossierBar: React.FC<{
  label: string;
  value: number;
  inverse?: boolean;
}> = ({ label, value, inverse = false }) => {
  const pct = Math.min(100, Math.max(0, value));
  const color = inverse ? inverseThresholdColor(value) : thresholdColor(value);

  return (
    <View style={styles.barContainer}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, { color }]}>{Math.round(pct)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
};

// ── Section Divider ─────────────────────────────────────────────────────────

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.sectionDivider}>
    <View style={styles.dividerLine} />
    <Text style={styles.dividerLabel}>{label}</Text>
    <View style={styles.dividerLine} />
  </View>
);

// ── Info Row ────────────────────────────────────────────────────────────────

const InfoRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
}> = ({ label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
      {value}
    </Text>
  </View>
);

// ── Main Component ──────────────────────────────────────────────────────────

export interface CitizenDossierModalProps {
  visible: boolean;
  citizenIndex: number;
  onDismiss: () => void;
}

export const CitizenDossierModal: React.FC<CitizenDossierModalProps> = ({
  visible,
  citizenIndex,
  onDismiss,
}) => {
  if (!visible) return null;

  const entity = findCitizenByIndex(citizenIndex);
  if (!entity?.citizen) return null;

  const citizen = entity.citizen;
  const engine = getEngine();
  const workerSystem = engine?.getWorkerSystem();
  const workerInfo = workerSystem?.getWorkerInfo(entity) ?? null;
  const statsMap = workerSystem?.getStatsMap();
  const workerStats = statsMap?.get(entity) ?? null;

  // Basic identity — prefer WorkerSystem name, fall back to ECS citizen name
  if (workerInfo == null && citizen.name == null) {
    console.warn(`[CitizenDossier] Citizen entity at index ${citizenIndex} has no name`);
  }
  const name = workerInfo?.name ?? citizen.name ?? (workerInfo == null && citizen.name == null ? 'RECORDS MISSING' : 'Unknown Comrade');
  const cls = citizen.class;
  const classLabel = CLASS_LABELS[cls] ?? cls;
  const classIcon = CLASS_ICONS[cls] ?? '\u2638';
  const gender = citizen.gender;
  const age = citizen.age;

  // Stats — if workerStats is null, we have no real data; flag for UI below
  const hasWorkerStats = workerStats != null;
  const morale = workerStats?.morale ?? citizen.happiness;
  const loyalty = workerStats?.loyalty ?? 50;
  const skill = workerStats?.skill ?? 0;
  const vodkaDep = workerStats?.vodkaDependency ?? 0;
  const hunger = citizen.hunger;

  // Assignment
  const assignment = citizen.assignment ?? null;
  const assignmentName = assignment
    ? (getBuildingDef(assignment)?.presentation.name ?? assignment)
    : null;

  // Health — derive from hunger and disease
  const disease = citizen.disease;
  let healthLabel = 'HEALTHY';
  let healthColor: string = Colors.termGreen;
  if (disease) {
    healthLabel = `SICK (${disease.type.toUpperCase()})`;
    healthColor = '#ef4444';
  } else if (hunger > 70) {
    healthLabel = 'MALNOURISHED';
    healthColor = Colors.sovietGold;
  }

  // Household
  const dvor = findDvor(citizen);
  const dvorSurname = dvor?.surname;
  const memberRole = citizen.memberRole;

  // Commissar notes
  const commissarNotes = generateCommissarNotes(cls, morale, loyalty, vodkaDep, assignment);
  const draftStatus = getDraftStatus(cls, gender, age);

  // Worker status
  const status = workerInfo?.status ?? (workerInfo == null ? 'UNREGISTERED' : 'idle');
  const statusLabel = status.toUpperCase();
  const statusColor =
    status === 'working' ? Colors.termGreen :
    status === 'idle' ? Colors.sovietGold :
    status === 'hungry' ? '#ff9800' :
    status === 'drunk' ? '#9c27b0' :
    '#ef4444';

  // Stamp text based on class
  const stampText =
    cls === 'prisoner' ? 'CLASSIFIED' :
    cls === 'party_official' ? 'NOMENKLATURA' :
    cls === 'soldier' ? 'MILITARY' :
    'PERSONNEL FILE';

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title={`${classIcon} ${name.toUpperCase()}`}
      stampText={stampText}
      actionLabel="CLOSE DOSSIER"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* Identity Card */}
      <View style={styles.identityCard}>
        <View style={styles.classIconBox}>
          <Text style={styles.classIconText}>{classIcon}</Text>
        </View>
        <View style={styles.identityInfo}>
          <InfoRow label="CLASS" value={classLabel} />
          {gender && (
            <InfoRow label="GENDER" value={gender === 'male' ? 'Male' : 'Female'} />
          )}
          {age != null && (
            <InfoRow label="AGE" value={`${age}`} />
          )}
          {memberRole && (
            <InfoRow label="ROLE" value={memberRole.toUpperCase()} />
          )}
          {dvorSurname && (
            <InfoRow label="DVOR" value={`${dvorSurname} Household`} />
          )}
        </View>
      </View>

      {/* Current Status */}
      <SectionDivider label="Status" />
      <InfoRow label="STATUS" value={statusLabel} valueColor={statusColor} />
      <InfoRow label="HEALTH" value={healthLabel} valueColor={healthColor} />
      {disease && (
        <InfoRow
          label="RECOVERY"
          value={`${disease.ticksRemaining} ticks remaining`}
          valueColor="#ff9800"
        />
      )}

      {/* Assignment */}
      <SectionDivider label="Assignment" />
      {assignmentName ? (
        <InfoRow
          label="WORKPLACE"
          value={assignmentName}
          valueColor={Colors.termGreen}
        />
      ) : (
        <InfoRow label="WORKPLACE" value="UNASSIGNED" valueColor="#9e9e9e" />
      )}
      {workerStats?.assignmentSource && assignment && (
        <InfoRow
          label="ASSIGNED BY"
          value={workerStats.assignmentSource.toUpperCase()}
        />
      )}

      {/* Stats Bars */}
      <SectionDivider label="Psychological Profile" />
      {hasWorkerStats ? (
        <>
          <DossierBar label="MORALE" value={morale} />
          <DossierBar label="LOYALTY" value={loyalty} />
          <DossierBar label="SKILL" value={skill} />
          <DossierBar label="HUNGER" value={hunger} inverse />
          <DossierBar label="VODKA DEPENDENCY" value={vodkaDep} inverse />
        </>
      ) : (
        <View style={styles.commissarBox}>
          <Text style={styles.warningNote}>
            NO WORKER FILE {'\u2014'} UNREGISTERED CITIZEN
          </Text>
        </View>
      )}

      {/* Production Efficiency */}
      {workerInfo?.productionEfficiency != null && (
        <>
          <SectionDivider label="Production" />
          <View style={styles.efficiencyBox}>
            <Text style={styles.efficiencyNumber}>
              {Math.round(workerInfo.productionEfficiency * 100)}%
            </Text>
            <Text style={styles.efficiencyLabel}>PRODUCTION EFFICIENCY</Text>
          </View>
        </>
      )}

      {/* Political Record */}
      <SectionDivider label="Political Record" />
      <View style={styles.commissarBox}>
        <Text style={styles.commissarQuote}>
          &ldquo;{commissarNotes}&rdquo;
        </Text>
        <Text style={styles.commissarAttrib}>-- Commissar&apos;s Notes</Text>
      </View>
      <InfoRow label="DRAFT STATUS" value={draftStatus} />
      {vodkaDep > 50 && (
        <Text style={styles.warningNote}>
          WARNING: Subject exhibits signs of vodka dependency above acceptable
          threshold. Ration review recommended.
        </Text>
      )}
    </SovietModal>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Identity card
  identityCard: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  classIconBox: {
    width: 56,
    height: 64,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  classIconText: {
    fontSize: 28,
  },
  identityInfo: {
    flex: 1,
  },

  // Section divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.sovietDarkRed,
  },
  dividerLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#ff4444',
    letterSpacing: 2,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#ccc',
  },

  // Stat bar
  barContainer: {
    marginBottom: 6,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  barValue: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  barFill: {
    height: '100%',
  },

  // Efficiency
  efficiencyBox: {
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  efficiencyNumber: {
    fontSize: 28,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
  },
  efficiencyLabel: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Commissar notes
  commissarBox: {
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: Colors.sovietDarkRed,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  commissarQuote: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#bbb',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  commissarAttrib: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    marginTop: 4,
  },

  // Warning
  warningNote: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#ff9800',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 14,
    borderWidth: 1,
    borderColor: '#ff9800',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: 8,
  },
});
