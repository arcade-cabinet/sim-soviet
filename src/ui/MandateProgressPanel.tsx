/**
 * MandateProgressPanel — Five-Year Plan building mandates and fulfillment status.
 *
 * Shows each mandated building type with a progress bar indicating how many
 * have been placed vs. required. Also displays the current production quota
 * and an overall mandate fulfillment percentage.
 *
 * Uses SovietModal with terminal variant for dark-panel aesthetic.
 */

import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import type { MandateWithFulfillment } from '../game/PlanMandates';
import { getMandateFulfillment, isMandateComplete } from '../game/PlanMandates';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface MandateProgressPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section header with gold text and bottom border. */
const SectionHeader: React.FC<{ title: string }> = ({ title }) => <Text style={styles.sectionTitle}>{title}</Text>;

/** Horizontal divider between sections. */
const Divider: React.FC = () => <View style={styles.divider} />;

/** Single mandate row with label, progress bar, and status icon. */
const MandateRow: React.FC<{ mandate: MandateWithFulfillment }> = ({ mandate }) => {
  const complete = isMandateComplete(mandate);
  const ratio = mandate.required > 0 ? Math.min(mandate.fulfilled / mandate.required, 1) : 0;
  const barColor = complete ? Colors.termGreen : Colors.sovietGold;
  const statusIcon = complete ? '\u2713' : '\u2717';
  const statusColor = complete ? Colors.termGreen : Colors.sovietRed;

  return (
    <View style={styles.mandateRow}>
      <View style={styles.mandateHeader}>
        <Text style={[styles.mandateLabel, complete && styles.mandateLabelComplete]}>{mandate.label}</Text>
        <Text style={[styles.statusIcon, { color: statusColor }]}>{statusIcon}</Text>
      </View>

      <View style={styles.barRow}>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.round(ratio * 100)}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>
        <Text style={[styles.barLabel, { color: complete ? Colors.termGreen : Colors.textPrimary }]}>
          {mandate.fulfilled}/{mandate.required}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const MandateProgressPanel: React.FC<MandateProgressPanelProps> = ({ visible, onDismiss }) => {
  // Subscribe to game state for re-renders
  const _snap = useGameSnapshot();

  // Access engine systems — may be null if game not initialized
  const engine = getEngine();
  const mandateState = engine?.getMandateState() ?? null;
  const quota = engine?.getQuota() ?? null;

  if (!visible) return null;

  // ── Computed values ────────────────────────────────────────────────────

  const mandates = mandateState?.mandates ?? [];
  const hasMandates = mandates.length > 0;
  const fulfillmentRatio = mandateState ? getMandateFulfillment(mandateState) : 0;
  const fulfillmentPercent = Math.round(fulfillmentRatio * 100);
  const allComplete = fulfillmentRatio >= 1;

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="PLAN MANDATES"
      stampText={'\u041F\u042F\u0422\u0418\u041B\u0415\u0422\u041A\u0410'}
      actionLabel="CLOSE"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      {/* ── BUILDING MANDATES ──────────────────────────────────────── */}
      <SectionHeader title="FIVE-YEAR PLAN MANDATES" />

      {hasMandates ? (
        <>
          {mandates.map((mandate) => (
            <MandateRow key={mandate.defId} mandate={mandate} />
          ))}

          <Divider />

          {/* ── OVERALL FULFILLMENT ────────────────────────────────── */}
          <SectionHeader title="OVERALL FULFILLMENT" />

          <View style={styles.overallRow}>
            <View style={styles.overallBarTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${fulfillmentPercent}%`,
                    backgroundColor: allComplete ? Colors.termGreen : Colors.sovietRed,
                    height: '100%',
                  },
                ]}
              />
            </View>
            <Text style={[styles.overallPercent, { color: allComplete ? Colors.termGreen : Colors.sovietRed }]}>
              {fulfillmentPercent}%
            </Text>
          </View>

          {allComplete && <Text style={styles.completeText}>ALL MANDATES FULFILLED — GLORY TO THE WORKERS!</Text>}
        </>
      ) : (
        <Text style={styles.noData}>No active mandates.</Text>
      )}

      {/* ── PRODUCTION QUOTA ───────────────────────────────────────── */}
      {quota && (
        <>
          <Divider />

          <SectionHeader title="PRODUCTION QUOTA" />

          <View style={styles.quotaRow}>
            <Text style={styles.quotaLabel}>{quota.type.toUpperCase()}:</Text>
            <Text style={styles.quotaValue}>
              {Math.round(quota.current)}/{quota.target}
            </Text>
          </View>

          <View style={styles.barRow}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.round(Math.min(quota.current / Math.max(quota.target, 1), 1) * 100)}%`,
                    backgroundColor: quota.current >= quota.target ? Colors.termGreen : Colors.termBlue,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.barLabel,
                {
                  color: quota.current >= quota.target ? Colors.termGreen : Colors.textPrimary,
                },
              ]}
            >
              {Math.round(Math.min(quota.current / Math.max(quota.target, 1), 1) * 100)}%
            </Text>
          </View>

          <View style={styles.quotaRow}>
            <Text style={styles.quotaDeadlineLabel}>DEADLINE:</Text>
            <Text style={styles.quotaDeadlineValue}>{quota.deadlineYear}</Text>
          </View>
        </>
      )}
    </SovietModal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginVertical: 12,
  },
  noData: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 4,
  },

  // ── Mandate rows ───────────────────────────────────────────────────────
  mandateRow: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  mandateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mandateLabel: {
    fontSize: 12,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  mandateLabelComplete: {
    color: Colors.termGreen,
  },
  statusIcon: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },

  // ── Progress bars ──────────────────────────────────────────────────────
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  barFill: {
    height: '100%',
  },
  barLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'right',
  },

  // ── Overall fulfillment ────────────────────────────────────────────────
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overallBarTrack: {
    flex: 1,
    height: 14,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  overallPercent: {
    fontSize: 14,
    fontFamily: monoFont,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'right',
  },
  completeText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termGreen,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 8,
  },

  // ── Production quota ───────────────────────────────────────────────────
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quotaLabel: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  quotaValue: {
    fontSize: 13,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.white,
  },
  quotaDeadlineLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    color: Colors.textSecondary,
  },
  quotaDeadlineValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#ef5350',
  },
});
