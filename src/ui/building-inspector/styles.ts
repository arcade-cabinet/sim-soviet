/**
 * Shared styles for the BuildingInspectorPanel subcomponents.
 */

import { StyleSheet } from 'react-native';
import { Colors, monoFont } from '../styles';

export const styles = StyleSheet.create({
  desc: {
    fontSize: 11,
    fontFamily: monoFont,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 16,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 11,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#ccc',
  },

  // Stat bar
  barContainer: {
    marginBottom: 6,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#9e9e9e',
    letterSpacing: 1,
  },
  barValue: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },
  barFill: {
    height: '100%',
  },

  // Worker list
  workerList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 4,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    gap: 6,
  },
  workerClass: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    width: 24,
    letterSpacing: 1,
  },
  workerName: {
    flex: 1,
    fontSize: 9,
    fontFamily: monoFont,
    color: '#ccc',
  },
  workerMorale: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    width: 36,
    textAlign: 'right',
  },
  workerStatus: {
    fontSize: 8,
    fontFamily: monoFont,
    fontWeight: 'bold',
    width: 60,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  noWorkers: {
    fontSize: 10,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
  },
  workerOverflow: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingTop: 4,
  },

  // Efficiency
  efficiencyReasons: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#ff9800',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 4,
  },

  // Demolish
  demolishContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 12,
  },
  demolishBtn: {
    width: '100%',
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#ff4444',
    backgroundColor: 'rgba(139, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
    overflow: 'hidden',
  },
  demolishNote: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
});

export const ringStyles = StyleSheet.create({
  // Ring container
  ring: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 10,
  },

  // Ring header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  headerAccent: {
    width: 3,
    height: 16,
  },
  headerIcon: {
    fontSize: 14,
    fontFamily: monoFont,
  },
  headerLabel: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  headerLine: {
    flex: 1,
    height: 1,
    opacity: 0.4,
  },
  headerDot: {
    fontSize: 10,
  },

  // Sub-label within a ring
  subLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#777',
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 4,
  },

  // Distribution bar
  distContainer: {
    marginBottom: 6,
  },
  distBar: {
    flexDirection: 'row',
    height: 8,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  distSegment: {
    height: '100%',
  },
  distLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 3,
  },
  distLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distDot: {
    width: 6,
    height: 6,
  },
  distLegendText: {
    fontSize: 8,
    fontFamily: monoFont,
    color: '#999',
  },

  // Stats row (3-column aggregate)
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 6,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 7,
    fontFamily: monoFont,
    color: '#777',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Rating row
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 6,
  },
  ratingLabel: {
    fontSize: 9,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: '#777',
    letterSpacing: 1,
  },
  ratingStars: {
    fontSize: 14,
    fontFamily: monoFont,
    letterSpacing: 2,
  },

  // Status badge
  statusBadge: {
    marginVertical: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: '#444',
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Efficiency summary (above rings)
  efficiencySummary: {
    marginBottom: 4,
  },

  // Housing badge
  housingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(64, 196, 255, 0.1)',
    borderWidth: 1,
    borderColor: Colors.termBlue,
    marginBottom: 4,
  },
  housingText: {
    fontSize: 10,
    fontFamily: monoFont,
    fontWeight: 'bold',
    color: Colors.termBlue,
    letterSpacing: 1,
  },
});
