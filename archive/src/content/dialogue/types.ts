/** Context for dialogue selection — conditions under which a line may appear. */
export interface DialogueContext {
  season: 'winter' | 'mud' | 'summer';
  resourceLevel: 'starving' | 'scarce' | 'adequate' | 'surplus';
  era: string;
  threatLevel: 'safe' | 'watched' | 'endangered' | 'critical';
  settlementTier: 'selo' | 'posyolok' | 'pgt' | 'gorod';
}

export type DialogueCharacter =
  | 'worker'
  | 'politruk'
  | 'kgb'
  | 'military'
  | 'party_official'
  | 'advisor'
  | 'ambient';

export interface DialogueLine {
  text: string;
  character: DialogueCharacter;
  /** Optional conditions — line only appears when ALL specified fields match. */
  conditions?: Partial<DialogueContext>;
  /** Weight for random selection (higher = more likely). Default: 1. */
  weight?: number;
}
