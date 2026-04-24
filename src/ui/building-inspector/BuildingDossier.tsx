/**
 * BuildingDossier — Records Ring subcomponent.
 *
 * Shows identification, operational status, structural integrity, power,
 * fire status, and environmental impact. Rendered for all buildings.
 */

import type React from 'react';
import { Text, View } from 'react-native';
import { Colors } from '../styles';
import { healthColor, InfoRow, powerColor, RingHeader, StatBar } from './shared';
import { ringStyles } from './styles';

export interface BuildingDossierProps {
  constructionInfo: { label: string; progress: number } | null;
  health: number;
  decayRate: number;
  pollution: number;
  fear: number;
  onFire: boolean;
  fireTicksRemaining: number;
  powered: boolean;
  powerReq: number;
  powerOutput: number;
  footX: number;
  footY: number;
  cost: number;
  gridX: number;
  gridY: number;
  role: string;
  level: number;
}

/** Records Ring — construction data, structural integrity, power, fire, environment. */
export const BuildingDossier: React.FC<BuildingDossierProps> = ({
  constructionInfo,
  health,
  decayRate,
  pollution,
  fear,
  onFire,
  fireTicksRemaining,
  powered,
  powerReq,
  powerOutput,
  footX,
  footY,
  cost,
  gridX,
  gridY,
  role,
  level,
}) => {
  const estimatedLife = decayRate > 0 ? Math.round(health / decayRate) : null;

  const opStatus = constructionInfo
    ? 'UNDER CONSTRUCTION'
    : onFire
      ? 'EMERGENCY — FIRE'
      : !powered && powerReq > 0
        ? 'OFFLINE — NO POWER'
        : 'OPERATIONAL';

  const opColor = constructionInfo
    ? '#ff9800'
    : onFire
      ? '#ef4444'
      : !powered && powerReq > 0
        ? '#ef4444'
        : Colors.termGreen;

  return (
    <View style={ringStyles.ring}>
      <RingHeader label="RECORDS RING" icon={'⌘'} color={Colors.termBlue} />

      <InfoRow label="GRID POSITION" value={`[${gridX}, ${gridY}]`} />
      <InfoRow label="CLASSIFICATION" value={role.toUpperCase()} />
      <InfoRow label="UPGRADE LEVEL" value={`TIER ${level}`} />
      <InfoRow label="FOOTPRINT" value={`${footX}×${footY} cells`} />
      {cost > 0 && <InfoRow label="CONSTRUCTION COST" value={`₽ ${cost}`} valueColor={Colors.sovietGold} />}

      <View style={ringStyles.statusBadge}>
        <Text style={[ringStyles.statusText, { color: opColor }]}>
          {'●'} {opStatus}
        </Text>
      </View>

      {constructionInfo && (
        <>
          <InfoRow label="PHASE" value={constructionInfo.label} valueColor="#ff9800" />
          <StatBar
            label="PROGRESS"
            value={Math.round(constructionInfo.progress * 100)}
            max={100}
            color="#ff9800"
            suffix="%"
          />
        </>
      )}

      <StatBar label="STRUCTURAL INTEGRITY" value={health} max={100} color={healthColor(health)} />
      {decayRate > 0 && (
        <>
          <InfoRow label="DECAY RATE" value={`-${decayRate}/tick`} valueColor="#ef4444" />
          {estimatedLife !== null && (
            <InfoRow
              label="EST. LIFESPAN"
              value={`~${estimatedLife} ticks`}
              valueColor={estimatedLife < 50 ? '#ef4444' : estimatedLife < 200 ? Colors.sovietGold : '#9e9e9e'}
            />
          )}
        </>
      )}

      {powerOutput > 0 ? (
        <InfoRow label="POWER OUTPUT" value={`${powerOutput}W`} valueColor={Colors.termGreen} />
      ) : powerReq > 0 ? (
        <InfoRow
          label="POWER STATUS"
          value={powered ? `POWERED (${powerReq}W)` : `UNPOWERED (${powerReq}W req.)`}
          valueColor={powerColor(powered)}
        />
      ) : null}

      {onFire && (
        <>
          <InfoRow label="FIRE STATUS" value="ACTIVE FIRE" valueColor="#ef4444" />
          {fireTicksRemaining > 0 && (
            <InfoRow label="EXTINGUISHES IN" value={`${fireTicksRemaining} ticks`} valueColor="#ff9800" />
          )}
        </>
      )}

      {(pollution > 0 || fear > 0) && (
        <>
          {pollution > 0 && <InfoRow label="SMOG OUTPUT" value={`${pollution}/tick`} valueColor="#9e9e9e" />}
          {fear > 0 && <InfoRow label="FEAR RADIUS" value={`${fear}/tick`} valueColor={Colors.sovietRed} />}
        </>
      )}
    </View>
  );
};
