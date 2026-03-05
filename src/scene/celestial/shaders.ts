/**
 * Celestial Body Factory — GLSL shader source.
 *
 * Ported from user's Celestial Megastructure Forge POC.
 * Core innovation: sphere→flat morphing via uFlatten uniform.
 */

// ── Simplex noise (shared by all celestial shaders) ──────────────────────────

export const noiseChunks = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 x) {
    float v = 0.0; float a = 0.5; vec3 shift = vec3(100.0);
    for (int i = 0; i < 5; ++i) { v += a * snoise(x); x = x * 2.0 + shift; a *= 0.5; }
    return v;
  }
`;

// ── Body vertex shader (sphere↔flat morph) ───────────────────────────────────

export const bodyVertexShader = /* glsl */ `
  uniform float time;
  uniform float uFlatten;
  uniform float uBodyType; // 0=Sun, 1=Terran, 2=Martian, 3=Jovian
  uniform float uShellRadius; // Outer shell radius for flat projection

  varying vec2 vUv;
  varying vec3 vSpherePosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  ${noiseChunks}

  void main() {
    vUv = uv;
    vNormal = normal;

    // 1. Topology displacement per body type
    float displacement = 0.0;
    if (uBodyType < 0.5) {
      displacement = snoise(position * 0.5 + time * 0.2) * 0.3; // Sun: boiling plasma
    } else if (uBodyType < 1.5) {
      float n = snoise(position * 1.5) * 0.25;
      displacement = max(n, 0.01); // Terran: landmasses up, oceans flat
    } else if (uBodyType < 2.5) {
      displacement = abs(snoise(position * 2.0)) * 0.2 + snoise(position * 5.0) * 0.05; // Mars: jagged
    } else {
      displacement = snoise(position * 1.0 + time * 0.05) * 0.03; // Jovian: smooth banding
    }

    vec3 sphericalPos = position + normal * displacement;
    vSpherePosition = sphericalPos;

    // 2. UV-unrolled flat position
    float width = 2.0 * 3.14159 * uShellRadius;
    float height = 3.14159 * uShellRadius;
    vec3 flatPos = vec3((uv.x - 0.5) * width, (uv.y - 0.5) * height, 7.0);

    // 3. Morph
    vec3 finalPos = mix(sphericalPos, flatPos, uFlatten);

    vec4 worldPos = modelMatrix * vec4(finalPos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// ── Body fragment shader (4 body types) ──────────────────────────────────────

export const bodyFragmentShader = /* glsl */ `
  precision highp float;

  uniform float time;
  uniform float uFlatten;
  uniform float uBodyType;

  varying vec2 vUv;
  varying vec3 vSpherePosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  ${noiseChunks}

  void main() {
    vec3 finalColor = vec3(0.0);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = 1.0 - max(dot(viewDirection, normalize(vNormal)), 0.0);

    if (uBodyType < 0.5) {
      // ── SUN ──
      float noiseVal = fbm(vSpherePosition * 1.5 - time * 0.5);
      vec3 colorDark = vec3(0.9, 0.3, 0.0);
      vec3 colorMid = vec3(1.0, 0.65, 0.0);
      vec3 colorBright = vec3(1.2, 1.0, 0.5);
      finalColor = mix(colorDark, colorMid, smoothstep(-0.5, 0.5, noiseVal));
      finalColor = mix(finalColor, colorBright, smoothstep(0.2, 1.0, noiseVal));
      rim = smoothstep(0.5, 1.0, rim);
      finalColor += vec3(1.0, 0.8, 0.0) * rim * 1.5 * (1.0 - uFlatten);

    } else if (uBodyType < 1.5) {
      // ── TERRAN ──
      float n = fbm(vSpherePosition * 2.0);
      vec3 deepWater = vec3(0.02, 0.1, 0.3);
      vec3 shallowWater = vec3(0.05, 0.4, 0.5);
      vec3 land = vec3(0.1, 0.4, 0.15);
      vec3 mountain = vec3(0.5, 0.4, 0.3);
      vec3 snow = vec3(0.9, 0.9, 0.9);
      if (n < 0.45) finalColor = mix(deepWater, shallowWater, n / 0.45);
      else if (n < 0.65) finalColor = mix(land, mountain, (n - 0.45) / 0.2);
      else finalColor = mix(mountain, snow, (n - 0.65) / 0.35);
      // Clouds
      float c = fbm(vSpherePosition * 3.0 + time * 0.02);
      finalColor = mix(finalColor, vec3(0.9), smoothstep(0.55, 0.8, c) * 0.8);
      // Atmosphere
      finalColor += vec3(0.3, 0.6, 1.0) * pow(rim, 3.0) * (1.0 - uFlatten);
      float diffuse = max(dot(normalize(vNormal), viewDirection), 0.1);
      finalColor *= (diffuse * 0.8 + 0.2);

    } else if (uBodyType < 2.5) {
      // ── MARTIAN ──
      float n = fbm(vSpherePosition * 2.5);
      vec3 dust = vec3(0.7, 0.3, 0.1);
      vec3 rock = vec3(0.3, 0.1, 0.05);
      finalColor = mix(rock, dust, n);
      finalColor += vec3(0.8, 0.4, 0.1) * pow(rim, 4.0) * 0.5 * (1.0 - uFlatten);
      float diffuse = max(dot(normalize(vNormal), viewDirection), 0.1);
      finalColor *= (diffuse * 0.9 + 0.1);

    } else {
      // ── JOVIAN ──
      vec3 p = vSpherePosition;
      float warp = fbm(p * 1.5 + time * 0.03);
      float band = sin(p.y * 8.0 + warp * 3.0);
      vec3 c1 = vec3(0.7, 0.6, 0.5);
      vec3 c2 = vec3(0.6, 0.3, 0.1);
      vec3 c3 = vec3(0.8, 0.7, 0.6);
      finalColor = mix(mix(c1, c2, smoothstep(-1.0, 0.0, band)), c3, smoothstep(0.5, 1.0, band));
      finalColor += vec3(0.9, 0.8, 0.7) * pow(rim, 2.0) * 0.4 * (1.0 - uFlatten);
      float diffuse = max(dot(normalize(vNormal), viewDirection), 0.1);
      finalColor *= (diffuse * 0.8 + 0.2);
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ── Shell vertex shader (hex panel morph) ────────────────────────────────────

export const shellVertexShader = /* glsl */ `
  uniform float uFlatten;

  varying vec3 vSpherePosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vSpherePosition = position;

    vec3 sphericalPos = position;
    vec3 sphericalNorm = normal;

    float radius = 8.5;
    float width = 2.0 * 3.14159 * radius;
    float height = 3.14159 * radius;
    vec3 flatPos = vec3((uv.x - 0.5) * width, (uv.y - 0.5) * height, radius);
    vec3 flatNorm = vec3(0.0, 0.0, 1.0);

    vec3 finalPos = mix(sphericalPos, flatPos, uFlatten);
    vNormal = normalize(normalMatrix * mix(sphericalNorm, flatNorm, uFlatten));

    vec4 worldPos = modelMatrix * vec4(finalPos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// ── Shell fragment shader (hex panels with build progress) ───────────────────

export const shellFragmentShader = /* glsl */ `
  precision highp float;

  uniform float time;
  uniform float uProgress;
  uniform float uFlatten;

  varying vec3 vSpherePosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  vec4 hexCoords(vec2 uv) {
    vec2 r = vec2(1.0, 1.73205081);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec2 id = uv - gv;
    return vec4(gv.x, gv.y, id.x, id.y);
  }

  void main() {
    float hexYRatio = 1.73205081;
    vec2 uv = vUv * vec2(32.0, 16.0 * hexYRatio);
    vec4 hex = hexCoords(uv);
    vec2 gv = hex.xy;
    vec2 id = hex.zw;
    float hexDist = max(abs(gv.x), dot(abs(gv), normalize(vec2(1.0, 1.73205081))));

    // Build progress per-panel
    float macroBuild = (vSpherePosition.y + 8.5) / 17.0;
    float localRandom = hash(id * 7.77);
    float hexBuildOrder = mix(localRandom, macroBuild, 0.4);
    float frameThreshold = hexBuildOrder * 0.75;
    float panelThreshold = frameThreshold + 0.10 + (hash(id * 3.14) * 0.15);

    if (uProgress < frameThreshold) { discard; }

    // Welding glow effects
    float weldingFrame = smoothstep(0.04, 0.0, uProgress - frameThreshold) * step(frameThreshold, uProgress);
    float weldingPanel = smoothstep(0.04, 0.0, uProgress - panelThreshold) * step(panelThreshold, uProgress);

    float type = hash(id);
    float frameInner = 0.40;
    vec3 frameColor = vec3(0.9, 0.65, 0.1); // Golden lattice
    vec3 panelBlue = vec3(0.02, 0.06, 0.25); // Dark blue solar array
    vec3 finalColor = vec3(0.0);

    if (hexDist > frameInner) {
      // FRAME (structural lattice)
      finalColor = frameColor;
      float edge = smoothstep(frameInner, frameInner + 0.04, hexDist);
      float outerEdge = smoothstep(0.48, 0.5, hexDist);
      finalColor *= mix(0.7, 1.0, edge) * mix(1.0, 0.5, outerEdge);
      finalColor += vec3(2.0, 2.5, 3.0) * weldingFrame;
    } else {
      // PANEL (solar array or gap)
      if (uProgress < panelThreshold) { discard; }
      if (type > 0.15) {
        // 85%: Solar panel with micro-grid
        vec2 innerGrid = fract(gv * 12.0);
        float gridLines = step(0.1, innerGrid.x) * step(0.1, innerGrid.y);
        vec3 pColor = mix(vec3(0.0, 0.02, 0.1), panelBlue, gridLines);
        pColor *= smoothstep(frameInner, frameInner - 0.08, hexDist);

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 reflectDir = reflect(-viewDir, vNormal);
        float spec = pow(max(dot(reflectDir, normalize(vec3(1.0, 1.0, 1.0))), 0.0), 30.0);
        pColor += vec3(0.3, 0.5, 0.8) * spec * 0.4;

        finalColor = pColor;
        finalColor += vec3(1.0, 2.0, 3.0) * weldingPanel;
      } else {
        // 15%: Gap (see through to star)
        discard;
      }
    }

    // Rim glow (fades when flattened)
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    finalColor += vec3(1.0, 0.9, 0.7) * pow(rim, 3.0) * 0.3 * (1.0 - uFlatten);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

/** Body type enum matching shader uBodyType values. */
export type CelestialBodyType = 'sun' | 'terran' | 'martian' | 'jovian';

/** Map body type name to shader float value. */
export const BODY_TYPE_VALUE: Record<CelestialBodyType, number> = {
  sun: 0,
  terran: 1,
  martian: 2,
  jovian: 3,
};
