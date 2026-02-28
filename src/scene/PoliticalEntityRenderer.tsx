/**
 * PoliticalEntityRenderer — 3D visualization of political entities on the game map.
 *
 * Renders politruks, KGB agents, military officers, and conscription officers
 * as procedural capsule-body figures with faction-colored materials and floating
 * badges. Entities are positioned near their assigned buildings and animate
 * with a subtle idle bob. Tapping/clicking an entity opens the PoliticalEntityPanel.
 *
 * No character GLB models exist in the asset manifest, so all geometry is
 * procedural (capsule body + sphere head + floating badge disc).
 */
import React, { useEffect, useRef } from 'react';
import {
  ActionManager,
  Color3,
  ExecuteCodeAction,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import { useScene } from 'reactylon';

import { getEngine } from '../bridge/GameInit';
import { openPoliticalPanel } from '../stores/gameStore';
import type { PoliticalEntityStats, PoliticalRole } from '../game/political/types';

// ── Faction colors ────────────────────────────────────────────────────────

const FACTION_COLORS: Record<PoliticalRole, Color3> = {
  politruk: new Color3(0.78, 0.16, 0.16),       // Soviet red
  kgb_agent: new Color3(0.2, 0.2, 0.22),        // Dark grey
  military_officer: new Color3(0.33, 0.42, 0.18),  // Olive green
  conscription_officer: new Color3(0.33, 0.42, 0.18), // Olive green (same as military)
};

const BADGE_COLORS: Record<PoliticalRole, Color3> = {
  politruk: new Color3(0.98, 0.75, 0.18),       // Gold (hammer/sickle)
  kgb_agent: new Color3(0.6, 0.6, 0.7),         // Steel grey (shield)
  military_officer: new Color3(0.85, 0.1, 0.1),  // Red star
  conscription_officer: new Color3(0.85, 0.65, 0.1), // Dark gold
};

// ── Scale & layout ────────────────────────────────────────────────────────

const BODY_HEIGHT = 0.55;
const BODY_DIAMETER = 0.2;
const HEAD_DIAMETER = 0.15;
const BADGE_DIAMETER = 0.12;
const BOB_AMPLITUDE = 0.03;
const BOB_SPEED = 1.5;
const BADGE_FLOAT_HEIGHT = 0.15;

// Offset from the building center so entities don't overlap with the building mesh
const ENTITY_OFFSET_X = 0.35;
const ENTITY_OFFSET_Z = 0.35;

// ── Managed entity tracking ──────────────────────────────────────────────

interface ManagedEntity {
  id: string;
  root: TransformNode;
  body: Mesh;
  head: Mesh;
  badge: Mesh;
  role: PoliticalRole;
  gridX: number;
  gridY: number;
  /** Phase offset for idle bob so multiple entities don't bob in sync. */
  bobPhase: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function createFigure(
  id: string,
  role: PoliticalRole,
  scene: Scene,
  bodyMat: StandardMaterial,
  headMat: StandardMaterial,
  badgeMat: StandardMaterial,
): { root: TransformNode; body: Mesh; head: Mesh; badge: Mesh } {
  const root = new TransformNode(`polEntity_${id}`, scene);

  // Body — capsule (approximated with a cylinder + 2 hemispheres via capsule)
  const body = MeshBuilder.CreateCapsule(
    `polBody_${id}`,
    {
      height: BODY_HEIGHT,
      radius: BODY_DIAMETER / 2,
      tessellation: 12,
      subdivisions: 4,
    },
    scene,
  );
  body.material = bodyMat;
  body.parent = root;
  body.position.y = BODY_HEIGHT / 2;

  // Head — sphere
  const head = MeshBuilder.CreateSphere(
    `polHead_${id}`,
    { diameter: HEAD_DIAMETER, segments: 10 },
    scene,
  );
  head.material = headMat;
  head.parent = root;
  head.position.y = BODY_HEIGHT + HEAD_DIAMETER / 2 - 0.02;

  // Badge — floating disc above head
  const badge = MeshBuilder.CreateDisc(
    `polBadge_${id}`,
    { radius: BADGE_DIAMETER / 2, tessellation: 16 },
    scene,
  );
  badge.material = badgeMat;
  badge.parent = root;
  badge.position.y = BODY_HEIGHT + HEAD_DIAMETER + BADGE_FLOAT_HEIGHT;
  // Face the badge toward the camera (billboard)
  badge.billboardMode = 7; // BILLBOARDMODE_ALL

  // Make the body mesh pickable for tap interaction
  body.isPickable = true;
  head.isPickable = true;
  badge.isPickable = true;

  // ActionManager for tap detection — attach to body (largest hit target)
  body.actionManager = new ActionManager(scene);
  body.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      openPoliticalPanel();
    }),
  );

  // Also register on head and badge for easier targeting
  head.actionManager = new ActionManager(scene);
  head.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      openPoliticalPanel();
    }),
  );

  badge.actionManager = new ActionManager(scene);
  badge.actionManager.registerAction(
    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
      openPoliticalPanel();
    }),
  );

  return { root, body, head, badge };
}

