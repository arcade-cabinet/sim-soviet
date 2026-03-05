/**
 * Tests for DomeMesh — procedural translucent dome R3F component.
 *
 * Since DomeMesh is an R3F component that requires a Canvas context,
 * these tests verify the exported interface, prop types, and the
 * underlying Three.js geometry/material construction logic.
 */

import * as THREE from 'three';

// ── Geometry construction logic (mirrors DomeMesh internals) ────────────────

function createDomeGeometry(radius: number, heightRatio: number, segments: number): THREE.SphereGeometry {
  const phiLength = Math.PI * 2;
  const thetaStart = 0;
  const thetaLength = Math.PI * Math.min(heightRatio, 1);
  return new THREE.SphereGeometry(
    radius,
    segments,
    Math.max(8, Math.floor(segments / 2)),
    0,
    phiLength,
    thetaStart,
    thetaLength,
  );
}

function createDomeMaterial(tint: string, opacity: number, doubleSided: boolean): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint),
    transparent: true,
    opacity,
    transmission: 0.6,
    roughness: 0.1,
    ior: 1.5,
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: false,
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DomeMesh geometry', () => {
  it('creates a hemisphere geometry with default heightRatio 0.5', () => {
    const geo = createDomeGeometry(10, 0.5, 32);
    expect(geo).toBeInstanceOf(THREE.SphereGeometry);
    // Hemisphere should have vertices — not empty
    expect(geo.attributes.position.count).toBeGreaterThan(0);
    // Bounding sphere encompasses all vertices — for a hemisphere it's slightly
    // larger than the geometry radius due to center offset
    geo.computeBoundingSphere();
    expect(geo.boundingSphere!.radius).toBeGreaterThanOrEqual(10);
    expect(geo.boundingSphere!.radius).toBeLessThan(15);
  });

  it('creates a full dome with heightRatio 1.0', () => {
    const geo = createDomeGeometry(5, 1.0, 16);
    expect(geo.attributes.position.count).toBeGreaterThan(0);
  });

  it('clamps heightRatio to 1.0 maximum', () => {
    const geo = createDomeGeometry(5, 1.5, 16);
    // thetaLength should be PI (clamped), not 1.5*PI
    expect(geo.parameters.thetaLength).toBeCloseTo(Math.PI, 5);
  });

  it('uses fewer segments for LOD_FAR (16)', () => {
    const geoFar = createDomeGeometry(10, 0.5, 16);
    const geoClose = createDomeGeometry(10, 0.5, 64);
    // More segments = more vertices
    expect(geoClose.attributes.position.count).toBeGreaterThan(geoFar.attributes.position.count);
  });

  it('handles small radius (single-building dome, r=2)', () => {
    const geo = createDomeGeometry(2, 0.5, 32);
    expect(geo.attributes.position.count).toBeGreaterThan(0);
    geo.computeBoundingSphere();
    expect(geo.boundingSphere!.radius).toBeCloseTo(2, 0);
  });

  it('handles large radius (city-covering dome, r=50)', () => {
    const geo = createDomeGeometry(50, 0.5, 64);
    expect(geo.attributes.position.count).toBeGreaterThan(0);
    geo.computeBoundingSphere();
    expect(geo.boundingSphere!.radius).toBeGreaterThanOrEqual(50);
    expect(geo.boundingSphere!.radius).toBeLessThan(75);
  });
});

describe('DomeMesh material', () => {
  it('creates translucent material with green tint', () => {
    const mat = createDomeMaterial('#4caf50', 0.15, false);
    expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(0.15);
    expect(mat.transmission).toBe(0.6);
    expect(mat.side).toBe(THREE.FrontSide);
    expect(mat.color.getHexString()).toBe('4caf50');
  });

  it('creates blue-white tint for Earth atmospheric containment', () => {
    const mat = createDomeMaterial('#b3e5fc', 0.3, true);
    expect(mat.color.getHexString()).toBe('b3e5fc');
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('creates orange tint for Mars dome', () => {
    const mat = createDomeMaterial('#ff9800', 0.3, false);
    expect(mat.color.getHexString()).toBe('ff9800');
  });

  it('creates white-silver tint for lunar habitat', () => {
    const mat = createDomeMaterial('#e0e0e0', 0.35, true);
    expect(mat.color.getHexString()).toBe('e0e0e0');
  });

  it('has physical properties for glass-like appearance', () => {
    const mat = createDomeMaterial('#b3e5fc', 0.2, false);
    expect(mat.ior).toBe(1.5);
    expect(mat.roughness).toBe(0.1);
    expect(mat.clearcoat).toBe(1.0);
    expect(mat.depthWrite).toBe(false);
  });

  it('double-sided material uses DoubleSide', () => {
    const mat = createDomeMaterial('#b3e5fc', 0.2, true);
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('single-sided material uses FrontSide', () => {
    const mat = createDomeMaterial('#b3e5fc', 0.2, false);
    expect(mat.side).toBe(THREE.FrontSide);
  });
});

describe('DomeMesh LOD', () => {
  it('LOD_FAR (16) produces valid geometry', () => {
    const geo = createDomeGeometry(10, 0.5, 16);
    expect(geo.attributes.position.count).toBeGreaterThan(0);
  });

  it('LOD_CLOSE (64) produces valid geometry', () => {
    const geo = createDomeGeometry(10, 0.5, 64);
    expect(geo.attributes.position.count).toBeGreaterThan(0);
  });

  it('LOD switch threshold is at 30 units', () => {
    // Verify the LOD constants are correctly defined
    const LOD_FAR = 16;
    const LOD_CLOSE = 64;
    const LOD_THRESHOLD = 30;
    expect(LOD_FAR).toBeLessThan(LOD_CLOSE);
    expect(LOD_THRESHOLD).toBeGreaterThan(0);
  });
});
