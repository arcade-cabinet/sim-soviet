/**
 * BuildingPanel -- slide-in side panel showing building info when a building is clicked.
 * Reads the building entity from the ECS world and renders the appropriate content type.
 */

import type React from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AudioManager from '../audio/AudioManager';
import { getBuildingDef } from '../data/buildingDefs';
import type { Role } from '../data/buildingDefs.schema';
import { buildingsLogic } from '../ecs/archetypes';
import { closeBuildingPanel, openGovernmentHQ, useBuildingPanel } from '../stores/gameStore';
import {
  FactoryContent,
  FarmContent,
  GenericContent,
  HousingContent,
  PartyHQContent,
  ProductionContent,
  ServiceContent,
} from './BuildingPanelContent';
import { Colors, monoFont } from './styles';
import { useResponsive } from './useResponsive';

/** Roles that map to ProductionContent (fallback for power/other production). */
const PRODUCTION_ROLES: ReadonlySet<Role> = new Set(['power']);

/** Roles that map to ServiceContent. */
const SERVICE_ROLES: ReadonlySet<Role> = new Set(['services', 'culture', 'propaganda', 'military']);

/** The government-hq defId gets PartyHQContent. */
const PARTY_HQ_DEF_ID = 'government-hq';

export const BuildingPanel: React.FC = () => {
  const cell = useBuildingPanel();
  const { isCompact } = useResponsive();
  const panelWidth = isCompact ? 240 : 320;

  // Audio ducking
  useEffect(() => {
    if (cell) {
      AudioManager.getInstance().duck(0.2);
    } else {
      AudioManager.getInstance().unduck();
    }
  }, [cell]);

  // Find the building entity at this cell
  const entity = cell
    ? buildingsLogic.entities.find((e) => e.position.gridX === cell.x && e.position.gridY === cell.z)
    : undefined;

  // Close panel if the target building no longer exists
  useEffect(() => {
    if (cell && !entity) {
      closeBuildingPanel();
    }
  }, [cell, entity]);

  // Intercept government-hq clicks: open the GovernmentHQ panel instead
  useEffect(() => {
    if (cell && entity && entity.building.defId === PARTY_HQ_DEF_ID) {
      closeBuildingPanel();
      openGovernmentHQ();
    }
  }, [cell, entity]);

  if (!cell) return null;

  if (!entity) {
    return null;
  }

  // Government HQ is handled by the GovernmentHQ overlay, not the side panel
  if (entity.building.defId === PARTY_HQ_DEF_ID) {
    return null;
  }

  const def = getBuildingDef(entity.building.defId);
  if (!def) return null;

  const displayName = def.presentation.name.toUpperCase();

  // Select content component based on role and defId
  let ContentComponent: React.ReactNode;
  if (entity.building.defId === PARTY_HQ_DEF_ID) {
    ContentComponent = <PartyHQContent def={def} building={entity.building} gridX={cell.x} gridZ={cell.z} />;
  } else if (def.role === 'housing') {
    ContentComponent = <HousingContent def={def} building={entity.building} gridX={cell.x} gridZ={cell.z} />;
  } else if (def.role === 'agriculture') {
    ContentComponent = <FarmContent def={def} building={entity.building} gridX={cell.x} gridZ={cell.z} />;
  } else if (def.role === 'industry') {
    ContentComponent = <FactoryContent def={def} building={entity.building} gridX={cell.x} gridZ={cell.z} />;
  } else if (PRODUCTION_ROLES.has(def.role)) {
    ContentComponent = <ProductionContent def={def} building={entity.building} gridX={cell.x} gridZ={cell.z} />;
  } else if (SERVICE_ROLES.has(def.role)) {
    ContentComponent = <ServiceContent def={def} building={entity.building} gridX={cell.x} gridZ={cell.z} />;
  } else {
    ContentComponent = <GenericContent def={def} building={entity.building} gridX={cell.x} gridZ={cell.z} />;
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.panel, { width: panelWidth }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.icon}>{def.presentation.icon}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          <Pressable
            onPress={closeBuildingPanel}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close building panel"
          >
            <Text style={styles.closeText}>X</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Flavor text */}
        <Text style={styles.desc}>{def.presentation.desc}</Text>

        {/* Content */}
        <View style={styles.content}>{ContentComponent}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: '#1e2228',
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: Colors.panelHighlight,
    borderLeftColor: Colors.panelHighlight,
    borderBottomColor: Colors.panelShadow,
    borderRightColor: Colors.panelShadow,
    marginRight: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.sovietGold,
    letterSpacing: 1,
    flex: 1,
  },
  closeButton: {
    width: 28,
    height: 28,
    backgroundColor: Colors.sovietRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.sovietDarkRed,
  },
  closeText: {
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.white,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.panelHighlight,
    marginVertical: 8,
    opacity: 0.5,
  },
  desc: {
    fontFamily: monoFont,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  content: {
    flex: 1,
  },
});