/**
 * Compute a small offset so multiple entities at the same building
 * don't stack perfectly on top of each other.
 */
function entityOffset(index: number): { dx: number; dz: number } {
  // Spread entities in a small ring around the building edge
  const angle = (index * 1.8) % (Math.PI * 2);
  return {
    dx: ENTITY_OFFSET_X * Math.cos(angle),
    dz: ENTITY_OFFSET_Z * Math.sin(angle),
  };
}

// ── Component ────────────────────────────────────────────────────────────

const PoliticalEntityRenderer: React.FC = () => {
  const scene = useScene();
  const managedRef = useRef<Map<string, ManagedEntity>>(new Map());
  const materialsRef = useRef<Map<string, StandardMaterial>>(new Map());
  const frameRef = useRef(0);

  useEffect(() => {
    const managed = managedRef.current;
    const materials = materialsRef.current;

    // Pre-create shared materials for each faction
    const roles: PoliticalRole[] = ['politruk', 'kgb_agent', 'military_officer', 'conscription_officer'];
    for (const role of roles) {
      // Body material
      const bodyMat = new StandardMaterial(`polBodyMat_${role}`, scene);
      bodyMat.diffuseColor = FACTION_COLORS[role];
      bodyMat.specularColor = Color3.Black();
      materials.set(`body_${role}`, bodyMat);

      // Head material (lighter skin tone)
      const headMat = new StandardMaterial(`polHeadMat_${role}`, scene);
      headMat.diffuseColor = new Color3(0.85, 0.72, 0.6);
      headMat.specularColor = Color3.Black();
      materials.set(`head_${role}`, headMat);

      // Badge material (emissive for glow)
      const badgeMat = new StandardMaterial(`polBadgeMat_${role}`, scene);
      badgeMat.emissiveColor = BADGE_COLORS[role];
      badgeMat.disableLighting = true;
      badgeMat.alpha = 0.9;
      materials.set(`badge_${role}`, badgeMat);
    }

    // Per-frame animation + sync
    let entityIndex = 0;

    function update() {
      frameRef.current++;
      const time = frameRef.current * 0.016; // Approximate seconds at ~60fps

      const engine = getEngine();
      if (!engine) return;

      const polSystem = engine.getPoliticalEntities();
      const entities = polSystem.getVisibleEntities();

      const activeIds = new Set<string>();
      entityIndex = 0;

      for (const entity of entities) {
        activeIds.add(entity.id);
        entityIndex++;

        let me = managed.get(entity.id);

        // Create figure if new
        if (!me) {
          const bodyMat = materials.get(`body_${entity.role}`)!;
          const headMat = materials.get(`head_${entity.role}`)!;
          const badgeMat = materials.get(`badge_${entity.role}`)!;

          const { root, body, head, badge } = createFigure(
            entity.id,
            entity.role,
            scene,
            bodyMat,
            headMat,
            badgeMat,
          );

          me = {
            id: entity.id,
            root,
            body,
            head,
            badge,
            role: entity.role,
            gridX: entity.stationedAt.gridX,
            gridY: entity.stationedAt.gridY,
            bobPhase: entityIndex * 0.7,
          };
          managed.set(entity.id, me);
        }

        // Update position if entity has moved
        if (me.gridX !== entity.stationedAt.gridX || me.gridY !== entity.stationedAt.gridY) {
          me.gridX = entity.stationedAt.gridX;
          me.gridY = entity.stationedAt.gridY;
        }

        // Position the root at the grid cell + offset
        const offset = entityOffset(entityIndex);
        me.root.position.x = me.gridX + 0.5 + offset.dx;
        me.root.position.z = me.gridY + 0.5 + offset.dz;

        // Idle bob animation
        const bob = Math.sin(time * BOB_SPEED + me.bobPhase) * BOB_AMPLITUDE;
        me.root.position.y = bob;

        // Badge slow spin
        me.badge.rotation.y = time * 0.8 + me.bobPhase;
      }

      // Remove entities that no longer exist
      for (const [id, me] of managed) {
        if (!activeIds.has(id)) {
          me.body.dispose();
          me.head.dispose();
          me.badge.dispose();
          me.root.dispose();
          managed.delete(id);
        }
      }
    }

    scene.registerBeforeRender(update);

    return () => {
      scene.unregisterBeforeRender(update);

      // Dispose all managed entities
      for (const me of managed.values()) {
        me.body.dispose();
        me.head.dispose();
        me.badge.dispose();
        me.root.dispose();
      }
      managed.clear();

      // Dispose materials
      for (const mat of materials.values()) {
        mat.dispose();
      }
      materials.clear();
    };
  }, [scene]);

  return null;
};

export default PoliticalEntityRenderer;
