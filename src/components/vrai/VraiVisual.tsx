import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SIMPLEX_3D } from "./glsl";

export type VraiState = "idle" | "thinking" | "listening" | "speaking";

interface Props {
  state?: VraiState;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  A living energy presence: morphing core, GPU particles, streams   */
/* ------------------------------------------------------------------ */

const CORE_VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uPulse;
uniform float uWave;
varying vec3 vNormalW;
varying vec3 vPos;
varying float vDisp;
${SIMPLEX_3D}

void main(){
  vec3 p = normalize(position);
  float t = uTime * (0.22 + uEnergy * 0.4);

  // layered breathing + morphing displacement
  float n = fbm(p * 1.5 + vec3(0.0, t, t * 0.5));
  float ridge = snoise(p * 3.4 + vec3(t * 1.3, 0.0, -t));
  float breathe = sin(uTime * 0.55) * 0.06 + sin(uTime * 0.23 + 1.7) * 0.04;

  float wave = 0.0;
  if(uWave > 0.0){
    float ring = uWave * 3.2;
    wave = 0.18 * exp(-6.0 * abs(length(p * 1.0) * 0.0 + (1.0 - dot(p, vec3(0.0,0.0,1.0))) - ring)) * (1.0 - uWave);
  }

  float disp = n * (0.30 + uEnergy * 0.22)
             + ridge * (0.07 + uEnergy * 0.10)
             + breathe
             + uPulse * 0.09
             + wave;

  vDisp = disp;
  vec3 displaced = p * (1.0 + disp);
  vPos = displaced;
  vNormalW = normalize(normalMatrix * p);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const CORE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uOpacity;
varying vec3 vNormalW;
varying vec3 vPos;
varying float vDisp;

void main(){
  vec3 viewDir = normalize(-vPos - vec3(0.0, 0.0, -6.0));
  float fres = pow(1.0 - abs(dot(normalize(vNormalW), vec3(0.0, 0.0, 1.0))), 2.2);
  float band = smoothstep(-0.25, 0.55, vDisp);

  vec3 col = mix(uColorA, uColorB, band);
  col = mix(col, uColorC, fres * 0.75);
  col += vec3(0.55, 0.75, 1.0) * pow(fres, 3.0) * (0.6 + uEnergy);

  float alpha = uOpacity * (0.18 + fres * 0.85 + band * 0.25) * (0.75 + uEnergy * 0.5);
  gl_FragColor = vec4(col, alpha);
}
`;

const PARTICLE_VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uPulse;
uniform float uWave;
uniform vec3 uMouse;
uniform float uPixelRatio;
attribute float aRadius;
attribute float aSpeed;
attribute float aSize;
attribute float aSeed;
attribute vec3 aAxis;
varying float vAlpha;
varying float vTint;
${SIMPLEX_3D}

mat3 rotAxis(vec3 axis, float a){
  float s = sin(a), c = cos(a);
  float oc = 1.0 - c;
  return mat3(
    oc*axis.x*axis.x + c,        oc*axis.x*axis.y - axis.z*s, oc*axis.z*axis.x + axis.y*s,
    oc*axis.x*axis.y + axis.z*s, oc*axis.y*axis.y + c,        oc*axis.y*axis.z - axis.x*s,
    oc*axis.z*axis.x - axis.y*s, oc*axis.y*axis.z + axis.x*s, oc*axis.z*axis.z + c
  );
}

void main(){
  float t = uTime;
  float speed = aSpeed * (0.6 + uEnergy * 1.5);

  // orbital radius drifts: some escape outward, some fall back in
  float drift = sin(t * (0.12 + aSpeed * 0.35) + aSeed * 24.0);
  float escape = smoothstep(0.75, 1.0, drift) * 2.4;
  float r = aRadius * (1.0 + drift * 0.18) + escape + uPulse * 0.25;

  // ring wave from click ripples outward
  if(uWave > 0.0){
    float ring = uWave * 7.0;
    r += 0.55 * exp(-4.0 * abs(r - ring)) * (1.0 - uWave);
  }

  vec3 base = vec3(r, 0.0, 0.0);
  base = rotAxis(normalize(aAxis), t * speed + aSeed * 6.28318) * base;
  base += flowField(base * 0.4 + aSeed * 3.0, t) * (0.8 + uEnergy * 1.6);

  // gentle magnetic attraction toward the pointer
  vec3 toM = uMouse - base;
  float d = length(toM);
  base += normalize(toM + 0.0001) * (1.6 / (1.0 + d * d * 1.6));

  vec4 mv = modelViewMatrix * vec4(base, 1.0);

  float life = fract(t * (0.05 + aSpeed * 0.06) + aSeed);
  float fade = sin(life * 3.14159265);
  vAlpha = fade * (0.25 + aSize * 0.75) * (0.6 + uEnergy * 0.7);
  vTint = fract(aSeed * 7.31);

  gl_Position = projectionMatrix * mv;
  gl_PointSize = (aSize * 16.0 + uEnergy * 8.0) * uPixelRatio * (7.0 / -mv.z);
}
`;

const PARTICLE_FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying float vAlpha;
varying float vTint;

void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if(d > 0.5) discard;
  float glow = pow(1.0 - d * 2.0, 2.4);
  vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.7, vTint));
  col = mix(col, uColorC, smoothstep(0.82, 1.0, vTint));
  col += vec3(0.5, 0.7, 1.0) * pow(glow, 4.0) * 0.7;
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

