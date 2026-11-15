import * as THREE from 'three';
import type { CameraConfig } from '@/types/project';
import { derive, whiteBalanceGains } from '@/lib/camera/settings';
import { profile, CURVE_ID } from '@/lib/camera/profiles';
import { body as bodyById } from '@/lib/camera/bodies';

/** Exposure scale that makes f/2.8, 1/48 s, ISO 800 with a 100% key at 2 m read as a normal exposure. */
export const EXPOSURE_K = 0.95;

const frag = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float focusDist;
uniform float cocScale;
uniform float maxBlur;
uniform float exposure;
uniform vec3 wb;
uniform float noise;
uniform float seed;
uniform int curve;
uniform float saturation;
uniform bool lut;
uniform float panBlur;
varying vec2 vUv;

float viewZ(float d) { return (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar); }
float cocAt(vec2 uv) {
  float z = -viewZ(texture2D(tDepth, uv).x);
  return min(maxBlur, cocScale * abs(z - focusDist) / max(z, 0.001));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
float log10(float x) { return log(x) / 2.302585093; }
float enc(float v) {
  v = max(v, 0.0);
  if (curve == 6) return v >= 0.01125 ? (420.0 + log10((v + 0.01) / 0.19) * 261.5) / 1023.0 : (v * (171.2102946929 - 95.0) / 0.01125 + 95.0) / 1023.0;
  if (curve == 5) return v >= 0.014 ? 0.36726845 * log10(v * 14.98325 + 1.0) + 0.12783901 : 1.9754798 * v + 0.12512219;
  if (curve == 4) return 0.24136077 * log10(v * 87.09937546 + 1.0) + 0.092864125;
  if (curve == 3) return 0.529136 * log10(v * 10.1596 + 1.0) + 0.0730597;
  if (curve == 7) return v >= 0.01 ? 0.241514 * log10(v + 0.00873) + 0.598206 : 5.6 * v + 0.125;
  if (curve == 8) return v >= 0.000889 ? 0.245281 * log10(5.555556 * v + 0.064829) + 0.384316 : 8.799461 * v + 0.092864;
  if (curve == 9) return 0.27 * log10(v * 30.0 + 1.0) + 0.09;
  if (curve == 10) { float e = v / 3.2; return e <= 1.0 / 12.0 ? sqrt(3.0 * e) : 0.17883277 * log(12.0 * e - 0.28466892) + 0.55991073; }
  return v;
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 display(vec3 c) { return pow(aces(c), vec3(1.0 / 2.2)); }

void main() {
  float r0 = cocAt(vUv) * 0.5;
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    float a = fi * 2.39996323;
    float rr = sqrt((fi + 0.5) / 40.0);
    vec2 off = vec2(cos(a), sin(a)) * rr * r0 + vec2((fi / 39.0 - 0.5) * panBlur, 0.0);
    vec2 uv = clamp(vUv + off / resolution, vec2(0.0), vec2(1.0));
    // Samples much sharper than this pixel's blur and in front of it are weighted down, to limit halos.
    float rs = cocAt(uv) * 0.5;
    float w = rs + 1.0 >= length(off) ? 1.0 : 0.25;
    sum += texture2D(tColor, uv).rgb * w;
    wsum += w;
  }
  vec3 c = sum / wsum * exposure * wb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  vec3 o;
  bool isLog = curve >= 3;
  if (isLog && !lut) {
    o = vec3(enc(c.r), enc(c.g), enc(c.b));
  } else if (curve == 1) {
    o = mix(display(c), vec3(enc(c.r * 0.8), enc(c.g * 0.8), enc(c.b * 0.8)) * 0.0 + display(c * 0.85) * 0.9 + 0.05, 0.6);
  } else if (curve == 2) {
    o = display(c * 0.92) * 0.94 + 0.02;
  } else {
    o = display(c);
  }
  o += (hash(vUv * resolution) - 0.5) * noise;
  gl_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);
}`;

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function gradeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 100 },
      focusDist: { value: 2 },
      cocScale: { value: 0 },
      maxBlur: { value: 48 },
      exposure: { value: 1 },
      wb: { value: new THREE.Vector3(1, 1, 1) },
      noise: { value: 0 },
      seed: { value: 0 },
      curve: { value: 0 },
      saturation: { value: 1 },
      lut: { value: false },
      panBlur: { value: 0 },
    },
  });
}

/** Push the camera settings into the preview shader. widthPx is the render target width. */
export function applyGrade(m: THREE.ShaderMaterial, c: CameraConfig, widthPx: number, ambientStops = 0) {
  const d = derive(c, widthPx);
  const prof = profile(c.profile);
  const b = bodyById(c.bodyId);
  const f = c.focalLength;
  const s = Math.max(c.focusDistance * 1000, f + 1);
  const cocMm = (f * f) / (c.aperture * (s - f));
  m.uniforms.focusDist.value = c.focusDistance;
  m.uniforms.cocScale.value = (cocMm / d.sensor.width) * widthPx;
  m.uniforms.exposure.value = EXPOSURE_K * Math.pow(2, d.cameraStops + ambientStops);
  const [r, g, bl] = whiteBalanceGains(c.kelvin, c.tint);
  m.uniforms.wb.value.set(r, g, bl);
  const native = b.nativeIso.filter((n) => n <= c.iso).slice(-1)[0] ?? b.nativeIso[0];
  m.uniforms.noise.value = Math.min(0.25, 0.006 * Math.pow(2, 0.7 * Math.log2(Math.max(1, c.iso / native))));
  m.uniforms.curve.value = CURVE_ID[prof.curve];
  m.uniforms.saturation.value = c.monitorLut && prof.kind === 'log' ? 1 : prof.saturation;
  m.uniforms.lut.value = c.monitorLut;
  m.uniforms.panBlur.value = Math.min(120, d.panBlurPx);
  m.uniforms.seed.value = (c.iso % 97) * 0.37;
}
