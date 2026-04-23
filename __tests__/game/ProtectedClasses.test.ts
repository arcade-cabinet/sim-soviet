import { getDemolitionPriority, isProtected } from '../../src/config/protectedClasses';

describe('Protected Classes', () => {
  it('government is never demolished', () => {
    expect(isProtected('government')).toBe(true);
  });
  it('military is never demolished', () => {
    expect(isProtected('military')).toBe(true);
  });
  it('housing is fully expendable', () => {
    expect(isProtected('housing')).toBe(false);
  });
  it('farms are fully expendable', () => {
    expect(isProtected('farms')).toBe(false);
  });
  it('demolition priority orders expendables first', () => {
    const farmP = getDemolitionPriority('farms');
    const housingP = getDemolitionPriority('housing');
    const industryP = getDemolitionPriority('industry');
    const powerP = getDemolitionPriority('power_water');
    expect(farmP).toBeLessThan(industryP);
    expect(housingP).toBeLessThan(industryP);
    expect(industryP).toBeLessThan(powerP);
  });
  it('protected classes have Infinity priority', () => {
    expect(getDemolitionPriority('government')).toBe(Infinity);
    expect(getDemolitionPriority('military')).toBe(Infinity);
  });
});
