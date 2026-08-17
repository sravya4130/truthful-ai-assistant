import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SIMPLEX_3D } from "./glsl";

export type NexusState = "idle" | "thinking" | "listening" | "speaking";

interface Props {
  state?: NexusState;
  /** 0..1 live amplitude (voice / mic) used to drive pulses */
  amplitudeRef?: { current: number };
  className?: string;
}

/* ------------------------------------------------------------------ *
 * A radial filament nexus: thousands of branching neon energy threads
 * exploding out of a molten core, with orbiting GPU particle dust.
 * ------------------------------------------------------------------ */

const FILAMENT_VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uAmp;
uniform float uWave;
attribute float aT;        // 0..1 along branch
attribute float aSeed;     // per-branch seed
attribute float aBranch;   // branch index normalised
attribute vec3 aTint;
varying float vT;
varying float vSeed;
varying vec3 vTint;
varying float vFade;
${SIMPLEX_3D}

void main(){
  vec3 p = position;
  float t = uTime;

  // organic writhing that grows with distance from the core
  vec3 fl = flowField(p * 0.5 + aSeed * 7.0, t * 0.7);
  p += fl * (0.10 + aT * 0.55) * (0.6 + uEnergy * 1.5);

  // breathing expansion / contraction of the whole web
  float breathe = 1.0
    + sin(t * 0.5 + aSeed * 6.283) * 0.045
    + uAmp * 0.10 * (0.3 + aT)
    + uEnergy * 0.08 * aT;
  p *= breathe;

  // shock ring travelling outward
  if(uWave > 0.0){
    float ring = uWave * 9.0;
    p *= 1.0 + 0.10 * exp(-5.0 * abs(length(p) - ring)) * (1.0 - uWave);
  }

  // branch lifecycle: staggered fade in / out so the web never repeats
  float life = fract(t * (0.05 + fract(aSeed * 3.7) * 0.07) + aSeed);
  vFade = smoothstep(0.0, 0.14, life) * (1.0 - smoothstep(0.62, 1.0, life));

  vT = aT;
  vSeed = aSeed;
  vTint = aTint;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FILAMENT_FRAG = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uAmp;
varying float vT;
varying float vSeed;
varying vec3 vTint;
varying float vFade;

void main(){
  // energy pulse racing outward along every filament
  float head = fract(uTime * (0.22 + uEnergy * 0.55) + vSeed * 4.13);
  float d = abs(vT - head);
  d = min(d, 1.0 - d);
  float pulse = exp(-26.0 * d) + exp(-110.0 * d) * 1.4;

  float taper = (1.0 - vT * 0.72);
  float base = taper * (0.20 + uEnergy * 0.30 + uAmp * 0.25);

  vec3 col = vTint * (base + pulse * 0.9);
  col += vec3(0.55, 0.78, 1.0) * pulse * (0.45 + uEnergy * 0.7);

  float a = vFade * (base * 0.9 + pulse * 0.85);
  if(a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

const DUST_VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uAmp;
uniform float uWave;
uniform float uPixelRatio;
uniform vec3 uMouse;
attribute float aRadius;
attribute float aSpeed;
attribute float aSize;
attribute float aSeed;
attribute vec3 aAxis;
attribute vec3 aTint;
varying float vA;
varying vec3 vTint;
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
  // some dust escapes outward, some is pulled back into the core
  float breath = sin(t * (0.15 + aSpeed * 0.4) + aSeed * 21.0);
  float escape = smoothstep(0.7, 1.0, breath) * (2.2 + uEnergy * 2.6);
  float r = aRadius * (1.0 + breath * 0.2) + escape + uAmp * 0.7;

  if(uWave > 0.0){
    float ring = uWave * 9.0;
    r += 0.8 * exp(-3.5 * abs(r - ring)) * (1.0 - uWave);
  }

  vec3 base = vec3(r, 0.0, 0.0);
  base = rotAxis(normalize(aAxis), t * aSpeed * (0.5 + uEnergy * 1.6) + aSeed * 6.28318) * base;
  base += flowField(base * 0.35 + aSeed * 5.0, t) * (0.7 + uEnergy * 1.8);

  vec3 toM = uMouse - base;
  float dm = length(toM);
  base += normalize(toM + 0.0001) * (1.8 / (1.0 + dm * dm * 1.5));

  vec4 mv = modelViewMatrix * vec4(base, 1.0);
  float life = fract(t * (0.05 + aSpeed * 0.05) + aSeed * 1.7);
  vA = sin(life * 3.14159265) * (0.2 + aSize * 0.8) * (0.5 + uEnergy * 0.8 + uAmp * 0.4);
  vTint = aTint;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (aSize * 15.0 + uEnergy * 7.0) * uPixelRatio * (7.0 / -mv.z);
}
`;

const DUST_FRAG = /* glsl */ `
varying float vA;
varying vec3 vTint;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if(d > 0.5) discard;
  float g = pow(1.0 - d * 2.0, 2.6);
  vec3 col = vTint + vec3(0.5, 0.72, 1.0) * pow(g, 4.0) * 0.8;
  gl_FragColor = vec4(col, g * vA);
}
`;

const CORE_VERT = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uAmp;
varying float vD;
varying vec3 vN;
${SIMPLEX_3D}
void main(){
  vec3 p = normalize(position);
  float t = uTime * (0.3 + uEnergy * 0.5);
  float n = fbm(p * 1.9 + vec3(0.0, t, t * 0.6));
  float d = n * (0.26 + uEnergy * 0.2) + sin(uTime * 0.6) * 0.05 + uAmp * 0.16;
  vD = d;
  vN = normalize(normalMatrix * p);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p * (1.0 + d), 1.0);
}
`;

const CORE_FRAG = /* glsl */ `
uniform float uEnergy;
uniform float uAmp;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vD;
varying vec3 vN;
void main(){
  float fres = pow(1.0 - abs(dot(vN, vec3(0.0, 0.0, 1.0))), 2.0);
  vec3 col = mix(uColorA, uColorB, smoothstep(-0.2, 0.5, vD));
  col += vec3(0.7, 0.86, 1.0) * pow(fres, 2.4) * (0.8 + uEnergy + uAmp);
  float a = (0.16 + fres * 0.8) * (0.7 + uEnergy * 0.5 + uAmp * 0.5);
  gl_FragColor = vec4(col, a);
}
`;

const HAZE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`;

const HAZE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;
uniform float uEnergy;
varying vec2 vUv;
${SIMPLEX_3D}
void main(){
  vec2 p = (vUv - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
  float t = uTime * 0.03;
  float f = fbm(vec3(p * 1.7, t));
  float g = fbm(vec3(p * 3.1 + f * 0.5, t * 1.3 + 5.0));
  float fog = smoothstep(-0.45, 1.0, f * 0.75 + g * 0.45);
  float vig = 1.0 - smoothstep(0.1, 1.1, length(p));
  vec3 deep = vec3(0.02, 0.07, 0.24);
  vec3 blue = vec3(0.05, 0.22, 0.6);
  vec3 col = mix(deep, blue, smoothstep(0.15, 0.9, g));
  col *= fog * (0.34 + uEnergy * 0.22) * (0.3 + vig);
  col += vec3(0.05, 0.14, 0.42) * pow(vig, 2.6) * (0.6 + uEnergy * 0.8);
  gl_FragColor = vec4(col, 1.0);
}
`;

const TINTS = [
  new THREE.Color("#2b7bff"),
  new THREE.Color("#31e7ff"),
  new THREE.Color("#8ecbff"),
  new THREE.Color("#a855f7"),
  new THREE.Color("#f45ce0"),
  new THREE.Color("#ffffff"),
];

const pickTint = () => {
  const r = Math.random();
  if (r < 0.42) return TINTS[1];
  if (r < 0.7) return TINTS[0];
  if (r < 0.82) return TINTS[2];
  if (r < 0.9) return TINTS[3];
  if (r < 0.96) return TINTS[4];
  return TINTS[5];
};

export default function VraiNexus({ state = "idle", amplitudeRef, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<NexusState>(state);
  stateRef.current = state;
  const ampRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    renderer.setClearColor(0x02050e, 1);
    let dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.4 : 1.7);
    renderer.setPixelRatio(dpr);
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, host.clientWidth / Math.max(host.clientHeight, 1), 0.1, 120);
    camera.position.set(0, 0, isMobile ? 10.5 : 8.6);

    const uTime = { value: 0 };
    const uEnergy = { value: 0 };
    const uAmp = { value: 0 };
    const uWave = { value: 0 };
    const uPixelRatio = { value: dpr };
    const uMouse = { value: new THREE.Vector3(999, 999, 0) };

    /* ---------------- volumetric haze backdrop ---------------- */
    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: HAZE_VERT,
        fragmentShader: HAZE_FRAG,
        uniforms: { uTime, uEnergy, uRes: { value: new THREE.Vector2(host.clientWidth, host.clientHeight) } },
        depthWrite: false,
        depthTest: false,
      }),
    );
    haze.frustumCulled = false;
    haze.renderOrder = -1;
    scene.add(haze);

    /* ---------------- filament web ---------------- */
    const nexus = new THREE.Group();
    scene.add(nexus);

    const BRANCHES = reduce ? 120 : isMobile ? 260 : 620;
    const SEGS = isMobile ? 12 : 18;

    const positions: number[] = [];
    const tParam: number[] = [];
    const seeds: number[] = [];
    const branchIdx: number[] = [];
    const tints: number[] = [];

    const tmp = new THREE.Vector3();
    const buildBranch = (origin: THREE.Vector3, dir: THREE.Vector3, len: number, seed: number, bi: number, tint: THREE.Color, depth: number) => {
      let cur = origin.clone();
      let d = dir.clone().normalize();
      const pts: THREE.Vector3[] = [cur.clone()];
      for (let i = 1; i <= SEGS; i++) {
        // curve the direction with random walk so nothing is a straight line
        tmp.set(
          THREE.MathUtils.randFloatSpread(0.75),
          THREE.MathUtils.randFloatSpread(0.75),
          THREE.MathUtils.randFloatSpread(0.75),
        );
        d.add(tmp.multiplyScalar(0.42)).normalize();
        cur = cur.clone().add(d.clone().multiplyScalar(len / SEGS));
        pts.push(cur.clone());
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const t0 = i / (pts.length - 1);
        const t1 = (i + 1) / (pts.length - 1);
        tParam.push(t0, t1);
        seeds.push(seed, seed);
        branchIdx.push(bi, bi);
        tints.push(tint.r, tint.g, tint.b, tint.r, tint.g, tint.b);
      }
      // sub branches split off midway, like a discharge forking
      if (depth < 2 && Math.random() < 0.7) {
        const forkAt = pts[Math.floor(pts.length * (0.35 + Math.random() * 0.4))];
        const nd = d
          .clone()
          .add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2)))
          .normalize();
        buildBranch(forkAt, nd, len * (0.45 + Math.random() * 0.35), seed, bi, Math.random() < 0.3 ? pickTint() : tint, depth + 1);
      }
    };

    for (let b = 0; b < BRANCHES; b++) {
      const dir = new THREE.Vector3().setFromSphericalCoords(
        1,
        Math.acos(THREE.MathUtils.randFloatSpread(2)),
        Math.random() * Math.PI * 2,
      );
      const origin = dir.clone().multiplyScalar(0.9 + Math.random() * 0.7);
      buildBranch(origin, dir, 2.0 + Math.pow(Math.random(), 0.6) * 4.4, Math.random(), b / BRANCHES, pickTint(), 0);
    }

    const filGeo = new THREE.BufferGeometry();
    filGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    filGeo.setAttribute("aT", new THREE.Float32BufferAttribute(tParam, 1));
    filGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
    filGeo.setAttribute("aBranch", new THREE.Float32BufferAttribute(branchIdx, 1));
    filGeo.setAttribute("aTint", new THREE.Float32BufferAttribute(tints, 3));
    filGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);

    const filMat = new THREE.ShaderMaterial({
      vertexShader: FILAMENT_VERT,
      fragmentShader: FILAMENT_FRAG,
      uniforms: { uTime, uEnergy, uAmp, uWave },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const filaments = new THREE.LineSegments(filGeo, filMat);
    nexus.add(filaments);

    /* ---------------- molten core ---------------- */
    const coreGeo = new THREE.IcosahedronGeometry(1.05, isMobile ? 32 : 56);
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: { uTime, uEnergy, uAmp, uColorA: { value: TINTS[0] }, uColorB: { value: TINTS[1] } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    nexus.add(core);

    /* ---------------- orbiting dust ---------------- */
    const pCount = reduce ? 2000 : isMobile ? 6000 : 15000;
    const dustGeo = new THREE.BufferGeometry();
    {
      const pos = new Float32Array(pCount * 3);
      const radius = new Float32Array(pCount);
      const speed = new Float32Array(pCount);
      const size = new Float32Array(pCount);
      const seed = new Float32Array(pCount);
      const axis = new Float32Array(pCount * 3);
      const tint = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        radius[i] = 1.4 + Math.pow(Math.random(), 0.55) * 6.2;
        speed[i] = 0.05 + Math.pow(Math.random(), 2) * 0.5;
        size[i] = 0.1 + Math.pow(Math.random(), 3) * 0.9;
        seed[i] = Math.random();
        const a = new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(2),
          THREE.MathUtils.randFloatSpread(2),
          THREE.MathUtils.randFloatSpread(2),
        ).normalize();
        axis.set([a.x, a.y, a.z], i * 3);
        const c = pickTint();
        tint.set([c.r, c.g, c.b], i * 3);
      }
      dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      dustGeo.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
      dustGeo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
      dustGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
      dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      dustGeo.setAttribute("aAxis", new THREE.BufferAttribute(axis, 3));
      dustGeo.setAttribute("aTint", new THREE.BufferAttribute(tint, 3));
      dustGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 30);
    }
    const dust = new THREE.Points(
      dustGeo,
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        uniforms: { uTime, uEnergy, uAmp, uWave, uPixelRatio, uMouse },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(dust);

    /* ---------------- bloom ---------------- */
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(dpr);
    composer.setSize(host.clientWidth, host.clientHeight);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(host.clientWidth, host.clientHeight), 1.0, 0.8, 0.15);
    composer.addPass(bloom);

    /* ---------------- interaction ---------------- */
    const pointer = new THREE.Vector2(0, 0);
    const target = new THREE.Vector3(999, 999, 0);
    let hasPointer = false;
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      hasPointer = true;
      target.set(pointer.x * 5.2, pointer.y * 3.2, 0);
    };
    const onLeave = () => {
      hasPointer = false;
      target.set(999, 999, 0);
    };
    let wave = -1;
    const onDown = () => (wave = 0);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown, { passive: true });

    const onResize = () => {
      const w = host.clientWidth;
      const h = Math.max(host.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      (haze.material as THREE.ShaderMaterial).uniforms.uRes.value.set(w, h);
    };
    window.addEventListener("resize", onResize);

    let visible = true;
    const obs = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    obs.observe(host);
    const onVis = () => (visible = !document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const clock = new THREE.Clock();
    let energy = 0;
    let amp = 0;
    let nextBurst = 5 + Math.random() * 7;
    let elapsed = 0;
    let frames = 0;
    let fpsAcc = 0;
    let downgraded = false;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!visible) return;
      elapsed += dt;
      uTime.value += dt * (reduce ? 0.4 : 1);
      const t = uTime.value;

      const st = stateRef.current;
      const targetEnergy = st === "thinking" ? 1 : st === "speaking" ? 0.6 : st === "listening" ? 0.32 : 0.12;
      energy += (targetEnergy - energy) * Math.min(dt * 2.2, 1);
      uEnergy.value = energy;

      // amplitude: external (voice/mic) with organic idle shimmer
      const extAmp = amplitudeRef?.current ?? ampRef.current;
      let targetAmp = extAmp * (st === "speaking" ? 1 : st === "listening" ? 0.7 : 0.4);
      targetAmp += Math.abs(Math.sin(t * 0.6)) * 0.05 + (st === "thinking" ? 0.18 + Math.abs(Math.sin(t * 3.2)) * 0.22 : 0);
      amp += (targetAmp - amp) * Math.min(dt * (st === "speaking" ? 9 : 4), 1);
      uAmp.value = amp;

      // procedural energy bursts, more frequent while thinking
      nextBurst -= dt * (1 + energy * 2.2);
      if (nextBurst <= 0 && wave < 0) {
        wave = 0;
        nextBurst = (st === "thinking" ? 2.4 : 6) + Math.random() * 6;
      }
      if (wave >= 0) {
        wave += dt / 1.6;
        uWave.value = Math.min(wave, 1);
        if (wave >= 1) {
          wave = -1;
          uWave.value = 0;
        }
      }

      uMouse.value.lerp(target, hasPointer ? Math.min(dt * 4, 1) : Math.min(dt * 1.2, 1));

      nexus.rotation.y += dt * (0.05 + energy * 0.22);
      nexus.rotation.x = Math.sin(t * 0.14) * 0.24;
      nexus.rotation.z = Math.cos(t * 0.09) * 0.18;
      filaments.rotation.y += dt * 0.02;
      dust.rotation.y -= dt * (0.02 + energy * 0.05);
      core.rotation.y += dt * (0.2 + energy * 0.5);

      camera.position.x += (pointer.x * 0.5 - camera.position.x) * Math.min(dt * 1.5, 1);
      camera.position.y += (pointer.y * 0.32 - camera.position.y) * Math.min(dt * 1.5, 1);
      camera.lookAt(0, 0, 0);

      bloom.strength = 0.85 + energy * 0.8 + amp * 0.5;

      composer.render();

      frames++;
      fpsAcc += dt;
      if (fpsAcc >= 1.5) {
        const fps = frames / fpsAcc;
        if (!downgraded && fps < 42) {
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
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
      filGeo.dispose();
      filMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      dustGeo.dispose();
      (dust.material as THREE.Material).dispose();
      haze.geometry.dispose();
      (haze.material as THREE.Material).dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [amplitudeRef]);

  return <div ref={hostRef} className={className} aria-hidden />;
}
