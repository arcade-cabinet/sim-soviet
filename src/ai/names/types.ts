/**
 * @fileoverview Types for the procedural Russian name generator.
 */

/** Maps a father's given name to complete patronymic forms. */
export interface PatronymicEntry {
  /** Full male patronymic form */
  male: string;
  /** Full female patronymic form */
  female: string;
}

/**
 * Surname entry. Some surnames change form by gender (most Russian -ov/-ev/-in
 * surnames add -a for female), while others (Georgian, Ukrainian -enko, etc.)
 * remain the same.
 */
export interface SurnameEntry {
  /** Male form of the surname */
  male: string;
  /** Female form (null = same as male) */
  female: string | null;
}

/** A fully generated Soviet leader identity. */
export interface GeneratedLeader {
  /** Given name (imia) */
  givenName: string;
  /** Patronymic (otchestvo) */
  patronymic: string;
  /** Surname (familiia) */
  surname: string;
  /** Gender of the leader */
  gender: 'male' | 'female';
  /** Full formal name: "Surname Given Patronymic" (Russian order) */
  formalName: string;
  /** Western order: "Given Patronymic Surname" */
  westernName: string;
  /** Short form: "G.P. Surname" (initials + surname) */
  shortName: string;
  /** Official title/position */
  title: string;
  /** Satirical epithet/nickname */
  epithet: string;
  /** Full introduction: "Title Surname, 'The Epithet'" */
  introduction: string;
}

export type TitleCategory = 'party' | 'state' | 'security' | 'military' | 'ministry' | 'local';
