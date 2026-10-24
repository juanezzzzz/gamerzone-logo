// <gamerzone-logo>: logo 3D de GamerZone que se arma con el scroll.
//
// Uso:
//   <script type="module" src="gz-logo.js"></script>
//   <gamerzone-logo></gamerzone-logo>
//
// Atributos (todos opcionales):
//   src            modelo .glb                (por defecto: gamerzone-logo.glb junto a este archivo)
//   poster         imagen de respaldo         (por defecto: gamerzone-poster.webp junto a este archivo)
//   scroll-length  largo del recorrido        (por defecto: 250vh)
//   quality        auto | high | low          (por defecto: auto)
//   no-sound       oculta el botón de sonido
// Subtítulos propios: elementos hijos con data-from, data-to (0..1) y data-kicker:
//   <gamerzone-logo><p data-from="0" data-to="0.3" data-kicker="Bienvenido">Entra a la zona</p></gamerzone-logo>
//
// Parámetros de previsualización en la URL: ?p=0.5  ?demo=1  ?gesture=flex  ?mx=0.8&my=0  ?quality=low

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js/+esm';
// Meshopt (y no Draco): su decodificador no usa workers, así que funciona bien desde el CDN minificado
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js/+esm';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/EffectComposer.js/+esm';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/RenderPass.js/+esm';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/UnrealBloomPass.js/+esm';
import { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/postprocessing/OutputPass.js/+esm';
import { GZAudio } from './gz-audio.js';

const HERE = new URL('.', import.meta.url);
const FONTS = 'https://fonts.googleapis.com/css2?family=Oxanium:wght@500;700;800&display=swap';

const DEFAULT_CAPTIONS = [
  { from: 0, to: 0.24, kicker: 'Bienvenido', title: 'Entra a la zona' },
  { from: 0.3, to: 0.66, kicker: 'Compite · Juega · Gana', title: 'Arma tu equipo' },
  { from: 0.74, to: 1.01, kicker: 'E-Sports Center', title: 'GamerZone' },
];

const CSS = `
  :host { display: block; position: relative; height: var(--gz-scroll, 250vh);
    --cyan: #3ff2f2; --text: #e8f4f8; --muted: #8a9bb0; --bg: #070a12; }
  * { box-sizing: border-box; }
  .sticky { position: sticky; top: 0; height: 100vh; overflow: hidden;
    background: radial-gradient(ellipse 60% 55% at 50% 45%, #12324a 0%, #0a1726 45%, #05070d 100%); }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; transition: opacity .6s; }
  .is-ready canvas { opacity: 1; }
  .no-webgl canvas, .no-webgl .sound { display: none; }

  /* imagen de respaldo: mismo tamaño y posición que el logo 3D armado */
  /* la imagen cubre 4.47 unidades; la cámara encuadra 6.6 de alto o 5.2 de ancho; el logo está 0.55 arriba */
  .poster { position: absolute; left: 50%; top: calc(50% - min(8.3vh, 10.6vw));
    width: min(70vh, 89vw); transform: translate(-50%, -50%); pointer-events: none;
    transition: opacity .6s; user-select: none; }
  .is-ready .poster { opacity: 0; }

  .caption { position: absolute; left: 50%; bottom: 6vh; transform: translate(-50%, 20px);
    width: min(90vw, 720px); text-align: center; pointer-events: none; color: var(--text);
    opacity: 0; transition: opacity .5s ease, transform .5s ease; }
  .caption.is-active { opacity: 1; transform: translate(-50%, 0); }
  .kicker { font: 700 .8rem/1 Oxanium, sans-serif; letter-spacing: .35em; color: var(--cyan);
    text-transform: uppercase; margin-bottom: .8rem; }
  .title { font: 800 clamp(1.8rem, 5vw, 3.4rem)/1.05 Oxanium, sans-serif; text-transform: uppercase;
    text-shadow: 0 0 30px rgba(63, 242, 242, .25); }

  .hint { position: absolute; left: 50%; top: 5vh; transform: translateX(-50%);
    font: 500 .75rem/1 Oxanium, sans-serif; letter-spacing: .3em; color: var(--muted);
    text-transform: uppercase; transition: opacity .4s; }
  .hint::after { content: ""; display: block; width: 1px; height: 36px; margin: .8rem auto 0;
    background: linear-gradient(var(--cyan), transparent); animation: hint 1.6s ease-in-out infinite; }
  @keyframes hint { 0%,100% { transform: scaleY(.4); transform-origin: top; } 50% { transform: scaleY(1); } }

  .progress { position: absolute; right: 24px; top: 50%; transform: translateY(-50%);
    width: 2px; height: 30vh; background: rgba(255,255,255,.08); border-radius: 2px; }
  .bar { width: 100%; height: 100%; background: var(--cyan); transform-origin: top;
    transform: scaleY(0); box-shadow: 0 0 12px var(--cyan); }

  .loader { position: absolute; left: 50%; bottom: 22vh; transform: translateX(-50%);
    font: 700 .7rem/1 Oxanium, sans-serif; letter-spacing: .3em; color: var(--cyan); transition: opacity .6s; }
  .is-ready .loader, .no-webgl .loader { opacity: 0; }

  .sound { position: absolute; top: 20px; right: 20px; display: flex; align-items: center; gap: 8px;
    padding: 8px 14px 8px 10px; border-radius: 999px; cursor: pointer;
    border: 1px solid rgba(63, 242, 242, .3); background: rgba(7, 10, 18, .55); color: var(--muted);
    font: 700 .7rem/1 Oxanium, sans-serif; letter-spacing: .2em; text-transform: uppercase;
    backdrop-filter: blur(6px); transition: color .25s, border-color .25s, box-shadow .25s; }
  .sound svg { width: 18px; height: 18px; fill: currentColor; }
  .sound .on { display: none; }
  .sound[aria-pressed="true"] { color: var(--cyan); border-color: var(--cyan); box-shadow: 0 0 14px rgba(63, 242, 242, .35); }
  .sound[aria-pressed="true"] .on { display: block; }
  .sound[aria-pressed="true"] .off { display: none; }
  .sound:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }

  .poster-mode .caption, .poster-mode .hint, .poster-mode .progress, .poster-mode .sound, .poster-mode .loader { display: none; }

  @media (max-width: 640px) {
    .progress { right: 12px; }
    .sound { top: 12px; right: 12px; }
    .sound span { display: none; }
  }
`;

const HTML = (poster, captions) => `
  <div class="sticky">
    <img class="poster" src="${poster}" alt="GamerZone E-Sports Center" decoding="async">
    <canvas></canvas>
    <div class="loader">CARGANDO…</div>
    <div class="hint">Desliza</div>
    ${captions.map((c) => `
      <div class="caption" data-from="${c.from}" data-to="${c.to}">
        ${c.kicker ? `<div class="kicker">${c.kicker}</div>` : ''}
        <div class="title">${c.title}</div>
      </div>`).join('')}
    <div class="progress"><div class="bar"></div></div>
    <button class="sound" type="button" aria-pressed="false" aria-label="Activar sonido">
      <svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <svg class="off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span>Sonido</span>
    </button>
  </div>`;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class GamerzoneLogo extends HTMLElement {
  connectedCallback() {
    if (this._dispose) return;
    if (!document.querySelector(`link[href="${FONTS}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = FONTS;
      document.head.appendChild(l);
    }
    const custom = [...this.querySelectorAll('[data-from]')].map((el) => ({
      from: +el.dataset.from, to: +el.dataset.to,
      kicker: escapeHtml(el.dataset.kicker || ''), title: escapeHtml(el.textContent.trim()),
    }));
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    const poster = this.getAttribute('poster') || new URL('gamerzone-poster.webp', HERE).href;
    root.innerHTML = `<style>${CSS}</style>${HTML(poster, custom.length ? custom : DEFAULT_CAPTIONS)}`;
    if (this.hasAttribute('scroll-length')) this.style.setProperty('--gz-scroll', this.getAttribute('scroll-length'));
    this._dispose = mount(this, root, {
      src: this.getAttribute('src') || new URL('gamerzone-logo.glb', HERE).href,
      quality: this.getAttribute('quality') || 'auto',
      sound: !this.hasAttribute('no-sound'),
    });
  }

  disconnectedCallback() {
    if (this._dispose) this._dispose();
    this._dispose = null;
  }
}

function mount(host, root, opts) {
  const $ = (s) => root.querySelector(s);
  const wrap = $('.sticky');
  const canvas = $('canvas');
  const bar = $('.bar');
  const hint = $('.hint');
  const loaderEl = $('.loader');
  const captions = [...root.querySelectorAll('.caption')];
  const soundBtn = $('.sound');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const { clamp, smoothstep, lerp } = THREE.MathUtils;
  const ease = (x) => x * x * (3 - 2 * x);
  const listeners = [];
  const on = (target, ev, fn, o) => { target.addEventListener(ev, fn, o); listeners.push([target, ev, fn, o]); };
  if (params.has('poster')) wrap.classList.add('poster-mode');
  if (!opts.sound) soundBtn.remove();

  // ---------- scroll -> progreso (funciona aunque no haya WebGL) ----------
  let target = 0, current = 0;
  const forced = params.get('p'); // ?p=0.5 para previsualizar
  function readScroll() {
    const r = host.getBoundingClientRect();
    const total = Math.max(1, host.offsetHeight - innerHeight);
    target = reduceMotion ? 1 : clamp(-r.top / total, 0, 1);
    if (forced !== null) target = current = +forced;
  }
  function updateUI(p) {
    bar.style.transform = `scaleY(${p})`;
    hint.style.opacity = p > 0.03 ? 0 : 1;
    for (const c of captions) c.classList.toggle('is-active', p >= +c.dataset.from && p < +c.dataset.to);
  }
  on(window, 'scroll', readScroll, { passive: true });
  readScroll();

  // ---------- respaldo: sin WebGL queda la imagen fija ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch {
    wrap.classList.add('no-webgl');
    on(window, 'scroll', () => updateUI(target), { passive: true });
    updateUI(target);
    return () => listeners.forEach(([t, e, f, o]) => t.removeEventListener(e, f, o));
  }

  // ---------- sonido (apagado por defecto; se recuerda la preferencia) ----------
  const audio = new GZAudio();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };
  async function setSound(v) {
    if (v) await audio.enable(); else audio.disable();
    soundBtn.setAttribute('aria-pressed', v);
    soundBtn.setAttribute('aria-label', v ? 'Silenciar' : 'Activar sonido');
    store.set('gz-sound', v ? '1' : '0');
  }
  if (opts.sound) {
    on(soundBtn, 'click', () => setSound(!audio.enabled));
    // si lo dejó activado antes, se reactiva con su primera interacción (regla de los navegadores)
    if (store.get('gz-sound') === '1') {
      on(window, 'pointerdown', (e) => { if (!e.composedPath().includes(soundBtn)) setSound(true); }, { once: true });
    }
  }

  // ---------- renderer / escena ----------
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // igual que "Standard" en Blender
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = (() => {
    // fondo con halo azul (va dentro de la escena para que el bloom no rompa la transparencia)
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(256, 240, 10, 256, 256, 360);
    grd.addColorStop(0, '#12324a');
    grd.addColorStop(0.45, '#0a1726');
    grd.addColorStop(1, '#05070d');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

  // luces (Blender Z-up -> three Y-up)
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  const key = new THREE.DirectionalLight(0xfff6ec, 1.9);
  key.position.set(-4, 5, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcce6ff, 0.7); fill.position.set(5, -1, 6); scene.add(fill);
  const rimCyan = new THREE.PointLight(0x33e6ff, 45, 20); rimCyan.position.set(4, 3, -3); scene.add(rimCyan);
  const rimBlue = new THREE.PointLight(0x3366ff, 32, 20); rimBlue.position.set(-4, -2, -3); scene.add(rimBlue);
  const sweep = new THREE.PointLight(0xcff8ff, 0, 6, 2); scene.add(sweep); // reflejo que barre el logo

  const LOGO_Y = 0.55; // sube el logo para que no lo tapen los subtítulos
  const tilt = new THREE.Group(); // inclinación con el mouse
  scene.add(tilt);

  // ---------- partículas ----------
  const dust = (() => {
    const N = 380, pos = new Float32Array(N * 3), speed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = -7 + Math.random() * 8;
      speed[i] = 0.05 + Math.random() * 0.18;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(120,240,255,0.5)');
    grd.addColorStop(1, 'rgba(120,240,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const mat = new THREE.PointsMaterial({
      size: 0.07, map: new THREE.CanvasTexture(c), color: 0x7ff4ff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return { pts, pos, speed, N };
  })();

  // ---------- luz blanca cinematográfica que recorre texto y bordes ----------
  const shine = { uShine: { value: -10 }, uShineAmt: { value: 0 } };
  function addShine(m, k) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, shine, { uShineK: { value: k } });
      sh.vertexShader = 'varying vec3 vGzW;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n vGzW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uShine; uniform float uShineAmt; uniform float uShineK; varying vec3 vGzW;\n' +
        sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float gzB = 1.0 - smoothstep(0.0, 0.32, abs(vGzW.x + (vGzW.y - 0.55) * 0.6 - uShine));
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0) * gzB * uShineAmt * uShineK;`);
    };
    m.needsUpdate = true;
  }
  const SHINE = { GZ_Front_Text: 1.2, GZ_Side_Text: 0.6, GZ_Shield_Rim: 0.6, GZ_Tri_Rim: 0.5,
    GZ_Front_Char_Hood: 0.2, GZ_Front_Char_Body: 0.2, GZ_Front_Char_Arm: 0.2 };

  // ---------- post-procesado: bloom en los neones ----------
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.35, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- calidad: alta (sombras, bloom, MSAA) o liviana para equipos modestos ----------
  let quality = null;
  function setQuality(level) {
    if (level === quality) return;
    quality = level;
    const high = level === 'high';
    renderer.shadowMap.enabled = high;
    bloom.enabled = high;
    rt.samples = high ? 4 : 0;
    rt.dispose();
    dust.pts.geometry.setDrawRange(0, high ? dust.N : 150);
    renderer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.75 : 1));
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    resize();
  }
  const forcedQuality = params.get('quality') || (opts.quality !== 'auto' ? opts.quality : null);
  const weakDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const perf = { frames: 0, time: 0, decided: !!forcedQuality };

  // ---------- modelo ----------
  let mixer = null, duration = 1, shieldRim = null;
  let logoRoot = null, layers = [];
  const hoverMeshes = [];
  // vista explotada: separación de cada capa hacia la cámara y tramo del scroll en que encaja
  const LAYOUT = [
    { name: 'GZ_Triangle', z: -1.4, from: 0.02, to: 0.40, s: 0.6 },
    { name: 'GZ_Shield', z: -0.5, from: 0.10, to: 0.48, s: 0.8 },
    { name: 'GZ_Character', z: 0.55, from: 0.18, to: 0.56, s: 1.0 },
    { name: 'GZ_Banner', z: 1.45, from: 0.26, to: 0.64, s: 0.55 },
    { name: 'GZ_Text', z: 2.15, from: 0.34, to: 0.72, s: 0.7 },
  ];
  const easeOutCubic = (x) => 1 - (1 - x) ** 3;
  const _center = new THREE.Vector3(), _rotated = new THREE.Vector3();

  function arrangeLayers(p, t) {
    // en pantallas verticales la pila se abre menos para no salirse del cuadro
    const spread = clamp(camera.aspect / 1.5, 0.5, 1);
    _center.set(0, 0, 0);
    for (const [i, L] of layers.entries()) {
      const { c } = L;
      const x = clamp((p - c.from) / (c.to - c.from), 0, 1);
      const open = (1 - easeOutCubic(x)) * spread;
      L.o.position.copy(L.rest);
      L.o.position.z += c.z * 0.55 * open; // separación moderada: el inicio ya se parece al final
      L.o.position.x -= (i - 2) * 0.12 * open; // abanico: cada capa se asoma detrás de la anterior
      L.o.position.y -= (i - 2) * 0.05 * open;
      // cada capa flota con su propio ritmo mientras está separada
      L.o.position.y += Math.sin(t * 1.1 + i * 1.3) * 0.05 * open;
      // "pop" de escala justo al encajar
      L.o.scale.setScalar(1 + Math.sin(Math.PI * clamp((x - 0.55) / 0.45, 0, 1)) * 0.035);
      _center.add(L.o.position);
    }
    if (logoRoot && layers.length) {
      // la pila se ve en diagonal y gira hacia el frente mientras se arma
      const k = (1 - ease(smoothstep(p, 0.0, 0.75))) * (0.6 + 0.4 * spread);
      logoRoot.rotation.set(0.1 * k + Math.sin(t * 0.6) * 0.025 * k, -0.34 * k + Math.sin(t * 0.4) * 0.05 * k, 0);
      // girar alrededor del centro de la pila, no del origen, para que quede centrada
      _center.divideScalar(layers.length);
      _rotated.copy(_center).applyEuler(logoRoot.rotation);
      logoRoot.position.copy(_center).sub(_rotated);
    }
  }
  const char = { bones: {}, eyes: [], eyeMat: null };
  const BONE_NAMES = ['B_Hips', 'B_Spine', 'B_Chest', 'B_Neck', 'B_Head', 'B_ShoulderL', 'B_UpperArmL',
    'B_ForearmL', 'B_ShoulderR', 'B_UpperArmR', 'B_ForearmR', 'B_HandR'];
  // ejes del logo: en el plano (Blender +Y = three -Z), giro vertical y cabeceo
  const AX = { plane: new THREE.Vector3(0, 0, -1), turn: new THREE.Vector3(0, 1, 0), nod: new THREE.Vector3(1, 0, 0) };

  // el modelo viene comprimido con Meshopt (1.8 MB en vez de 4.8 MB; ~1 MB con la compresión del servidor)
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(opts.src, (gltf) => {
    tilt.add(gltf.scene);
    mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.play();
      duration = Math.max(duration, clip.duration);
    }
    // los ejes de los huesos se toman con el logo ya armado (final de la animación)
    mixer.setTime(duration * 0.9999);
    gltf.scene.updateMatrixWorld(true);
    const sceneQInv = gltf.scene.getWorldQuaternion(new THREE.Quaternion()).invert();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    gltf.scene.traverse((o) => {
      if (o.isBone && BONE_NAMES.includes(o.name)) {
        // ejes del logo expresados en el espacio del padre del hueso (pose de reposo)
        const qp = sceneQInv.clone().multiply(o.parent.getWorldQuaternion(new THREE.Quaternion())).invert();
        const axes = {};
        for (const k in AX) axes[k] = AX[k].clone().applyQuaternion(qp).normalize();
        char.bones[o.name] = { bone: o, rest: o.quaternion.clone(), restScale: o.scale.clone(), axes };
      }
      if (o.name.startsWith('GZ_Char_Eye')) char.eyes.push({ obj: o, sy: o.scale.y });
      if (!o.isMesh) return;
      const m = o.material;
      o.castShadow = !m.name.startsWith('GZ_Char_Eyes');
      o.receiveShadow = true;
      for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].anisotropy = maxAniso;
      // el dibujo proyectado brilla menos para que el bloom quede sólo en neones y ojos
      if (m.name.startsWith('GZ_Front') && !m.userData.dimmed) { m.emissiveIntensity *= 0.6; m.userData.dimmed = true; }
      if (m.name === 'GZ_Shield_Rim') shieldRim = m;
      if (m.name === 'GZ_Char_Eyes') char.eyeMat = m;
      if (m.name === 'GZ_Side_Banner') m.envMapIntensity = 0.15; // negro, sin reflejo gris
      if (SHINE[m.name] && !m.userData.shine) { addShine(m, SHINE[m.name]); m.userData.shine = true; }
    });
    if (char.eyeMat) char.eyeMat.userData.base = char.eyeMat.emissiveIntensity;
    if (shieldRim) shieldRim.userData.base = shieldRim.emissiveIntensity;
    // el armado lo controla la página: se guardan las capas en su posición final
    logoRoot = gltf.scene.getObjectByName('GZ_Logo_Root');
    layers = LAYOUT.map((c) => {
      const o = gltf.scene.getObjectByName(c.name);
      if (!o) return null;
      const box = new THREE.Box3().setFromObject(o);
      const center = o.worldToLocal(box.getCenter(new THREE.Vector3()));
      return { o, rest: o.position.clone(), c, center };
    }).filter(Boolean);
    // mallas fijas (no deformadas) para detectar el mouse encima del logo
    for (const n of ['GZ_Triangle', 'GZ_Shield', 'GZ_Banner', 'GZ_Text']) {
      gltf.scene.getObjectByName(n)?.traverse((o) => { if (o.isMesh) hoverMeshes.push(o); });
    }
    wrap.classList.add('is-ready');
  }, undefined, () => {
    // si el modelo no carga, queda la imagen de respaldo
    loaderEl.style.opacity = 0;
  });

  // ---------- tamaño: que el logo siempre quepa ----------
  let baseDist = 12;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    // en pantallas angostas alejamos la cámara para que entre el ancho del logo
    const fitWidth = 5.2, fitHeight = 6.6; // alto extra: deja lugar a los subtítulos abajo
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const distH = (fitHeight / 2) / Math.tan(vfov / 2);
    const distW = (fitWidth / 2) / (Math.tan(vfov / 2) * camera.aspect);
    baseDist = Math.max(distH, distW);
    camera.updateProjectionMatrix();
  }
  on(window, 'resize', resize);
  setQuality(forcedQuality || (weakDevice ? 'low' : 'high'));

  // ---------- mouse ----------
  const mouse = { x: 0, y: 0 };
  on(window, 'pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  });
  // el mouse sobre el logo (raycast sólo cuando se mueve)
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pointerDirty = false, hoverRaw = 0, hover = 0;
  on(canvas, 'pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerDirty = true;
  });
  on(canvas, 'pointerleave', () => { hoverRaw = 0; canvas.style.cursor = ''; });
  function updateHover(done) {
    if (pointerDirty && hoverMeshes.length) {
      raycaster.setFromCamera(ndc, camera);
      hoverRaw = raycaster.intersectObjects(hoverMeshes, false).length ? 1 : 0;
      canvas.style.cursor = hoverRaw && done > 0.9 ? 'pointer' : '';
      pointerDirty = false;
    }
    hover += (hoverRaw * done - hover) * 0.08;
  }
  // previsualización: ?flex=1 fija la flexión, ?mx=0.8&my=0 fija la posición del mouse
  const dbgFlex = params.get('flex');
  if (params.has('mx')) { mouse.x = +params.get('mx'); mouse.y = +(params.get('my') || 0); }
  if (params.has('hover')) hoverRaw = +params.get('hover');

  // ---------- impactos: cuando cada capa encaja en su lugar ----------
  // el impacto coincide con el "pop" de escala, cerca del final de cada tramo
  const LANDINGS = LAYOUT.map((c) => ({ at: c.from + (c.to - c.from) * 0.7, s: c.s }));
  const impacts = [];
  let prevP = -1, igniteAt = -10;
  function trackImpacts(p, t) {
    if (prevP < 0) prevP = p; // al cargar a mitad de página no se disparan impactos
    if (p > prevP) {
      LANDINGS.forEach((l, i) => {
        if (prevP < l.at && p >= l.at) {
          impacts.push({ t, s: l.s });
          audio.impact(l.s);
        }
      });
      if (prevP < 0.72 && p >= 0.72) { igniteAt = t; audio.ignite(); }
      if (prevP < 0.7 && p >= 0.7) audio.neon();
    }
    prevP = p;
    while (impacts.length && t - impacts[0].t > 2) impacts.shift();
    // react: el personaje "siente" cada capa que encaja (resorte amortiguado: respingo y vuelve a su lugar)
    let react = 0, flash = 0;
    for (const i of impacts) {
      const dt = t - i.t;
      react += i.s * Math.exp(-dt * 4.5) * Math.sin(dt * 11);
      flash += i.s * Math.exp(-dt * 4);
    }
    return { react: reduceMotion ? 0 : react, flash };
  }

  // ---------- vida del personaje ----------
  let nextBlink = 2, blinkStart = -1;
  let nextFlex = 3;
  const look = { turn: 0, nod: 0 };
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();

  // pone un hueso en reposo + rotaciones sobre los ejes del logo: {plane, turn, nod} en radianes
  function pose(name, rot = {}, scale = null) {
    const b = char.bones[name];
    if (!b) return;
    b.bone.quaternion.copy(b.rest);
    for (const k in rot) b.bone.quaternion.premultiply(_q.setFromAxisAngle(b.axes[k], rot[k]));
    b.bone.scale.copy(b.restScale);
    if (scale) b.bone.scale.multiply(scale);
  }

  // gestos: flexión de brazos y "desafío" (inclina la cabeza)
  const GESTURES = { flex: 1.4, challenge: 1.8 };
  const dbgGesture = params.get('gesture'); // ?gesture=flex o challenge fija ese gesto en su punto máximo
  let gesture = { type: 'flex', start: -10 }, gestureIdx = 0;
  function startGesture(t, type) {
    gesture = { type: type || Object.keys(GESTURES)[gestureIdx++ % 2], start: t };
    audio.whoosh(gesture.type === 'challenge' ? 0.7 : 1);
  }
  function gestureEnv(t, type) {
    if (dbgGesture) return dbgGesture === type ? 1 : 0;
    if (gesture.type !== type) return 0;
    const x = (t - gesture.start) / GESTURES[type];
    if (x < 0 || x > 1) return 0;
    return Math.sin(Math.PI * x) ** 2;
  }
  on(canvas, 'click', () => { if (smoothstep(current, 0.6, 0.85) > 0.9) startGesture(clock.elapsedTime); });

  function animateCharacter(t, p, r = 0) {
    const alive = smoothstep(p, 0.7, 1);
    // llega con la cabeza baja y "despierta" al encajar
    const awake = smoothstep(p, 0.62, 0.8);

    if (alive > 0.99 && t > nextFlex) { startGesture(t); nextFlex = t + 7 + Math.random() * 4; }
    const f = (dbgFlex !== null ? +dbgFlex : gestureEnv(t, 'flex')) * alive;
    const ch = gestureEnv(t, 'challenge') * alive;
    const b = Math.sin(t * 1.9) * alive; // respiración

    // la mirada sigue al mouse; con el mouse encima mira fijo al cursor (sin vigilar de lado a lado)
    const scan = 1 - hover;
    look.turn += ((mouse.x * (0.28 + 0.14 * hover) + Math.sin(t * 0.45) * 0.08 * scan) * awake - look.turn) * 0.07;
    look.nod += ((mouse.y * (0.14 + 0.06 * hover) + Math.sin(t * 0.7) * 0.02 * scan) * awake - look.nod) * 0.07;
    const headDown = (1 - awake) * 0.32;

    // al sentir un impacto (r): el pecho se contrae, los hombros se tensan y la cabeza cede un poco
    pose('B_Spine', { nod: r * 0.025 });
    pose('B_Chest', {}, _s.set(1 + b * 0.012 - r * 0.012, 1 + b * 0.006 - r * 0.018, 1 + b * 0.012));
    pose('B_Neck', { turn: look.turn * 0.4, nod: look.nod * 0.4 + headDown * 0.4 + ch * 0.04 + r * 0.04 });
    pose('B_Head', { turn: look.turn * 0.6, nod: look.nod * 0.6 + headDown * 0.6 + ch * 0.07 + r * 0.05,
      plane: Math.sin(t * 0.5) * 0.03 * alive - look.turn * 0.08 + ch * 0.14 + r * 0.02 });
    // hombros: suben al inhalar, al apretar, en el desafío y al sentir el impacto
    pose('B_ShoulderL', { plane: b * 0.015 + f * 0.05 + ch * 0.03 + r * 0.035 });
    pose('B_ShoulderR', { plane: -b * 0.015 - f * 0.05 - ch * 0.03 - r * 0.035 });
    // brazos se inflan al apretar
    pose('B_UpperArmL', {}, _s.set(1 + f * 0.07, 1, 1 + f * 0.07));
    pose('B_UpperArmR', {}, _s.set(1 + f * 0.07, 1, 1 + f * 0.07));
    // el antebrazo delantero sube el puño, el de abajo se cierra
    pose('B_ForearmR', { plane: f * 0.09 + b * 0.008 }, _s.set(1 + f * 0.05, 1, 1 + f * 0.05));
    pose('B_ForearmL', { plane: -f * 0.04 });
    pose('B_HandR', { plane: f * 0.05 }, _s.set(1 + f * 0.06, 1 + f * 0.06, 1 + f * 0.06));

    // parpadeo cada 2-5 s
    if (t > nextBlink) { blinkStart = t; nextBlink = t + 2 + Math.random() * 3; }
    const k = blinkStart < 0 ? 1 : Math.min(1, Math.abs((t - blinkStart) - 0.07) / 0.07);
    for (const e of char.eyes) e.obj.scale.y = e.sy * Math.max(0.08, k);

    // ojos apagados hasta que despierta; destello al encenderse
    if (char.eyeMat) {
      const ignite = Math.exp(-Math.max(0, t - igniteAt) * 3.5) * (t >= igniteAt ? 1 : 0);
      char.eyeMat.color.setScalar(0.04 + 0.96 * awake);
      char.eyeMat.emissiveIntensity = char.eyeMat.userData.base *
        (awake * (0.8 + 0.2 * Math.sin(t * 3)) * (1 + hover * 0.6) + ignite * 1.6 + f * 0.5 + ch * 1.2);
    }
  }

  // ---------- no dibujar cuando el logo no está en pantalla ----------
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(host);

  // ---------- loop ----------
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    const t = clock.elapsedTime;

    // modo liviano automático: si en los primeros ~2 s no llega a ~38 fps, se baja la calidad
    if (!perf.decided && layers.length) {
      perf.frames++;
      perf.time += clock.elapsedTime - (perf.last ?? clock.elapsedTime);
      perf.last = clock.elapsedTime;
      if (perf.frames > 120) {
        perf.decided = true;
        if (perf.time / perf.frames > 1 / 38) setQuality('low');
      }
    }

    // ?demo=1 recorre la animación sola (previsualización sin scroll); ?demo=0.6 se detiene en ese punto
    if (params.has('demo')) target = Math.min(clamp((t - 1.5) / 5, 0, 1), +params.get('demo') || 1);
    current += (target - current) * 0.1; // suavizado del scroll
    if (Math.abs(target - current) < 1e-4) current = target;

    arrangeLayers(current, t);
    const { react, flash } = trackImpacts(current, t);
    const done = smoothstep(current, 0.6, 0.85);
    const idle = smoothstep(current, 0.75, 1);
    updateHover(done);
    audio.setAmbient(done);

    // neón del escudo: se enciende al final, destella con cada impacto y sube con el mouse encima
    if (shieldRim) shieldRim.emissiveIntensity = shieldRim.userData.base * (0.4 + done * 0.65 + flash * 0.7 + hover * 0.35);
    bloom.strength = 0.15 + done * 0.13 + flash * 0.25 + hover * 0.06;

    // cámara: un poco más lejos y alta al inicio (para que entre la pila), se acerca al armarse
    const e = reduceMotion ? 1 : ease(smoothstep(current, 0, 0.75));
    camera.position.set(
      0,
      0.2 + (1 - e) * 0.2,
      baseDist * (1 + (0.06 + (1 - clamp(camera.aspect / 1.5, 0.5, 1)) * 0.15) * (1 - e)),
    );
    camera.lookAt(0, 0, 0);

    // inclinación con el mouse + flotación
    tilt.rotation.y += ((mouse.x * 0.22) + Math.sin(t * 0.8) * 0.05 * idle - tilt.rotation.y) * 0.06;
    tilt.rotation.x += ((mouse.y * 0.12) - tilt.rotation.x) * 0.06;
    tilt.position.y = LOGO_Y + Math.sin(t * 1.2) * 0.05 * idle;

    // luz blanca que cruza el logo cada 5 s; al terminar de armarse queda encendido
    const ph = ((t % 5) / 1.6), pw = ph < 1 ? Math.sin(Math.PI * ph) : 0;
    sweep.intensity = idle * pw * 3.5;
    shine.uShine.value = params.has('shine') ? +params.get('shine') : lerp(-3.2, 3.2, Math.min(ph, 1));
    shine.uShineAmt.value = params.has('shine') ? 1 : idle * pw;
    sweep.position.set(lerp(-3.5, 3.5, Math.min(ph, 1)), LOGO_Y + 0.8 - Math.min(ph, 1) * 1.2, 2.2);

    // polvo flotante
    const P = dust.pos;
    for (let i = 0; i < dust.N; i++) {
      P[i * 3 + 1] += dust.speed[i] * dt;
      P[i * 3] += Math.sin(t * 0.3 + i) * 0.002;
      if (P[i * 3 + 1] > 5) P[i * 3 + 1] = -5;
    }
    dust.pts.geometry.attributes.position.needsUpdate = true;

    animateCharacter(t, current, react);
    updateUI(current);
    composer.render();
  });

  return () => {
    renderer.setAnimationLoop(null);
    io.disconnect();
    listeners.forEach(([t, e, f, o]) => t.removeEventListener(e, f, o));
    audio.disable();
    composer.dispose?.();
    renderer.dispose();
  };
}

customElements.define('gamerzone-logo', GamerzoneLogo);
