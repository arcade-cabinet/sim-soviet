import { securityServiceLabelForYear } from '@/ui/GameModals';

describe('GameModals', () => {
  it('uses era-aware security service labels in annual report copy', () => {
    expect(securityServiceLabelForYear(1917)).toBe('Cheka');
    expect(securityServiceLabelForYear(1922)).toBe('OGPU');
    expect(securityServiceLabelForYear(1937)).toBe('NKVD');
    expect(securityServiceLabelForYear(1950)).toBe('MGB');
    expect(securityServiceLabelForYear(1964)).toBe('KGB');
  });
});
