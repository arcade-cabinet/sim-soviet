/** Era-appropriate Soviet state-security service labels. */
export function securityServiceLabelForYear(year: number): string {
  if (year < 1922) return 'Cheka';
  if (year < 1934) return 'OGPU';
  if (year < 1946) return 'NKVD';
  if (year < 1954) return 'MGB';
  return 'KGB';
}

/** Uppercase service label for stamped UI headings and compact tabs. */
export function securityServiceCodeForYear(year: number): string {
  return securityServiceLabelForYear(year).toUpperCase();
}
