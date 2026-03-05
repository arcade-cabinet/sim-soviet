import type React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { getEngine } from '../bridge/GameInit';
import { useGameSnapshot } from '../hooks/useGameState';
import { SovietModal } from './SovietModal';
import { Colors, monoFont } from './styles';
import { getMetaEntity } from '../ecs/archetypes';

export interface GlobalTerritoryPanelProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * GlobalTerritoryPanel — Planetary map and land grant interface.
 * 
 * Visualizes the settlement's position on the global H3 grid and handles
 * territorial expansion requests.
 */
export const GlobalTerritoryPanel: React.FC<GlobalTerritoryPanelProps> = ({ visible, onDismiss }) => {
  const snap = useGameSnapshot();
  const engine = getEngine();
  const hexManager = engine?.getGlobalHexManager();
  const meta = getMetaEntity()?.gameMeta;

  if (!visible || !engine || !hexManager || !meta) return null;

  const currentHex = meta.currentHex;
  const currentMeta = hexManager.getHexMetadata(currentHex);
  const neighbors = hexManager.getNeighbors(currentHex, 1);
  const territory = hexManager.getTerritory('player-settlement');

  const handleRequestGrant = (neighborHex: string) => {
     // TODO: Implement logic in SimulationEngine to handle land grant requests
     console.log('Requesting land grant for:', neighborHex);
  };

  return (
    <SovietModal
      visible={visible}
      variant="terminal"
      title="TERRITORIAL ADMINISTRATION"
      stampText="CLASSIFIED"
      actionLabel="RETURN TO OBLAST"
      onAction={onDismiss}
      dismissOnOverlay
      onDismiss={onDismiss}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CURRENT OBLAST: {currentHex}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>BIOME</Text>
              <Text style={styles.statValue}>{currentMeta.biome.toUpperCase()}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>ELEVATION</Text>
              <Text style={styles.statValue}>{(currentMeta.height * 100).toFixed(0)}m</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOCAL RESOURCE SURVEY</Text>
          <View style={styles.resourceRow}>
             <Text style={styles.resLabel}>MINERALS:</Text>
             <View style={styles.resTrack}><View style={[styles.resFill, { width: `${currentMeta.resources.minerals * 100}%`, backgroundColor: Colors.sovietGold }]} /></View>
          </View>
          <View style={styles.resourceRow}>
             <Text style={styles.resLabel}>BIOMASS:</Text>
             <View style={styles.resTrack}><View style={[styles.resFill, { width: `${currentMeta.resources.biomass * 100}%`, backgroundColor: Colors.termGreen }]} /></View>
          </View>
          <View style={styles.resourceRow}>
             <Text style={styles.resLabel}>FUEL:</Text>
             <View style={styles.resTrack}><View style={[styles.resFill, { width: `${currentMeta.resources.fuel * 100}%`, backgroundColor: Colors.sovietRed }]} /></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NEIGHBORING TERRITORIES</Text>
          {neighbors.map((n, i) => (
            <View key={i} style={styles.neighborRow}>
              <View style={styles.neighborInfo}>
                <Text style={styles.neighborHex}>{n.index}</Text>
                <Text style={styles.neighborBiome}>{n.biome.toUpperCase()}</Text>
              </View>
              <Text style={[styles.neighborOwner, { color: n.ownerId === 'unclaimed' ? '#666' : Colors.sovietRed }]}>
                {n.ownerId?.toUpperCase()}
              </Text>
              {n.ownerId === 'unclaimed' && (
                <TouchableOpacity style={styles.grantBtn} onPress={() => handleRequestGrant(n.index)}>
                  <Text style={styles.grantBtnText}>REQUEST GRANT</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SovietModal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: monoFont,
    fontSize: 14,
    color: Colors.sovietGold,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 179, 0, 0.3)',
    paddingBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    color: '#aaa',
    marginBottom: 4,
  },
  statValue: {
    fontFamily: monoFont,
    fontSize: 16,
    color: '#fff',
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    width: 80,
    color: '#fff',
  },
  resTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  resFill: {
    height: '100%',
  },
  neighborRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  neighborInfo: {
    flex: 1,
  },
  neighborHex: {
    fontFamily: monoFont,
    fontSize: 12,
    color: '#fff',
  },
  neighborBiome: {
    fontFamily: monoFont,
    fontSize: 10,
    color: '#aaa',
  },
  neighborOwner: {
    fontFamily: monoFont,
    fontSize: 10,
    marginHorizontal: 12,
  },
  grantBtn: {
    backgroundColor: Colors.sovietRed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  grantBtnText: {
    fontFamily: monoFont,
    fontSize: 10,
    color: '#fff',
  },
});