const STREAM_VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const STREAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uLife;
uniform float uOffset;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;

void main(){
  // envelope: fade in at birth, out at death
  float env = smoothstep(0.0, 0.18, uLife) * (1.0 - smoothstep(0.72, 1.0, uLife));
  // energy pulse travelling along the path
  float head = fract(uTime * (0.22 + uEnergy * 0.4) + uOffset);
  float d = abs(vUv.x - head);
  d = min(d, 1.0 - d);
  float pulse = exp(-38.0 * d) + exp(-160.0 * d) * 1.6;
  float trail = exp(-9.0 * d);
  float edge = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.65, 1.0, vUv.y));
  vec3 col = mix(uColorA, uColorB, vUv.x);
  col += vec3(0.7, 0.85, 1.0) * pulse * 0.9;
  float a = env * edge * (trail * 0.28 + pulse * 0.75) * (0.5 + uEnergy * 0.9);
  gl_FragColor = vec4(col, a);
}
`;

const NEBULA_FRAG = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;
uniform float uEnergy;
varying vec2 vUv;
${SIMPLEX_3D}

void main(){
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
  float t = uTime * 0.035;

  float f1 = fbm(vec3(p * 1.5, t));
  float f2 = fbm(vec3(p * 2.6 + f1 * 0.6, t * 1.4 + 4.0));
  float fog = smoothstep(-0.4, 1.0, f1 * 0.7 + f2 * 0.5);

  float vig = 1.0 - smoothstep(0.15, 1.05, length(p));
  vec3 blue = vec3(0.05, 0.20, 0.52);
  vec3 violet = vec3(0.22, 0.10, 0.45);
  vec3 col = mix(blue, violet, smoothstep(0.2, 0.9, f2));
  col *= fog * (0.30 + uEnergy * 0.22) * (0.35 + vig);

  // faint central atmospheric bloom
  col += vec3(0.06, 0.16, 0.34) * pow(vig, 3.0) * (0.7 + uEnergy);

  gl_FragColor = vec4(col, 1.0);
}
`;

const NEBULA_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`;

const STAR_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aSize;
attribute float aSeed;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.55 + 0.45 * sin(uTime * (0.5 + aSeed) + aSeed * 12.0);
  vA = tw * aSize;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (aSize * 3.2) * uPixelRatio;
}
`;

const STAR_FRAG = /* glsl */ `
varying float vA;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if(d > 0.5) discard;
  float g = pow(1.0 - d * 2.0, 2.0);
  gl_FragColor = vec4(vec3(0.72, 0.85, 1.0) * g, g * vA * 0.75);
}
`;

const COLORS = {
  a: new THREE.Color("#1e6bff"), // electric blue
  b: new THREE.Color("#43e6ff"), // cyan
  c: new THREE.Color("#ffffff"), // white
  p: new THREE.Color("#8b5cf6"), // soft purple
  m: new THREE.Color("#e152ff"), // magenta accent
};

