/** A historical event displayed on the satirical Soviet timeline. */
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

/** Category tag for radio announcements (determines when they play). */
export type RadioCategory =
  | 'morning'
  | 'shift_change'
  | 'weather'
  | 'breaking'
  | 'propaganda'
  | 'music_intro'
  | 'public_service'
  | 'evening';

/** A single radio broadcast with text and category. */
export interface RadioAnnouncement {
  text: string;
  category: RadioCategory;
}

/** Satirical flavor text shown at each stage of a building's lifecycle. */
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

/** An unlockable achievement with satirical subtext. */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** The actual (grimmer) meaning */
  subtext: string;
  /** Whether this achievement is hidden until unlocked */
  hidden: boolean;
}

/** Result of a settlement renaming event, including propaganda messaging and ruble cost. */
export interface CityRenaming {
  oldName: string;
  newName: string;
  reason: string;
  announcement: string;
  cost: number;
}
