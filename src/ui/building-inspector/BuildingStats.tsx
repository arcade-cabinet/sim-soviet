/**
 * BuildingStats — Production Ring subcomponent.
 *
 * Shows output rates, efficiency, worker contribution, and star rating
 * for buildings that produce resources, generate power, or add storage.
 */

import type React from 'react';
import { Text, View } from 'react-native';
import { Colors } from '../styles';
import { efficiencyColor, InfoRow, RingHeader, StatBar } from './shared';
import { ringStyles } from './styles';

/** Convert efficiency pct to a star rating (1-5 stars). */
function outputRatingStars(pct: number): string {
  const stars = Math.max(1, Math.min(5, Math.ceil(pct / 20)));
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

export interface BuildingStatsProps {
  produces: { resource: string; amount: number } | undefined;
  effectiveOutput: number;
  efficiencyPct: number;
  avgWorkerEfficiency: number;
  workerCount: number;
  workerCap: number;
  powerOutput: number;
  storageContribution: number;
  role: string;
}

/** Production Ring — output rates, efficiency, worker contribution. */
export const BuildingStats: React.FC<BuildingStatsProps> = ({
  produces,
  effectiveOutput,
  efficiencyPct,
  avgWorkerEfficiency,
  workerCount,
  workerCap,
  powerOutput,
  storageContribution,
  role: _role,
}) => {
  const hasProduction = produces || powerOutput > 0 || storageContribution > 0;
  if (!hasProduction) return null;

  return (
    <View style={ringStyles.ring}>
      <RingHeader label="PRODUCTION RING" icon={'⚙'} color={Colors.termGreen} />

      {produces && (
        <>
          <InfoRow label="RESOURCE" value={produces.resource.toUpperCase()} valueColor={Colors.termGreen} />
          <InfoRow label="BASE RATE" value={`${produces.amount}/tick`} valueColor="#9e9e9e" />
          <StatBar
            label="EFFECTIVE OUTPUT"
            value={effectiveOutput}
            max={produces.amount}
            color={effectiveOutput > 0 ? Colors.termGreen : '#ef4444'}
            suffix="/tick"
          />
          <InfoRow label="PLANT EFFICIENCY" value={`${efficiencyPct}%`} valueColor={efficiencyColor(efficiencyPct)} />
          {workerCap > 0 && workerCount > 0 && (
            <InfoRow
              label="AVG WORKER EFF."
              value={`${Math.round(avgWorkerEfficiency * 100)}%`}
              valueColor={efficiencyColor(Math.round(avgWorkerEfficiency * 100))}
            />
          )}
        </>
      )}

      {powerOutput > 0 && (
        <>
          <InfoRow label="POWER GENERATED" value={`${powerOutput}W`} valueColor={Colors.termGreen} />
          <InfoRow label="ROLE" value="POWER GENERATION" valueColor="#9e9e9e" />
        </>
      )}

      {storageContribution > 0 && (
        <InfoRow label="STORAGE ADDED" value={`+${storageContribution} units`} valueColor={Colors.sovietGold} />
      )}

      {produces && (
        <View style={ringStyles.ratingRow}>
          <Text style={ringStyles.ratingLabel}>OUTPUT RATING</Text>
          <Text style={[ringStyles.ratingStars, { color: efficiencyColor(efficiencyPct) }]}>
            {outputRatingStars(efficiencyPct)}
          </Text>
        </View>
      )}
    </View>
  );
};