function randomStream(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const inner = 1.7 + Math.random() * 0.4;
  const outer = 3.6 + Math.random() * 3.4;
  const start = new THREE.Vector3().setFromSphericalCoords(
    inner,
    Math.acos(THREE.MathUtils.randFloatSpread(2)),
    Math.random() * Math.PI * 2,
  );
  const end = new THREE.Vector3().setFromSphericalCoords(
    outer,
    Math.acos(THREE.MathUtils.randFloatSpread(2)),
    Math.random() * Math.PI * 2,
  );
  pts.push(start);
  const segs = 3;
  for (let i = 1; i < segs; i++) {
    const l = i / segs;
    const mid = start.clone().lerp(end, l);
    const bulge = 1 + Math.sin(l * Math.PI) * (0.35 + Math.random() * 0.6);
    mid.multiplyScalar(bulge);
    mid.add(
      new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(1.8),
        THREE.MathUtils.randFloatSpread(1.8),
        THREE.MathUtils.randFloatSpread(1.8),
      ),
    );
    pts.push(mid);
  }
  pts.push(end);
  return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.6);
}

export default function VraiVisual({ state = "idle", className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<VraiState>(state);
  stateRef.current = state;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    renderer.setClearColor(0x03060f, 1);
    let dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.4 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 7.6);

    /* -------- shared uniforms -------- */
    const uTime = { value: 0 };
    const uEnergy = { value: 0 };
    const uPulse = { value: 0 };
    const uWave = { value: 0 };
    const uMouse = { value: new THREE.Vector3(999, 999, 0) };
    const uPixelRatio = { value: dpr };

    /* -------- nebula fog backdrop -------- */
    const nebula = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERT,
        fragmentShader: NEBULA_FRAG,
        uniforms: {
          uTime,
          uEnergy,
          uRes: { value: new THREE.Vector2(host.clientWidth, host.clientHeight) },
        },
        depthWrite: false,
        depthTest: false,
      }),
    );
    nebula.frustumCulled = false;
    nebula.renderOrder = -1;
    scene.add(nebula);

    /* -------- stars -------- */
    const starCount = isMobile ? 700 : 1500;
    const starGeo = new THREE.BufferGeometry();
    {
      const pos = new Float32Array(starCount * 3);
      const size = new Float32Array(starCount);
      const seed = new Float32Array(starCount);
      for (let i = 0; i < starCount; i++) {
        const r = 22 + Math.random() * 26;
        const v = new THREE.Vector3().setFromSphericalCoords(
          r,
          Math.acos(THREE.MathUtils.randFloatSpread(2)),
          Math.random() * Math.PI * 2,
        );
        pos.set([v.x, v.y, v.z], i * 3);
        size[i] = 0.35 + Math.random() * 0.9;
        seed[i] = Math.random();
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      starGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
      starGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    }
    const stars = new THREE.Points(
      starGeo,
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: { uTime, uPixelRatio },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(stars);

    /* -------- the living core -------- */
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    const coreMat = (opacity: number, colors: THREE.Color[]) =>
      new THREE.ShaderMaterial({
        vertexShader: CORE_VERT,
        fragmentShader: CORE_FRAG,
        uniforms: {
          uTime,
          uEnergy,
          uPulse,
          uWave,
          uOpacity: { value: opacity },
          uColorA: { value: colors[0] },
          uColorB: { value: colors[1] },
          uColorC: { value: colors[2] },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });

    const coreGeo = new THREE.IcosahedronGeometry(1.35, isMobile ? 40 : 72);
    const coreInner = new THREE.Mesh(coreGeo, coreMat(0.85, [COLORS.a, COLORS.b, COLORS.c]));
    coreGroup.add(coreInner);

    const shellGeo = new THREE.IcosahedronGeometry(1.72, isMobile ? 14 : 22);
    const shellMat = coreMat(0.5, [COLORS.p, COLORS.b, COLORS.m]);
    shellMat.wireframe = true;
    const coreShell = new THREE.Mesh(shellGeo, shellMat);
    coreGroup.add(coreShell);

    /* -------- GPU particle swarm -------- */
    const pCount = reduce ? 2500 : isMobile ? 6000 : 16000;
    const pGeo = new THREE.BufferGeometry();
    {
      const pos = new Float32Array(pCount * 3);
      const radius = new Float32Array(pCount);
      const speed = new Float32Array(pCount);
      const size = new Float32Array(pCount);
      const seed = new Float32Array(pCount);
      const axis = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        radius[i] = 1.9 + Math.pow(Math.random(), 0.6) * 5.6;
        speed[i] = 0.05 + Math.pow(Math.random(), 2.0) * 0.55;
        size[i] = 0.12 + Math.pow(Math.random(), 3.0) * 0.95;
        seed[i] = Math.random();
        const a = new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(2),
          1 + THREE.MathUtils.randFloatSpread(1.4),
          THREE.MathUtils.randFloatSpread(2),
        ).normalize();
        axis.set([a.x, a.y, a.z], i * 3);
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      pGeo.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
      pGeo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
      pGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
      pGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      pGeo.setAttribute("aAxis", new THREE.BufferAttribute(axis, 3));
      pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 24);
    }
    const particles = new THREE.Points(
      pGeo,
      new THREE.ShaderMaterial({
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
        uniforms: {
          uTime,
          uEnergy,
          uPulse,
          uWave,
          uMouse,
          uPixelRatio,
          uColorA: { value: COLORS.a },
          uColorB: { value: COLORS.b },
          uColorC: { value: COLORS.m },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(particles);

    /* -------- regenerating energy streams -------- */
    const streamGroup = new THREE.Group();
    scene.add(streamGroup);
    const STREAMS = reduce ? 8 : isMobile ? 12 : 24;
    type Stream = { mesh: THREE.Mesh; life: number; dur: number };
    const streams: Stream[] = [];

    const makeStreamMesh = (): THREE.Mesh => {
      const geo = new THREE.TubeGeometry(randomStream(), isMobile ? 40 : 64, 0.022 + Math.random() * 0.03, 6, false);
      const mat = new THREE.ShaderMaterial({
        vertexShader: STREAM_VERT,
        fragmentShader: STREAM_FRAG,
        uniforms: {
          uTime,
          uEnergy,
          uLife: { value: 0 },
          uOffset: { value: Math.random() },
          uColorA: { value: Math.random() > 0.7 ? COLORS.p : COLORS.a },
          uColorB: { value: Math.random() > 0.8 ? COLORS.m : COLORS.b },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      return new THREE.Mesh(geo, mat);
    };

    for (let i = 0; i < STREAMS; i++) {
      const mesh = makeStreamMesh();
      streamGroup.add(mesh);
      streams.push({ mesh, life: Math.random(), dur: 4 + Math.random() * 6 });
    }

    const respawn = (s: Stream) => {
      s.mesh.geometry.dispose();
      s.mesh.geometry = new THREE.TubeGeometry(
        randomStream(),
        isMobile ? 40 : 64,
        0.022 + Math.random() * 0.03,
        6,
        false,
      );
      const u = (s.mesh.material as THREE.ShaderMaterial).uniforms;
      u.uOffset.value = Math.random();
      u.uColorA.value = Math.random() > 0.7 ? COLORS.p : COLORS.a;
      u.uColorB.value = Math.random() > 0.8 ? COLORS.m : COLORS.b;
      s.life = 0;
      s.dur = 4 + Math.random() * 6;
    };

    /* -------- post processing bloom -------- */
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(dpr);
    composer.setSize(host.clientWidth, host.clientHeight);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(host.clientWidth, host.clientHeight),
      0.95,
      0.85,
      0.18,
    );
    composer.addPass(bloom);

    /* -------- interaction -------- */
    const pointer = new THREE.Vector2(0, 0);
    const target = new THREE.Vector3(999, 999, 0);
    let hasPointer = false;

    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      hasPointer = true;
      target.set(pointer.x * 5.4, pointer.y * 3.4, 0);
    };
    const onLeave = () => {
      hasPointer = false;
      target.set(999, 999, 0);
    };
    let clickWave = -1;
    const onClick = () => {
      clickWave = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onClick, { passive: true });

    const onResize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      (nebula.material as THREE.ShaderMaterial).uniforms.uRes.value.set(w, h);
    };
    window.addEventListener("resize", onResize);

    /* -------- adaptive quality + loop -------- */
    let raf = 0;
    let visible = true;
    const obs = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    obs.observe(host);
    const onVis = () => (visible = !document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const clock = new THREE.Clock();
    let energy = 0;
    let frames = 0;
    let fpsAcc = 0;
    let downgraded = false;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!visible) return;

      uTime.value += dt * (reduce ? 0.35 : 1);

      // state → energy target, smoothly interpolated
      const st = stateRef.current;
      const targetEnergy = st === "thinking" ? 1 : st === "speaking" ? 0.62 : st === "listening" ? 0.34 : 0.1;
      energy += (targetEnergy - energy) * Math.min(dt * 2.4, 1);
      uEnergy.value = energy;

      // rhythmic pulse per state
      const t = uTime.value;
      let pulse = Math.sin(t * 0.7) * 0.12;
      if (st === "thinking") pulse += Math.sin(t * 3.1) * 0.3 + Math.sin(t * 5.7) * 0.12;
      if (st === "speaking")
        pulse += (Math.sin(t * 6.4) * 0.5 + Math.sin(t * 11.3) * 0.3 + Math.sin(t * 2.3) * 0.4) * 0.28;
      if (st === "listening") pulse += Math.sin(t * 1.9) * 0.14;
      uPulse.value = pulse;

      // click wave lifecycle (1.4s)
      if (clickWave >= 0) {
        clickWave += dt / 1.4;
        uWave.value = Math.min(clickWave, 1);
        if (clickWave >= 1) {
          clickWave = -1;
          uWave.value = 0;
        }
      }

      // pointer magnetism eases in/out
      uMouse.value.lerp(target, hasPointer ? Math.min(dt * 4, 1) : Math.min(dt * 1.2, 1));

      coreGroup.rotation.y += dt * (0.09 + energy * 0.3);
      coreGroup.rotation.x = Math.sin(t * 0.18) * 0.22;
      coreShell.rotation.y -= dt * (0.16 + energy * 0.4);
      coreShell.rotation.z += dt * 0.05;
      particles.rotation.y += dt * (0.02 + energy * 0.06);
      streamGroup.rotation.y -= dt * (0.05 + energy * 0.14);
      streamGroup.rotation.x = Math.cos(t * 0.13) * 0.16;
      stars.rotation.y += dt * 0.004;

      camera.position.x += (pointer.x * 0.42 - camera.position.x) * Math.min(dt * 1.6, 1);
      camera.position.y += (pointer.y * 0.28 - camera.position.y) * Math.min(dt * 1.6, 1);
      camera.lookAt(0, 0, 0);

      bloom.strength = 0.8 + energy * 0.85 + Math.max(pulse, 0) * 0.25;

      for (const s of streams) {
        s.life += dt / s.dur * (1 + energy * 0.8);
        (s.mesh.material as THREE.ShaderMaterial).uniforms.uLife.value = s.life;
        if (s.life >= 1) respawn(s);
      }

      composer.render();

      // adaptive: drop resolution once if sustained low fps
      frames++;
      fpsAcc += dt;
      if (fpsAcc >= 1.5) {
        const fps = frames / fpsAcc;
        if (!downgraded && fps < 45) {
          downgraded = true;
          dpr = Math.max(1, dpr * 0.75);
          renderer.setPixelRatio(dpr);
          composer.setPixelRatio(dpr);
          uPixelRatio.value = dpr;
          onResize();
        }
        frames = 0;
        fpsAcc = 0;
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onClick);
      window.removeEventListener("resize", onResize);
      streams.forEach((s) => {
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
      });
      coreGeo.dispose();
      shellGeo.dispose();
      pGeo.dispose();
      starGeo.dispose();
      nebula.geometry.dispose();
      (nebula.material as THREE.Material).dispose();
      (coreInner.material as THREE.Material).dispose();
      shellMat.dispose();
      (particles.material as THREE.Material).dispose();
      (stars.material as THREE.Material).dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden />;
}
