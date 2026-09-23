const holeUniforms = /* glsl */ `
  uniform vec4 uHole;
  uniform float uHoleOn;
`;

const holeMask = /* glsl */ `
  float holeMask() {
    if (uHoleOn < 0.04) return 1.0;
    vec2 d = abs(gl_FragCoord.xy - uHole.xy) / max(uHole.zw, vec2(1.0));
    return smoothstep(0.78, 1.06, max(d.x, d.y));
  }
`;

export const pointVertex = /* glsl */ `
  attribute float aImportance;
  uniform float uTime;
  uniform float uProgress;
  uniform float uSize;
  uniform vec3 uGold;
  uniform vec3 uIvory;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float shine = aImportance;
    float presence = mix(0.35, 1.0, smoothstep(0.0, 0.08, uProgress));
    presence *= 1.0 - smoothstep(0.97, 1.0, uProgress) * 0.45;
    vAlpha = presence * mix(0.12, 0.55, shine);
    vColor = mix(uIvory, uGold, smoothstep(0.18, 0.85, shine));
    float pulse = 1.0 + sin(uTime * 0.45 + aImportance * 6.0) * shine * 0.05;
    float dist = max(8.0, -mv.z);
    gl_PointSize = clamp(uSize * mix(1.0, 2.2, shine) * pulse * (140.0 / dist), 1.0, 3.6);
    gl_Position = projectionMatrix * mv;
  }
`;

export const pointFragment = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  ${holeUniforms}
  ${holeMask}

  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    float alpha = smoothstep(0.5, 0.16, d) * vAlpha * holeMask();
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export const lineVertex = /* glsl */ `
  attribute float aStrength;
  uniform float uProgress;
  uniform float uMorph;
  uniform float uInvertMorph;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dawn = 0.55 + 0.45 * smoothstep(0.02, 0.14, uProgress);
    float dusk = 1.0 - smoothstep(0.96, 1.0, uProgress) * 0.4;
    float morphFade = mix(1.0 - uMorph, uMorph, uInvertMorph);
    vAlpha = aStrength * dawn * dusk * morphFade;
    gl_Position = projectionMatrix * mv;
  }
`;

export const lineFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vAlpha;
  ${holeUniforms}
  ${holeMask}

  void main() {
    float alpha = vAlpha * holeMask();
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;
