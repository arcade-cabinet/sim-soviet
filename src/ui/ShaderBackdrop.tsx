import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BrandColors } from './designTokens';

const vertexShader = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.48;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 centered = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float smoke = fbm(centered * 2.2 + vec2(u_time * 0.035, -u_time * 0.02));
  float paper = fbm(centered * 7.0 + vec2(-u_time * 0.015, u_time * 0.025));
  float beam = smoothstep(0.78, 0.18, abs(centered.y + 0.18 * sin(centered.x * 2.5 + u_time * 0.25)));
  float sweep = smoothstep(0.015, 0.0, abs(fract((uv.x + uv.y * 0.18 - u_time * 0.018) * 16.0) - 0.5));
  float vignette = smoothstep(0.92, 0.18, length(centered));

  vec3 coal = vec3(0.043, 0.039, 0.031);
  vec3 oxide = vec3(0.42, 0.10, 0.08);
  vec3 amber = vec3(0.84, 0.58, 0.18);
  vec3 green = vec3(0.13, 0.24, 0.20);
  vec3 steel = vec3(0.18, 0.29, 0.31);

  vec3 color = coal;
  color = mix(color, steel, 0.38 * smoke);
  color = mix(color, green, 0.28 * paper);
  color = mix(color, oxide, 0.13 * beam);
  color += amber * (0.05 * sweep + 0.08 * beam);
  color *= vignette;

  gl_FragColor = vec4(color, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export const ShaderBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!context) return;

    const vertex = compile(context, context.VERTEX_SHADER, vertexShader);
    const fragment = compile(context, context.FRAGMENT_SHADER, fragmentShader);
    const program = context.createProgram();
    if (!vertex || !fragment || !program) return;

    context.attachShader(program, vertex);
    context.attachShader(program, fragment);
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) return;

    const buffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), context.STATIC_DRAW);

    const position = context.getAttribLocation(program, 'a_position');
    const resolution = context.getUniformLocation(program, 'u_resolution');
    const time = context.getUniformLocation(program, 'u_time');
    const bindProgram = context.useProgram.bind(context);

    let frame = 0;
    const startedAt = performance.now();
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.viewport(0, 0, width, height);
      }
    };

    const render = () => {
      resize();
      bindProgram(program);
      context.bindBuffer(context.ARRAY_BUFFER, buffer);
      context.enableVertexAttribArray(position);
      context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
      context.uniform2f(resolution, canvas.width, canvas.height);
      context.uniform1f(time, (performance.now() - startedAt) / 1000);
      context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
      frame = requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize);
    render();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      context.deleteBuffer(buffer);
      context.deleteProgram(program);
      context.deleteShader(vertex);
      context.deleteShader(fragment);
    };
  }, []);

  if (Platform.OS !== 'web') {
    return <View pointerEvents="none" style={styles.nativeFallback} />;
  }

  return React.createElement('canvas', {
    ref: canvasRef,
    'aria-hidden': true,
    style: webCanvasStyle,
  });
};

const webCanvasStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  backgroundColor: BrandColors.black,
  pointerEvents: 'none',
};

const styles = StyleSheet.create({
  nativeFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BrandColors.black,
  },
});
