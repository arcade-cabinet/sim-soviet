/**
 * GovernmentHQ — Central bureaucratic panel with 6 agency tabs.
 *
 * Tabs: Gosplan | Central Committee | State Security | Military | Politburo | Reports
 * Each tab reads live data from the SimulationEngine via getEngine().
 */

import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { SettlementTier } from '../ai/agents/infrastructure/SettlementSystem';
import type { PromotionResponse } from '../ai/agents/political/moscowPromotion';
import type { ResettlementPreparationAction } from '../ai/agents/political/resettlementDirective';
import { getEngine } from '../bridge/GameInit';
import { getResourceEntity } from '../ecs/archetypes';
import {
  setActiveDirective,
  setDefensePosture,
  setGosplanAllocations,
  useActiveDirective,
  useDefensePosture,
  useGosplanAllocations,
} from '../stores/gameStore';
import { type ActiveDirective, CENTRAL_COMMITTEE_DIRECTIVES, CentralCommitteeTab } from './hq-tabs/CentralCommitteeTab';
import { GosplanTab } from './hq-tabs/GosplanTab';
import type { ArrestRecord } from './hq-tabs/KGBTab';
import { KGBTab } from './hq-tabs/KGBTab';
import { LawEnforcementTab } from './hq-tabs/LawEnforcementTab';
import { type DefensePosture, MilitaryTab } from './hq-tabs/MilitaryTab';
import type { PolitburoDemand, PrestigeProjectStatus } from './hq-tabs/PolitburoTab';
import { PolitburoTab } from './hq-tabs/PolitburoTab';
import type { AnnualSummary, QuotaHistoryEntry } from './hq-tabs/ReportsTab';
import { ReportsTab } from './hq-tabs/ReportsTab';
import { securityServiceCodeForYear } from './securityService';
import { Colors, monoFont } from './styles';

// ── Types ───────────────────────────────────────────────────────────────────

/** Agency tab identifiers for the GovernmentHQ panel. */
export type AgencyTab =
  | 'gosplan'
  | 'central_committee'
  | 'kgb'
  | 'military'
  | 'politburo'
  | 'reports'
  | 'law_enforcement';

export interface AgencyTabDef {
  key: AgencyTab;
  label: string;
  /** Minimum settlement tier required for this tab to be visible. */
  minTier?: SettlementTier;
}

/** All possible tab definitions for the GovernmentHQ panel. */
export const AGENCY_TABS: AgencyTabDef[] = [
  { key: 'gosplan', label: 'GOSPLAN' },
  { key: 'central_committee', label: 'CENTRAL COMMITTEE' },
  { key: 'kgb', label: 'STATE SECURITY', minTier: 'posyolok' },
  { key: 'military', label: 'MILITARY', minTier: 'posyolok' },
  { key: 'politburo', label: 'POLITBURO', minTier: 'pgt' },
  { key: 'reports', label: 'REPORTS', minTier: 'pgt' },
  { key: 'law_enforcement', label: 'LAW ENFORCEMENT', minTier: 'pgt' },
];

/** Settlement tier ordering for comparison. */
const TIER_RANK: Record<SettlementTier, number> = {
  selo: 0,
  posyolok: 1,
  pgt: 2,
  gorod: 3,
};

/**
 * Returns the visible tabs for a given settlement tier.
 * - Selo (pop < 200): Gosplan + Central Committee
 * - Posyolok (200-2000): + KGB + Military
 * - PGT (2000-50000): + Politburo + Reports + Law Enforcement (all 7 tabs)
 * - Gorod (50000+): same 7 tabs (no additional unlock)
 */
export function getVisibleTabs(tier: SettlementTier): AgencyTabDef[] {
  const rank = TIER_RANK[tier];
  return AGENCY_TABS.filter((tab) => {
    if (!tab.minTier) return true;
    return rank >= TIER_RANK[tab.minTier];
  });
}

