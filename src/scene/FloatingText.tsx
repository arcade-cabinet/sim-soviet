/**
 * FloatingText -- Billboard text labels above buildings/tiles.
 *
 * Reads gameState.floatingTexts[] array. Each text = drei Billboard + Text
 * component positioned above the building/tile. Text floats upward and fades
 * out over its life duration. Outline stroke for readability.
 *
 * R3F migration: uses drei <Billboard> + <Text> replacing BabylonJS
 * DynamicTexture on plane meshes.
 */
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';

import { gameState } from '../engine/GameState';

// ── Single floating text label ──────────────────────────────────────────────

interface FloatingLabelProps {
  index: number;
}

const FloatingLabel: React.FC<FloatingLabelProps> = ({ index }) => {
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<any>(null);

  useFrame(() => {
    const texts = gameState.floatingTexts;
    const t = texts[index];
    const group = groupRef.current;
    if (!group) return;

    if (!t || t.life <= 0) {
      group.visible = false;
      return;
    }

    group.visible = true;

    // Float upward as life decreases
    const progress = 1 - t.life / t.maxLife;
    const cellZ = gameState.grid[Math.round(t.y)]?.[Math.round(t.x)]?.z ?? 0;
    const posY = cellZ + 1 + progress * 2;

    group.position.set(t.x, posY, t.y);

    // Fade out
    if (textRef.current?.material) {
      textRef.current.material.transparent = true;
      textRef.current.material.opacity = t.life / t.maxLife;
    }
  });

  // Read initial state for text content and color
  const texts = gameState.floatingTexts;
  const t = texts[index];
  if (!t || t.life <= 0) return null;

  return (
    <group ref={groupRef}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          ref={textRef}
          fontSize={0.3}
          color={t.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
          font={undefined}
        >
          {t.text}
        </Text>
      </Billboard>
    </group>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

/** Maximum concurrent floating texts to render */
const MAX_LABELS = 20;

const FloatingText: React.FC = () => {
  // Pre-allocate slots and let each one check if its index is valid
  const slots = Array.from({ length: MAX_LABELS }, (_, i) => i);

  return (
    <>
      {slots.map((i) => (
        <FloatingLabel key={i} index={i} />
      ))}
    </>
  );
};

export default FloatingText;
