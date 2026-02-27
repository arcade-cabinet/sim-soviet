/**
 * Type stubs for AnnualReportModal — used by SimulationEngine and annualReportTick.
 * The full UI component will be implemented separately.
 */

export interface AnnualReportData {
  year: number;
  quotaType: 'food' | 'vodka';
  quotaTarget: number;
  /** Cumulative production of the quota resource this plan period. */
  quotaCurrent: number;
  /** Actual population at end of year. */
  actualPop: number;
  /** Actual food in storage at end of year. */
  actualFood: number;
  /** Actual vodka in storage at end of year. */
  actualVodka: number;
}

export interface ReportSubmission {
  /** Reported value for the primary quota resource. */
  reportedQuota: number;
  /** Reported value for the secondary resource. */
  reportedSecondary: number;
  /** Reported population. */
  reportedPop: number;
}