export function securityServiceLabelForYear(year: number): string {
  return securityServiceCodeForYear(year);
}

export function getAgencyTabLabel(tab: AgencyTabDef, year: number): string {
  if (tab.key === 'kgb') return securityServiceLabelForYear(year);
  return tab.label;
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface GovernmentHQProps {
  visible: boolean;
  onClose: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export const GovernmentHQ: React.FC<GovernmentHQProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<AgencyTab>('gosplan');
  const allocations = useGosplanAllocations();

  // Determine visible tabs based on settlement tier
  const tier: SettlementTier = getEngine()?.getSettlement().getCurrentTier() ?? 'selo';
  const visibleTabs = useMemo(() => getVisibleTabs(tier), [tier]);

  // Military posture — stored in gameStore, read by tick pipeline
  const militaryPosture = useDefensePosture();

  // Central Committee directive — stored in gameStore, read by tick pipeline
  const activeDirective = useActiveDirective();

  const handleAllocationChange = useCallback((newAlloc: typeof allocations) => {
    setGosplanAllocations(newAlloc as any);
  }, []);

  const handleIssueDirective = useCallback((directiveId: string) => {
    const engine = getEngine();
    const tick = engine?.getChronology().getDate().totalTicks ?? 0;
    const def = CENTRAL_COMMITTEE_DIRECTIVES.find((d) => d.id === directiveId);
    if (!def) return;
    setActiveDirective({
      directiveId,
      issuedAtTick: tick,
      lockInTicks: def.lockInTicks,
    });
  }, []);

  const handlePromotionRespond = useCallback((response: PromotionResponse) => {
    const engine = getEngine();
    if (!engine) return;
    engine.getPoliticalAgent().handlePromotionResponse(response);
  }, []);

  const handleResettlementAction = useCallback((action: ResettlementPreparationAction) => {
    const engine = getEngine();
    if (!engine) return;
    const political = engine.getPoliticalAgent();
    switch (action) {
      case 'disassemble':
        political.enactResettlementDisassembly();
        break;
      case 'bribe':
        political.attemptResettlementBribe();
        break;
      case 'accept':
        // Accept is passive — preparation continues automatically
        break;
    }
  }, []);

  if (!visible) return null;

  const engine = getEngine();
  const currentYear = engine?.getChronology().getDate().year ?? 1917;

  // ── Build tab content ──

  let tabContent: React.ReactNode;

  switch (activeTab) {
    case 'gosplan': {
      const currentEra = engine?.getPoliticalAgent().getCurrentEraId() ?? undefined;
      tabContent = (
        <GosplanTab
          currentAllocations={allocations as any}
          onAllocationChange={handleAllocationChange}
          currentEra={currentEra}
        />
      );
      break;
    }

    case 'kgb':
      tabContent = renderKGBTab(engine);
      break;

    case 'military':
      tabContent = renderMilitaryTab(engine, militaryPosture, setDefensePosture);
      break;

    case 'politburo':
      tabContent = renderPolitburoTab(engine);
      break;

    case 'central_committee':
      tabContent = renderCentralCommitteeTab(engine, activeDirective, handleIssueDirective, handlePromotionRespond);
      break;

    case 'reports':
      tabContent = renderReportsTab(engine);
      break;

    case 'law_enforcement':
      tabContent = renderLawEnforcementTab(engine);
      break;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>GOVERNMENT HQ</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close Government HQ"
          >
            <Text style={styles.closeText}>X</Text>
          </Pressable>
        </View>

        {/* Resettlement alert banner */}
        {engine &&
          (() => {
            const resState = engine.getPoliticalAgent().getResettlementState();
            if (!resState.directiveIssued || resState.executed) return null;
            const remaining = resState.warningTicksRemaining;
            const prepPct = Math.round(resState.preparationLevel * 100);
            return (
              <View style={resettleStyles.container} testID="resettlement-alert">
                <View style={resettleStyles.headerRow}>
                  <Text style={resettleStyles.warningIcon}>!!</Text>
                  <Text style={resettleStyles.title}>RESETTLEMENT DIRECTIVE</Text>
                  <Text style={resettleStyles.warningIcon}>!!</Text>
                </View>
                <Text style={resettleStyles.countdown}>
                  RELOCATION IN {remaining} MONTH{remaining !== 1 ? 'S' : ''}
                </Text>

                {/* Preparation gauge */}
                <View style={resettleStyles.gaugeRow}>
                  <Text style={resettleStyles.gaugeLabel}>PREPARATION:</Text>
                  <View style={resettleStyles.gaugeBg}>
                    <View style={[resettleStyles.gaugeFill, { width: `${prepPct}%` }]} />
                  </View>
                  <Text style={resettleStyles.gaugeValue}>{prepPct}%</Text>
                </View>

                {resState.disassemblyActive && (
                  <Text style={resettleStyles.disassemblyActive}>DISASSEMBLY PROTOCOL ACTIVE</Text>
                )}

                {/* Action buttons */}
                <View style={resettleStyles.buttonRow}>
                  {!resState.disassemblyActive && (
                    <Pressable
                      style={resettleStyles.disassembleBtn}
                      onPress={() => handleResettlementAction('disassemble')}
                      testID="resettlement-disassemble"
                      accessibilityRole="button"
                      accessibilityLabel="Enact disassembly protocol"
                    >
                      <Text style={resettleStyles.btnText}>ENACT DISASSEMBLY PROTOCOL</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={resettleStyles.bribeBtn}
                    onPress={() => handleResettlementAction('bribe')}
                    testID="resettlement-bribe"
                    accessibilityRole="button"
                    accessibilityLabel="Arrange special consideration to cancel resettlement"
                  >
                    <Text style={resettleStyles.btnText}>ARRANGE SPECIAL CONSIDERATION</Text>
                  </Pressable>
                  <Pressable
                    style={resettleStyles.complyBtn}
                    onPress={() => handleResettlementAction('accept')}
                    testID="resettlement-comply"
                    accessibilityRole="button"
                    accessibilityLabel="Comply with resettlement directive"
                  >
                    <Text style={resettleStyles.btnText}>COMPLY WITH DIRECTIVE</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                testID={`tab-${tab.key}`}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                  {getAgencyTabLabel(tab, currentYear)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content area */}
        <ScrollView style={styles.content}>{tabContent}</ScrollView>
      </View>
    </View>
  );
};

// ── Tab renderers (extract engine data → pass to pure tab components) ────

function renderKGBTab(engine: ReturnType<typeof getEngine>): React.ReactNode {
  if (!engine) return <Text style={styles.placeholder}>Engine not initialized</Text>;

  const kgb = engine.getKGBAgent();
  const personnel = engine.getPersonnelFile();
  const workerSystem = engine.getWorkerSystem();
  const securityServiceLabel = securityServiceLabelForYear(engine.getChronology().getDate().year);

  // Loyalty level: approximated from worker morale (no direct loyalty avg on WorkerSystem)
  const loyaltyLevel = Math.round(workerSystem.getAverageMorale());

  // Dissidents: count from KGB investigations
  const investigations = kgb.getActiveInvestigations();
  const dissidentCount = investigations.length;

  // Recent arrests from file history
  const history = personnel.getHistory();
  const recentArrests: ArrestRecord[] = history
    .filter((h) => h.type === 'mark')
    .slice(-5)
    .reverse()
    .map((h) => ({
      name: h.source.replace(/_/g, ' ').toUpperCase(),
      reason: h.description ?? 'No details available',
      date: `Tick ${h.tick}`,
    }));

  // Surveillance active if there are informants or investigations running
  const informants = kgb.getInformants();
  const surveillanceActive = informants.length > 0 || investigations.length > 0;

  return (
    <KGBTab
      loyaltyLevel={loyaltyLevel}
      dissidentCount={dissidentCount}
      recentArrests={recentArrests}
      surveillanceActive={surveillanceActive}
      serviceLabel={securityServiceLabel}
    />
  );
}

function renderMilitaryTab(
  engine: ReturnType<typeof getEngine>,
  posture: DefensePosture,
  setPosture: (p: DefensePosture) => void,
): React.ReactNode {
  if (!engine) return <Text style={styles.placeholder}>Engine not initialized</Text>;

  const res = getResourceEntity()?.resources;
  const pop = res?.population ?? 0;
  const _workerSystem = engine.getWorkerSystem();

  // Garrison: estimated as 5% of population (no dedicated military worker tracking)
  const garrisonStrength = Math.floor(pop * 0.05);

  // Conscription pool: males 18-51
  const conscriptionPool = Math.floor(pop * 0.25);

  // Defense readiness: composite from garrison + buildings
  const defenseReadiness = Math.min(100, Math.round((garrisonStrength / Math.max(1, pop)) * 500));

  return (
    <MilitaryTab
      currentPosture={posture}
      garrisonStrength={garrisonStrength}
      conscriptionPool={conscriptionPool}
      defenseReadiness={defenseReadiness}
      onPostureChange={setPosture}
    />
  );
}

function renderPolitburoTab(engine: ReturnType<typeof getEngine>): React.ReactNode {
  if (!engine) return <Text style={styles.placeholder}>Engine not initialized</Text>;

  const scoring = engine.getScoring();

  // 5-year plan demands from current quota
  const demands: PolitburoDemand[] = [];
  const quota = engine.getQuota();
  if (quota) {
    demands.push({
      type: quota.type,
      target: quota.target,
      current: quota.current,
      deadline: quota.deadlineYear,
    });
  }

  // Prestige project: read live state from engine
  const construction = engine.getPrestigeConstruction();
  const demand = engine.getPrestigeDemand();
  const prestigeProject: PrestigeProjectStatus | null = construction
    ? {
        name: construction.project.name,
        progress: construction.progress,
        total: construction.project.durationYears,
      }
    : demand
      ? {
          name: demand.project.name,
          progress: 0,
          total: demand.project.durationYears,
        }
      : null;

  // Satisfaction: derived from final score (normalized 0-100)
  const totalScore = scoring.getFinalScore();
  const satisfaction = Math.min(100, Math.max(0, Math.round(totalScore / 10)));

  return (
    <PolitburoTab
      demands={demands}
      prestigeProject={prestigeProject}
      satisfaction={satisfaction}
      onAcceptMandate={() => {
        // Mandates are accepted via the plan directive modal, not here
      }}
    />
  );
}

function renderCentralCommitteeTab(
  engine: ReturnType<typeof getEngine>,
  activeDirective: ActiveDirective | null,
  onIssueDirective: (id: string) => void,
  onPromotionRespond: (response: PromotionResponse) => void,
): React.ReactNode {
  if (!engine) return <Text style={styles.placeholder}>Engine not initialized</Text>;

  const tick = engine.getChronology().getDate().totalTicks;
  const promotionState = engine.getPoliticalAgent().getPromotionState();

  return (
    <CentralCommitteeTab
      directives={CENTRAL_COMMITTEE_DIRECTIVES}
      activeDirective={activeDirective}
      onIssueDirective={onIssueDirective}
      currentTick={tick}
      politicalCapital={0}
      promotionState={promotionState}
      onPromotionRespond={onPromotionRespond}
    />
  );
}

function renderReportsTab(engine: ReturnType<typeof getEngine>): React.ReactNode {
  if (!engine) return <Text style={styles.placeholder}>Engine not initialized</Text>;

  const chronology = engine.getChronology();
  const date = chronology.getDate();
  const political = engine.getPoliticalAgent();
  const scoring = engine.getScoring();
  const kgb = engine.getKGBAgent();
  const achievements = engine.getAchievements().getStats();
  const res = getResourceEntity()?.resources;

  const currentQuota = engine.getQuota();
  const quotaForTab = currentQuota
    ? {
        type: currentQuota.type,
        target: currentQuota.target,
        current: currentQuota.current,
        deadlineYear: currentQuota.deadlineYear,
      }
    : null;

  // Build annual summary from current state
  const annualSummary: AnnualSummary = {
    year: date.year,
    population: res?.population ?? 0,
    foodStores: res?.food ?? 0,
    buildingsConstructed: achievements.buildingsPlaced,
    blackMarks: kgb.getBlackMarks(),
    commendations: kgb.getCommendations(),
  };

  // Quota history from scoring breakdowns
  const quotaHistory: QuotaHistoryEntry[] = [];
  const breakdown = scoring.getScoreBreakdown();
  for (const bd of breakdown.eras) {
    if (bd.quotasMet > 0 || bd.quotasExceeded > 0) {
      quotaHistory.push({
        year: date.year - (breakdown.eras.length - breakdown.eras.indexOf(bd)),
        type: 'production',
        target: 100,
        achieved: bd.quotasMet > 0 ? 100 : 50,
        met: bd.quotasMet > 0,
      });
    }
  }

  return (
    <ReportsTab
      currentYear={date.year}
      currentEra={political.getCurrentEraId()}
      quotaHistory={quotaHistory}
      annualSummary={annualSummary}
      totalScore={scoring.getFinalScore()}
      currentQuota={quotaForTab}
    />
  );
}

function renderLawEnforcementTab(engine: ReturnType<typeof getEngine>): React.ReactNode {
  if (!engine) return <Text style={styles.placeholder}>Engine not initialized</Text>;

  const kgb = engine.getKGBAgent();
  const state = kgb.getLawEnforcementState();
  const securityServiceLabel = securityServiceLabelForYear(engine.getChronology().getDate().year);

  return <LawEnforcementTab state={state} serviceLabel={securityServiceLabel} />;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    backgroundColor: '#2a2e33',
    borderWidth: 1,
    borderColor: Colors.sovietRed,
    width: '90%',
    maxWidth: 720,
    maxHeight: '85%',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 2,
  },
  closeButton: {
    width: 28,
    height: 28,
    backgroundColor: Colors.sovietRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
  },
  closeText: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.white,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.sovietRed,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    backgroundColor: '#424242',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 36,
  },
  tabActive: {
    backgroundColor: Colors.sovietRed,
    borderColor: Colors.sovietRed,
  },
  tabText: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: Colors.sovietGold,
  },
  content: {
    flex: 1,
    minHeight: 200,
  },
  placeholder: {
    fontFamily: monoFont,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
});

// ── Resettlement Alert Styles ─────────────────────────────────────────────

const resettleStyles = StyleSheet.create({
  container: {
    backgroundColor: '#3d1a1a',
    borderWidth: 2,
    borderColor: Colors.sovietRed,
    padding: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  warningIcon: {
    fontFamily: monoFont,
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.sovietRed,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.sovietRed,
    letterSpacing: 2,
  },
  countdown: {
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  gaugeLabel: {
    fontFamily: monoFont,
    fontSize: 9,
    color: Colors.textMuted,
  },
  gaugeBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  gaugeFill: {
    height: '100%',
    backgroundColor: Colors.termGreen,
  },
  gaugeValue: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.termGreen,
    width: 30,
    textAlign: 'right',
  },
  disassemblyActive: {
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  disassembleBtn: {
    flex: 1,
    backgroundColor: '#e65100',
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bf360c',
  },
  bribeBtn: {
    flex: 1,
    backgroundColor: Colors.sovietRed,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
  },
  complyBtn: {
    flex: 1,
    backgroundColor: '#424242',
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  btnText: {
    fontFamily: monoFont,
    fontSize: 7,
    fontWeight: 'bold',
    color: Colors.white,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
