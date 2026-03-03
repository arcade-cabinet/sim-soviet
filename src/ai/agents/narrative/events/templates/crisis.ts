/**
 * @module game/events/templates/crisis
 *
 * Crisis-phase event templates — events that only fire when specific
 * crisis IDs are active. Each template uses `crisisFilter` to restrict
 * when it can appear (e.g. war, famine, disaster crisis IDs).
 *
 * Crisis phases (from CrisisAgent lifecycle):
 *   buildup   — tension mounting, preparation
 *   peak      — crisis at maximum intensity
 *   aftermath — recovery, consequences
 */

import type { EventTemplate } from '../types';

export const CRISIS_EVENTS: EventTemplate[] = [
  // ── WAR CRISES ───────────────────────────────────────────

  {
    id: 'mobilization_order',
    title: 'GENERAL MOBILIZATION ORDER',
    description:
      'Comrade Chairman, mobilization orders have arrived from Moscow. All able-bodied citizens ' +
      'are to report for military service. The definition of "able-bodied" has been expanded to ' +
      'include anyone who can hold a rifle. Or a shovel. Or a particularly heavy stick.',
    pravdaHeadline: 'PATRIOTIC MASSES RUSH TO DEFEND MOTHERLAND WITH UNPRECEDENTED ENTHUSIASM',
    category: 'political',
    severity: 'major',
    effects: (gs) => ({
      pop: -Math.min(10, Math.floor(gs.pop * 0.1)),
    }),
    condition: (gs) => gs.pop > 15,
    crisisFilter: ['ww2', 'civil_war', 'winter_war', 'soviet_afghan'],
    weight: 1.5,
  },
  {
    id: 'patriotic_fervor',
    title: 'PATRIOTIC FERVOR SWEEPS SETTLEMENT',
    description:
      'Citizens have spontaneously organized a patriotic rally. Production is up 20% because ' +
      'nobody dares produce less during wartime. The rally was "spontaneous" in the same way ' +
      'that gravity is "voluntary." A commissar is taking notes.',
    pravdaHeadline: 'WORKERS SMASH PRODUCTION RECORDS IN HONOR OF GLORIOUS WAR EFFORT',
    category: 'political',
    severity: 'minor',
    effects: { money: 30, food: 10 },
    crisisFilter: ['ww2', 'civil_war', 'winter_war'],
    weight: 1.0,
  },
  {
    id: 'victory_parade',
    title: 'VICTORY PARADE ORDERED',
    description:
      'Moscow demands a victory parade. The settlement has one truck, three veterans, ' +
      'and a goat wearing a medal. The parade route has been extended to make it look ' +
      'longer. The goat has been promoted to corporal.',
    pravdaHeadline: 'GLORIOUS VICTORY CELEBRATED WITH MAGNIFICENT MILITARY PROCESSION',
    category: 'cultural',
    severity: 'minor',
    effects: { money: -20, vodka: -10 },
    crisisFilter: ['ww2', 'civil_war', 'winter_war'],
    weight: 0.8,
  },

  // ── FAMINE CRISES ────────────────────────────────────────

  {
    id: 'rationing_announced',
    title: 'RATIONING DECREE ISSUED',
    description:
      'New rationing cards distributed. Each citizen entitled to 400 grams of bread per day. ' +
      'The bread contains 30% sawdust, which has been reclassified as "fiber supplement." ' +
      'Citizens are reminded that hunger is a bourgeois concept.',
    pravdaHeadline: 'SCIENTIFIC NUTRITION PROGRAM ENSURES EQUITABLE FOOD DISTRIBUTION',
    category: 'economic',
    severity: 'major',
    effects: (gs) => ({
      food: -Math.min(25, Math.floor(gs.food * 0.15)),
    }),
    condition: (gs) => gs.food > 10,
    crisisFilter: ['holodomor', 'postwar_famine', 'collectivization_famine'],
    weight: 1.5,
  },
  {
    id: 'grain_reserves_exhausted',
    title: 'GRAIN RESERVES REPORT: EMPTY',
    description:
      'The grain elevator is empty. Not "slightly depleted." Empty. The mice have left. ' +
      'Even the rats — noted optimists — have relocated. The official report states ' +
      'reserves are "at capacity." The capacity of an empty building is technically zero.',
    pravdaHeadline: 'GRAIN RESERVES ACHIEVE MAXIMUM EFFICIENCY: ZERO WASTE RECORDED',
    category: 'economic',
    severity: 'catastrophic',
    effects: (gs) => ({
      food: -Math.min(40, Math.floor(gs.food * 0.3)),
      pop: -Math.min(3, Math.floor(gs.pop * 0.03)),
    }),
    condition: (gs) => gs.food < 50 && gs.pop > 10,
    crisisFilter: ['holodomor', 'postwar_famine', 'collectivization_famine'],
    weight: 1.2,
  },
  {
    id: 'food_relief_arrives',
    title: 'RELIEF SUPPLIES ARRIVE',
    description:
      'A train arrives with emergency food supplies. Half the shipment is mislabeled: ' +
      'crates marked "wheat" contain boot leather, and crates marked "boot leather" ' +
      'contain beets. The beets are welcomed. The boot leather is also welcomed.',
    pravdaHeadline: 'SOCIALIST SOLIDARITY DELIVERS BOUNTIFUL AID TO GRATEFUL SETTLEMENT',
    category: 'economic',
    severity: 'minor',
    effects: { food: 30 },
    crisisFilter: ['holodomor', 'postwar_famine', 'collectivization_famine'],
    weight: 0.8,
  },

  // ── DISASTER CRISES ──────────────────────────────────────

  {
    id: 'industrial_accident',
    title: 'INDUSTRIAL SAFETY INCIDENT',
    description:
      'An explosion at the industrial complex. The safety inspector was on vacation. ' +
      'The backup safety inspector was also on vacation. Both vacations were mandatory. ' +
      'The explosion has been reclassified as "unscheduled stress testing."',
    pravdaHeadline: 'FACTORY UNDERGOES SPONTANEOUS STRUCTURAL REDESIGN',
    category: 'disaster',
    severity: 'major',
    effects: { money: -60, power: -10, pop: -2 },
    condition: (gs) => gs.pop > 10 && gs.buildings.length > 3,
    crisisFilter: ['chernobyl', 'industrial_disaster', 'kyshtym'],
    weight: 1.3,
  },
  {
    id: 'evacuation_zone',
    title: 'EVACUATION ZONE DECLARED',
    description:
      'A 30-kilometer exclusion zone has been established. Citizens within the zone ' +
      'are to be relocated. Citizens outside the zone are told everything is fine. ' +
      'The zone boundary was drawn by committee. It is shaped like a pentagon for ' +
      'reasons nobody can explain.',
    pravdaHeadline: 'PRECAUTIONARY RELOCATION DEMONSTRATES STATE CONCERN FOR CITIZEN WELFARE',
    category: 'disaster',
    severity: 'catastrophic',
    effects: (gs) => ({
      pop: -Math.min(8, Math.floor(gs.pop * 0.08)),
      money: -80,
    }),
    condition: (gs) => gs.pop > 20,
    crisisFilter: ['chernobyl', 'industrial_disaster', 'kyshtym'],
    weight: 1.0,
  },
  {
    id: 'contamination_warning',
    title: 'CONTAMINATION ADVISORY',
    description:
      'Elevated radiation levels detected. Citizens are advised to stay indoors. ' +
      'Windows should remain closed. The official position is that the reading is ' +
      '"not great, not terrible." The dosimeter only goes to 3.6 roentgen. ' +
      'Everything above 3.6 is "fine."',
    pravdaHeadline: 'MINOR ATMOSPHERIC ANOMALY POSES NO THREAT TO HEROIC WORKERS',
    category: 'disaster',
    severity: 'major',
    effects: (gs) => ({
      pop: -Math.min(2, Math.floor(gs.pop * 0.02)),
      food: -Math.min(15, Math.floor(gs.food * 0.1)),
    }),
    condition: (gs) => gs.pop > 10,
    crisisFilter: ['chernobyl', 'kyshtym'],
    weight: 1.2,
  },
  {
    id: 'reconstruction_begins',
    title: 'RECONSTRUCTION CAMPAIGN LAUNCHED',
    description:
      'The Central Committee has announced a reconstruction campaign. Every citizen ' +
      'will contribute labor. Volunteers will be selected involuntarily. Materials ' +
      'will be sourced from the rubble of the previous reconstruction campaign.',
    pravdaHeadline: 'HEROIC REBUILDING EFFORT TRANSFORMS DEVASTATION INTO SOCIALIST TRIUMPH',
    category: 'economic',
    severity: 'minor',
    effects: { money: 40, food: -10 },
    crisisFilter: ['ww2', 'chernobyl', 'industrial_disaster', 'civil_war'],
    weight: 0.9,
  },
];
