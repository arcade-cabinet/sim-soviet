export interface TimelineEvent {
  /** The year this event occurs */
  year: number;
  /** Short headline for the event */
  headline: string;
  /** Longer description, narrated in official tone */
  description: string;
  /** The classified truth behind the event */
  classified?: string;
}

export type RadioCategory =
  | 'morning'
  | 'shift_change'
  | 'weather'
  | 'breaking'
  | 'propaganda'
  | 'music_intro'
  | 'public_service'
  | 'evening';

export interface RadioAnnouncement {
  text: string;
  category: RadioCategory;
}

export interface BuildingFlavorText {
  /** Shown when the building is placed on the grid */
  placement: string;
  /** Shown when the player inspects the building */
  inspection: string;
  /** Shown when the building's durability gets low */
  decay: string;
  /** Shown when the building is bulldozed / purged */
  destruction: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** The actual (grimmer) meaning */
  subtext: string;
  /** Whether this achievement is hidden until unlocked */
  hidden: boolean;
}

export interface CityRenaming {
  oldName: string;
  newName: string;
  reason: string;
  announcement: string;
  cost: number;
}
