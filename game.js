import * as THREE from 'three';

/* =========================================================
   JONRÓN PARK — pelota arcade 3D (béisbol)
   Mismo motor visual que Remate Park: personajes chibi con
   contorno, materiales toon y escenarios hechos con primitivas.
   ========================================================= */

// ---------- utilidades ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randn = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const angDamp = (a, b, k, dt) => a + wrapA(b - a) * (1 - Math.exp(-k * dt));
const SM = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
const DEG = Math.PI / 180;
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- campo (metros, escala arcade) ----------
// home en el origen, el lanzador hacia -z, primera base a la derecha (+x) vista desde el receptor
const BASE = 16;                         // distancia entre bases
const BD = BASE / Math.SQRT2;
const BASES = [{ x: 0, z: 0 }, { x: BD, z: -BD }, { x: 0, z: -2 * BD }, { x: -BD, z: -BD }, { x: 0, z: 0 }];
const BASE_NAME = ['home', 'primera', 'segunda', 'tercera', 'home'];
const MOUND = { x: 0, z: -10.6 };
const FENCE_C = 56, FENCE_L = 47, FENCE_H = 2.4;
const FAIR = Math.PI / 4;
const fenceR = (ang) => { const a = Math.min(1, Math.abs(ang) / FAIR); return FENCE_C - (FENCE_C - FENCE_L) * a * a; };
const angOf = (x, z) => Math.atan2(x, -z);   // 0 = jardín central, + = hacia primera
const SIDE_W = 9.2;                      // ancho del terreno de foul hasta las gradas
const S2 = Math.SQRT1_2;
const G = 14;                            // gravedad (arcade)
const PG = 24;                           // gravedad del jugador
const BALL_R = 0.12;
const ZONE = { x: 0.34, y0: 0.42, y1: 1.08 };   // zona de strike sobre el home
const CONTACT_Z = -0.3;                  // donde el bate encuentra la pelota
const STEP = 1 / 60;
const SWING_DT = 0.13;                   // del botón al contacto ideal
const RUN_V = 6.6, FIELD_V = 6.1, THROW_V = 25, FIELD_ACC = 10;
// distancia que recorre un defensor en t segundos saliendo desde parado
const runDist = (t, v) => { if (t <= 0) return 0; const tv = v / FIELD_ACC; return t < tv ? 0.5 * FIELD_ACC * t * t : 0.5 * v * tv + v * (t - tv); };
const RUN_CAP = 6;                       // carreras máximas por entrada
const TEAM_CSS = ['#2fd27a', '#ff4f9a'], TEAM_HEX = [0x2fd27a, 0xff4f9a], TEAM_NAME = ['Verdes', 'Rosas'];
const TEAM_DARK = ['#178a4c', '#b8286a'];
const ROLES = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
const POS = { P: [0, -10.6], C: [0, 1.3], '1B': [12.4, -14.4], '2B': [5.4, -21.4], SS: [-5.6, -21.2], '3B': [-12.4, -14.4], LF: [-21.5, -38.5], CF: [0, -45], RF: [21.5, -38.5] };
const IS_OF = { LF: 1, CF: 1, RF: 1 };
const BOX = { x: -0.88, z: 0.05 };       // caja de bateo (bateador derecho)
const PITCH_REL = { x: -0.32, y: 1.8, z: MOUND.z + 0.95 };
function groundY(x, z) { // el montículo está un poco elevado (solo visual)
  const d = Math.hypot(x - MOUND.x, z - MOUND.z);
  return d < 1.1 ? 0.22 : d < 2.4 ? 0.22 * (2.4 - d) / 1.3 : 0;
}

const DIFF = [
  { name: 'Fácil', pitchV: 0.8, win: 1.3, cpuSig: 0.085, eye: 0.5, cpuPow: 0.88, fieldV: 0.86, react: 0.36, throwV: 0.82, cpuRunM: 0.6 },
  { name: 'Normal', pitchV: 0.92, win: 1.0, cpuSig: 0.065, eye: 0.68, cpuPow: 1, fieldV: 0.96, react: 0.3, throwV: 0.95, cpuRunM: 0.4 },
  { name: 'Difícil', pitchV: 1.04, win: 0.86, cpuSig: 0.05, eye: 0.82, cpuPow: 1.08, fieldV: 1.05, react: 0.21, throwV: 1.06, cpuRunM: 0.26 },
];

const CPU_NAMES = ['Lucía', 'Mateo', 'Vale', 'Nico', 'Sofi', 'Tomás', 'Cami', 'Bruno', 'Pau', 'Leo', 'Martina', 'Gael',
  'Abril', 'Iker', 'Noa', 'Thiago', 'Emma', 'Dante', 'Mía', 'Santi', 'Lola', 'Hugo', 'Zoe', 'Rocco', 'Maite', 'Joaco',
  'Yadier', 'Liván', 'Yuli', 'Orestes', 'Dayana', 'Alexei', 'Yasmany', 'Osmani', 'Leidy', 'Frank'];

// ---------- personalización (se desbloquea por nivel) ----------
const OPTS = {
  skin: ['#ffdcc0', '#f3c48e', '#d8a06b', '#b47a4c', '#8b5a36', '#5f3b23'].map((v) => ({ v, lv: 1 })),
  hair: [['spiky', 'Pinchos', 1], ['bowl', 'Casco', 1], ['buns', 'Moños', 1], ['bald', 'Rapado', 1], ['curly', 'Rizos', 2],
    ['long', 'Melena', 3], ['mohawk', 'Cresta', 5], ['swoop', 'Tupé', 7]].map(([v, n, lv]) => ({ v, n, lv })),
  hairColor: [['#2b1d14', 1], ['#6b3e1f', 1], ['#e8c25a', 1], ['#d9502f', 2], ['#f2f2f2', 3], ['#7a4cff', 4], ['#25b8ff', 6],
    ['#ff5fb0', 8]].map(([v, lv]) => ({ v, lv })),
  acc: [['none', 'Nada', 1], ['eyeblack', 'Pintura', 1], ['shades', 'Gafas', 2], ['band', 'Muñequeras', 3], ['mustache', 'Bigote', 5],
    ['chain', 'Cadena', 8], ['crown', 'Corona', 12]].map(([v, n, lv]) => ({ v, n, lv })),
  bat: [['#c8955a', 1], ['#5a3a24', 1], ['#d7dbe4', 2], ['#1d2340', 3], ['#ff4f9a', 5], ['#25b8ff', 7], ['#ffc93a', 10]].map(([v, lv]) => ({ v, lv })),
  glove: [['#8a5a36', 1], ['#5a3a24', 1], ['#1d2340', 2], ['#e8413a', 4], ['#25b8ff', 6], ['#ffc93a', 9]].map(([v, lv]) => ({ v, lv })),
  cel: [['punos', 'Puños', 1], ['salto', 'Salto', 1], ['aplauso', 'Aplausos', 2], ['baile', 'Baile', 4], ['voltereta', 'Voltereta', 7], ['campeon', 'Campeón', 10]].map(([v, n, lv]) => ({ v, n, lv })),
};
const OPT_LABEL = { skin: 'Piel', hair: 'Peinado', hairColor: 'Color de pelo', acc: 'Accesorio', bat: 'Bate', glove: 'Guante', cel: 'Celebración' };
function randomLook() {
  return {
    skin: pick(OPTS.skin).v, hair: pick(OPTS.hair).v, hairColor: pick(OPTS.hairColor).v,
    acc: Math.random() < 0.6 ? 'none' : pick(OPTS.acc.slice(1, 5)).v,
    bat: pick(OPTS.bat.slice(0, 4)).v, glove: pick(OPTS.glove.slice(0, 3)).v, cel: pick(['punos', 'salto', 'aplauso']),
  };
}

// ---------- guardado ----------
const SAVE_KEY = 'jonronpark_v1';
function defaultSave() {
  return {
    name: 'Jugador' + randi(10, 99),
    look: { skin: '#f3c48e', hair: 'spiky', hairColor: '#2b1d14', acc: 'none', bat: '#c8955a', glove: '#8a5a36', cel: 'punos' },
    xp: 0, level: 1, wins: 0, games: 0, streak: 0, best: 0, innings: 3, diff: 1, venue: 'parque', help: 1, batMode: 'cursor', throwMode: 'manual',
    muted: false, derbyBest: 0, derbyLong: 0, hrTotal: 0, quality: 'auto', tags: 'auto', vib: true, seenHelp: false,
  };
}
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.look) { const d = defaultSave(); const o = Object.assign(d, s); o.look = Object.assign(defaultSave().look, s.look); return o; }
  } catch (e) { /* sin almacenamiento */ }
  return defaultSave();
}
const SAVE = loadSave();
function storeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* ignorar */ } }
const xpNeed = (lv) => 250 + lv * 150;

// ---------- sonido (sintetizado, sin archivos) ----------
const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function env(g, t0, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, type = 'lowpass', freq = 1000, q = 1, delay = 0, attack = 0.003) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, attack, vol, dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random()); s.stop(t + dur + attack + 0.05);
  }
  return {
    resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
    set muted(v) { muted = v; },
    crack(p = 0.7) { noise(0.05, 0.9, 'highpass', 4000 + p * 1400, 0.8); tone(1500 + p * 500, 0.05, 'square', 0.08, 500); tone(170, 0.13, 'sine', 0.45 + p * 0.3, 60); noise(0.14, 0.3 * p, 'bandpass', 900, 1.5, 0.01); },
    foul() { noise(0.04, 0.5, 'highpass', 3000); tone(700, 0.05, 'triangle', 0.12, 300); },
    pop() { tone(240, 0.07, 'sine', 0.5, 110); noise(0.05, 0.55, 'bandpass', 1300, 1.4); },
    swish(v = 1) { noise(0.2, 0.32 * v, 'bandpass', 700, 0.9, 0, 0.06); },
    strike() { tone(330, 0.12, 'square', 0.09, 300); tone(262, 0.3, 'square', 0.09, 240, 0.13); },
    ballCall() { tone(392, 0.16, 'triangle', 0.12, 370); },
    organ() { [392, 523, 659, 784, 0, 659, 784].forEach((f, i) => { if (f) tone(f, i === 6 ? 0.42 : 0.15, 'square', 0.055, null, i * 0.13); }); },
    firework() { noise(0.5, 0.3, 'bandpass', 600, 0.6, 0, 0.01); noise(0.8, 0.1, 'highpass', 5000, 0.5, 0.15, 0.1); },
    bounce(v = 1) { tone(130, 0.12, 'sine', 0.35 * v, 60); noise(0.07, 0.25 * v, 'lowpass', 700); },
    wall() { tone(90, 0.2, 'square', 0.12, 50); noise(0.15, 0.6, 'lowpass', 500, 0.8); },
    jump() { noise(0.1, 0.12, 'lowpass', 500); },
    dive() { noise(0.3, 0.3, 'lowpass', 400, 0.7, 0, 0.02); },
    slide() { noise(0.35, 0.32, 'lowpass', 900, 0.6, 0, 0.03); },
    hype() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.14, 'square', 0.06, null, i * 0.06)); noise(1.8, 0.24, 'bandpass', 1400, 0.6, 0, 0.15); },
    cheer(v = 1) { noise(1.5, 0.2 * v, 'bandpass', 1100, 0.6, 0, 0.25); noise(1.1, 0.12 * v, 'bandpass', 2500, 0.8, 0.1, 0.2); },
    perfect() { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, null, i * 0.05)); },
    ui() { tone(700, 0.06, 'triangle', 0.14, 950); },
    point(good) {
      if (good) [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, null, i * 0.07));
      else [392, 330, 262].forEach((f, i) => tone(f, 0.18, 'triangle', 0.12, null, i * 0.09));
    },
    levelUp() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 'square', 0.07, null, i * 0.08)); },
  };
})();
SFX.muted = !!SAVE.muted;

// =========================================================
//  RENDER Y MUNDO
// =========================================================
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
camera.position.set(0, 14, 24);
function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);
onResize();

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
scene.fog = new THREE.Fog(0xd4efff, 70, 220);
const hemi = new THREE.HemisphereLight(0xe8f6ff, 0x4f9a3f, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff6e5, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);
const SUN_OFF = new THREE.Vector3(10, 24, 12);

// materiales toon
const toonGrad = (() => {
  const d = new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const matCache = new Map();
function toon(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad }, opts || {})));
  return matCache.get(key);
}
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1d2340, side: THREE.BackSide });
function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  return m;
}
let OUTLINES = true;
function outline(m, s = 1.08) {
  const o = new THREE.Mesh(m.geometry, outlineMat);
  o.userData.ol = true; o.visible = OUTLINES;
  if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(s[0], s[1], s[2]);
  m.add(o);
  return m;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _col = new THREE.Color(), _p3 = new THREE.Vector3(), _s3 = new THREE.Vector3();
const blobGeo = new THREE.IcosahedronGeometry(1, 1);
const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
function inst(geo, mat, list, shadow = false) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  im.count = list.length;
  list.forEach((it, i) => {
    _m4.compose(_p3.set(it.x, it.y || 0, it.z), _q.setFromEuler(_e.set(it.rx || 0, it.ry || 0, it.rz || 0)), _s3.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1));
    im.setMatrixAt(i, _m4);
    if (it.c !== undefined) im.setColorAt(i, _col.set(it.c));
  });
  im.castShadow = shadow;
  return im;
}
const texCache = {};
function vtex(key, w, h, draw, rep) {
  if (!texCache[key]) texCache[key] = canvasTex(w, h, draw);
  const t = texCache[key].clone();
  t.needsUpdate = true;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const speckle = (g, w, h, n, cols, sz = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.fillRect(Math.random() * w, Math.random() * h, sz, sz); } };
const blobTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// ---------- contorno del terreno de juego ----------
function fieldPoly() {
  const pts = [], N = 48, R = FENCE_L + 0.4, w = SIDE_W;
  for (let i = 0; i <= N; i++) { const a = -FAIR + (2 * FAIR * i) / N, r = fenceR(a) + 0.4; pts.push({ x: Math.sin(a) * r, z: -Math.cos(a) * r }); }
  pts.push({ x: S2 * R + S2 * w, z: -S2 * R + S2 * w });
  pts.push({ x: S2 * w, z: S2 * w });
  for (let i = 1; i < 14; i++) { const t = Math.PI / 4 + (Math.PI / 2) * (i / 14); pts.push({ x: Math.cos(t) * w, z: Math.sin(t) * w }); }
  pts.push({ x: -S2 * w, z: S2 * w });
  pts.push({ x: -S2 * R - S2 * w, z: -S2 * R + S2 * w });
  return pts;
}
// ¿está fuera del terreno (con margen m)?
function outsideField(x, z, m = 0) {
  const r = Math.hypot(x, z), ang = angOf(x, z);
  if (Math.abs(ang) <= FAIR) return r > fenceR(ang) + 0.4 + m;
  if (z > 0 && r > SIDE_W + m) return true;
  const d = x >= 0 ? (x + z) * S2 : (-x + z) * S2;
  if (d > SIDE_W + m) return true;
  return r > FENCE_L + 2 + m;
}

// ---------- textura del campo (césped, tierra, cal) ----------
const FT = { x0: -66, x1: 66, z0: -68, z1: 18 };
function fieldTexture(v) {
  const k = IS_TOUCH ? 9 : 15;
  const W = Math.round((FT.x1 - FT.x0) * k), H = Math.round((FT.z1 - FT.z0) * k);
  return canvasTex(W, H, (g) => {
    const X = (x) => (x - FT.x0) * k, Y = (z) => (z - FT.z0) * k, M = (m) => m * k;
    const circ = (c, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(X(c.x), Y(c.z), M(r), 0, Math.PI * 2); g.fill(); };
    g.fillStyle = v.out; g.fillRect(0, 0, W, H);
    speckle(g, W, H, 3000, v.outSpk || ['rgba(255,255,255,.04)', 'rgba(0,0,0,.05)'], 3);
    const poly = fieldPoly();
    g.save();
    g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.z)) : g.moveTo(X(p.x), Y(p.z)))); g.closePath();
    g.clip();
    g.fillStyle = v.grass[0]; g.fillRect(0, 0, W, H);
    // franjas de césped cortado en arcos alrededor del home
    g.fillStyle = v.grass[1];
    for (let r = 6; r < 90; r += 9) { g.beginPath(); g.arc(X(0), Y(0), M(r + 4.5), 0, Math.PI * 2); g.arc(X(0), Y(0), M(r), 0, Math.PI * 2, true); g.fill(); }
    speckle(g, W, H, 9000, ['rgba(255,255,255,.035)', 'rgba(0,50,0,.05)'], 2);
    // pista de advertencia junto a la valla
    g.fillStyle = v.dirt;
    g.beginPath();
    const N = 60;
    for (let i = 0; i <= N; i++) { const a = -FAIR - 0.08 + ((2 * FAIR + 0.16) * i) / N, r = fenceR(a) + 1.5; g.lineTo(X(Math.sin(a) * r), Y(-Math.cos(a) * r)); }
    for (let i = N; i >= 0; i--) { const a = -FAIR - 0.08 + ((2 * FAIR + 0.16) * i) / N, r = fenceR(a) - 3.2; g.lineTo(X(Math.sin(a) * r), Y(-Math.cos(a) * r)); }
    g.closePath(); g.fill();
    // cuadro interior: tierra en arco + césped del diamante + círculos de bases
    circ(MOUND, 17.2, v.dirt);
    g.fillStyle = v.grass[0];
    const cz = -BD, rr = BD - 1.75;
    g.beginPath(); g.moveTo(X(0), Y(cz + rr)); g.lineTo(X(rr), Y(cz)); g.lineTo(X(0), Y(cz - rr)); g.lineTo(X(-rr), Y(cz)); g.closePath(); g.fill();
    g.save(); g.clip();
    g.fillStyle = v.grass[1];
    for (let i = -6; i < 6; i += 2) { g.save(); g.translate(X(0), Y(cz)); g.rotate(Math.PI / 4); g.fillRect(M(i * 2.4), -M(20), M(2.4), M(40)); g.restore(); }
    g.restore();
    for (const b of [1, 2, 3]) circ(BASES[b], 2.0, v.dirt);
    circ(MOUND, 2.5, v.dirt);
    circ(BASES[0], 3.1, v.dirt);
    // cal
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = Math.max(2, M(0.11)); g.lineCap = 'round';
    const L = FENCE_L + 0.5;
    g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(S2 * L), Y(-S2 * L)); g.moveTo(X(0), Y(0)); g.lineTo(X(-S2 * L), Y(-S2 * L)); g.stroke();
    g.lineWidth = Math.max(1.5, M(0.07));
    for (const s of [-1, 1]) g.strokeRect(X(s > 0 ? 0.55 : -1.45), Y(-0.95), M(0.9), M(1.9));
    g.beginPath(); g.moveTo(X(-0.55), Y(0.95)); g.lineTo(X(-0.55), Y(2.6)); g.lineTo(X(0.55), Y(2.6)); g.lineTo(X(0.55), Y(0.95)); g.stroke();
    // camino de primera (línea del corredor)
    g.beginPath(); g.moveTo(X(BD * 0.5 + 0.7), Y(-BD * 0.5 + 0.7)); g.lineTo(X(BD + 0.7), Y(-BD + 0.7)); g.stroke();
    g.restore();
  });
}

// ---------- campo: bases, montículo, valla, gradas ----------
const FIELD = new THREE.Group();
scene.add(FIELD);
let fieldPlane = null;
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
{
  for (const b of [1, 2, 3]) {
    const bag = outline(mesh(new THREE.BoxGeometry(0.46, 0.1, 0.46), toon('#ffffff')), 1.1);
    bag.position.set(BASES[b].x, 0.05, BASES[b].z); bag.rotation.y = Math.PI / 4; bag.receiveShadow = true;
    FIELD.add(bag);
  }
  const shp = new THREE.Shape([new THREE.Vector2(-0.22, 0.22), new THREE.Vector2(0.22, 0.22), new THREE.Vector2(0.22, 0), new THREE.Vector2(0, -0.22), new THREE.Vector2(-0.22, 0)]);
  const plate = new THREE.Mesh(new THREE.ShapeGeometry(shp), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  plate.rotation.x = -Math.PI / 2; plate.position.y = 0.014; FIELD.add(plate);
  const rubber = mesh(new THREE.BoxGeometry(0.6, 0.05, 0.15), toon('#ffffff'));
  rubber.position.set(MOUND.x, 0.245, MOUND.z); FIELD.add(rubber);
}
const moundMat = new THREE.MeshLambertMaterial({ color: 0xc98b55 });
{
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.45, 0.22, 28), moundMat);
  m.position.set(MOUND.x, 0.11, MOUND.z); m.receiveShadow = true; FIELD.add(m);
}
// marcador gigante (se redibuja cuando cambia el partido)
const BOARD = { key: '', tex: null };
{
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  BOARD.canvas = c;
  BOARD.tex = new THREE.CanvasTexture(c); BOARD.tex.colorSpace = THREE.SRGBColorSpace;
}
function drawBoard(st) {
  const g = BOARD.canvas.getContext('2d'), W = 512, H = 256;
  g.fillStyle = '#141a33'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ffd23a'; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12);
  g.fillStyle = '#ffd23a'; g.font = '700 38px Fredoka, sans-serif'; g.textAlign = 'center';
  g.fillText('JONRÓN PARK', W / 2, 52);
  g.font = '700 42px Fredoka, sans-serif';
  for (let t = 0; t < 2; t++) {
    const y = 112 + t * 62;
    g.textAlign = 'left'; g.fillStyle = TEAM_CSS[t]; g.fillText(TEAM_NAME[t].toUpperCase(), 40, y);
    g.textAlign = 'right'; g.fillStyle = '#ffffff'; g.fillText(st ? String(st.score[t]) : '0', W - 40, y);
  }
  g.font = '600 26px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#9fb4ff';
  g.fillText(st ? (st.derby ? `DERBY · ${st.derbyHr} JONRONES` : `${st.half ? '▼' : '▲'} ENTRADA ${st.inning} · ${st.outs} OUT${st.outs === 1 ? '' : 'S'}`) : 'PELOTA ARCADE', W / 2, 232);
  BOARD.tex.needsUpdate = true;
}
drawBoard(null);

// ---------- gradas con público ----------
const FAN_COLS = ['#ff4f9a', '#2fd27a', '#ffd23a', '#ffffff', '#3a7bff', '#ff7a2f', '#a24bff', '#2fd27a', '#ff4f9a'];
function standsAlong(steps, fans, p1, p2, n, tiers, cols, fanP = 0.8, base = 0) {
  const dx = p2.x - p1.x, dz = p2.z - p1.z, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
  const ux = dx / len, uz = dz / len;
  for (let k = 0; k < tiers; k++) {
    const off = 0.65 + k * 1.2, h = base + (k + 1) * 0.72;
    steps.push({ x: (p1.x + p2.x) / 2 + n.x * off, y: h / 2, z: (p1.z + p2.z) / 2 + n.z * off, sx: len, sy: h, sz: 1.2, ry, c: cols[k % cols.length] });
    const cnt = Math.floor(len / 0.85);
    for (let i = 0; i < cnt; i++) {
      if (Math.random() > fanP) continue;
      const s = 0.42 + i * 0.85;
      fans.push({ x: p1.x + ux * s + n.x * off, y: h + 0.36, z: p1.z + uz * s + n.z * off, sx: 0.46, sy: 0.72, sz: 0.4, ry, c: pick(FAN_COLS), base: h + 0.36, ph: rand(0, 6) });
    }
  }
}
function standsArc(steps, fans, a0, a1, rFn, tiers, cols, fanP = 0.8, base = 0) {
  const N = Math.max(6, Math.round(Math.abs(a1 - a0) * 26));
  for (let i = 0; i < N; i++) {
    const t0 = a0 + ((a1 - a0) * i) / N, t1 = a0 + ((a1 - a0) * (i + 1)) / N;
    const r0 = rFn(t0), r1 = rFn(t1);
    const p1 = { x: Math.sin(t0) * r0, z: -Math.cos(t0) * r0 }, p2 = { x: Math.sin(t1) * r1, z: -Math.cos(t1) * r1 };
    const tm = (t0 + t1) / 2;
    standsAlong(steps, fans, p1, p2, { x: Math.sin(tm), z: -Math.cos(tm) }, tiers, cols, fanP, base);
  }
}
function addStands(g, steps, fans) {
  if (steps.length) { const m = inst(BOX_GEO, new THREE.MeshLambertMaterial({ color: 0xffffff }), steps); m.receiveShadow = true; g.add(m); }
  if (!fans.length) return null;
  const fm = inst(BOX_GEO, new THREE.MeshLambertMaterial({ color: 0xffffff }), fans);
  g.add(fm);
  return { mesh: fm, list: fans };
}
// gradas a lo largo de las líneas de foul (desde cerca del home hasta "hasta" metros)
function lineStands(steps, fans, from, to, tiers, cols, fanP) {
  for (const sx of [-1, 1]) {
    const n = { x: sx * S2, z: S2 }, u = { x: sx * S2, z: -S2 };
    const o = SIDE_W + 0.4;
    standsAlong(steps, fans, { x: n.x * o + u.x * from, z: n.z * o + u.z * from }, { x: n.x * o + u.x * to, z: n.z * o + u.z * to }, n, tiers, cols, fanP);
  }
}
function homeStands(steps, fans, tiers, cols, fanP) {
  const r = SIDE_W + 0.4;
  for (let i = 0; i < 10; i++) {
    const t0 = Math.PI / 4 + (Math.PI / 2) * (i / 10), t1 = Math.PI / 4 + (Math.PI / 2) * ((i + 1) / 10), tm = (t0 + t1) / 2;
    standsAlong(steps, fans, { x: Math.cos(t0) * r, z: Math.sin(t0) * r }, { x: Math.cos(t1) * r, z: Math.sin(t1) * r }, { x: Math.cos(tm), z: Math.sin(tm) }, tiers, cols, fanP);
  }
}

// valla, postes, backstop, banquillos y marcador (cambian de color con el escenario)
function buildPark(g, v) {
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(FT.x1 - FT.x0, FT.z1 - FT.z0), new THREE.MeshLambertMaterial({ map: fieldTexture(v) }));
  fp.rotation.x = -Math.PI / 2; fp.position.set((FT.x0 + FT.x1) / 2, 0.004, (FT.z0 + FT.z1) / 2); fp.receiveShadow = true;
  g.add(fp);
  fieldPlane = fp;
  moundMat.color.set(v.dirt);
  // valla del jardín
  const segs = [], pads = [];
  const N = 64;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const a = -FAIR + (2 * FAIR * i) / N, r = fenceR(a) + 0.55;
    const p = { x: Math.sin(a) * r, z: -Math.cos(a) * r };
    if (prev) {
      const dx = p.x - prev.x, dz = p.z - prev.z, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
      segs.push({ x: (p.x + prev.x) / 2, y: FENCE_H / 2, z: (p.z + prev.z) / 2, sx: len * 1.03, sy: FENCE_H, sz: 0.3, ry, c: i % 8 < 4 ? v.wall : v.wall2 || v.wall });
      pads.push({ x: (p.x + prev.x) / 2, y: FENCE_H + 0.06, z: (p.z + prev.z) / 2, sx: len * 1.03, sy: 0.14, sz: 0.36, ry, c: '#ffd23a' });
    }
    prev = p;
  }
  // muros laterales y detrás del home
  const poly = fieldPoly();
  for (let i = 48; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
    if (len < 0.1) continue;
    segs.push({ x: (a.x + b.x) / 2, y: 0.55, z: (a.z + b.z) / 2, sx: len * 1.04, sy: 1.1, sz: 0.25, ry, c: v.wall });
  }
  const wm = inst(BOX_GEO, toon('#ffffff'), segs, true); wm.receiveShadow = true; g.add(wm);
  g.add(inst(BOX_GEO, toon('#ffffff'), pads));
  // números de distancia en la valla
  for (const a of [-0.62, -0.32, 0, 0.32, 0.62]) {
    const r = fenceR(a) + 0.38, txt = Math.round(fenceR(a));
    const tex = canvasTex(128, 64, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); c.font = '700 48px Fredoka, sans-serif'; c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.fillText(txt + 'm', w / 2, 50); });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    pl.position.set(Math.sin(a) * r, 1.35, -Math.cos(a) * r); pl.lookAt(0, 1.35, 0);
    g.add(pl);
  }
  // postes de foul
  for (const s of [-1, 1]) {
    const R = FENCE_L + 0.7;
    const pole = outline(mesh(new THREE.CylinderGeometry(0.13, 0.13, 11, 10), toon('#ffd23a')), 1.15);
    pole.position.set(s * S2 * R, 5.5, -S2 * R); g.add(pole);
    const flag = mesh(new THREE.BoxGeometry(0.05, 2.4, 0.9), toon('#ffd23a'));
    flag.position.set(s * S2 * R - s * 0.2, 8.5, -S2 * R + 0.45); flag.rotation.y = s * Math.PI / 4; g.add(flag);
  }
  // red detrás del home (backstop)
  const netTex = vtex('net', 64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#1d2340'; c.lineWidth = 4; c.strokeRect(0, 0, w, h); }, [40, 6]);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(SIDE_W, SIDE_W, 3.4, 40, 1, true, -Math.PI / 4, Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, opacity: 0.8 }));
  net.position.y = 1.1 + 1.7; net.rotation.y = 0;
  g.add(net);
  for (let i = 0; i <= 4; i++) {
    const t = Math.PI / 4 + (Math.PI / 2) * (i / 4);
    const p = mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.5, 6), toon('#3a3f4e'));
    p.position.set(Math.cos(t) * SIDE_W, 2.25, Math.sin(t) * SIDE_W); g.add(p);
  }
  // banquillos (tercera = Verdes, primera = Rosas)
  for (const sx of [-1, 1]) {
    const team = sx < 0 ? 0 : 1;
    const n = { x: sx * S2, z: S2 }, u = { x: sx * S2, z: -S2 };
    const o = SIDE_W + 1.5, along = 9;
    const cx = n.x * o + u.x * along, cz = n.z * o + u.z * along, ry = Math.atan2(-u.z, u.x);
    const grp = new THREE.Group(); grp.position.set(cx, 0, cz); grp.rotation.y = ry; g.add(grp);
    const back = mesh(BOX_GEO, toon('#3a3f4e')); back.scale.set(7, 2.2, 0.3); back.position.set(0, 1.1, sx < 0 ? -0.9 : 0.9); grp.add(back);
    const roof = outline(mesh(BOX_GEO, toon(TEAM_CSS[team]))); roof.scale.set(7.4, 0.25, 2.2); roof.position.set(0, 2.3, 0); grp.add(roof);
    const bench = mesh(BOX_GEO, toon('#c8955a')); bench.scale.set(6, 0.45, 0.5); bench.position.set(0, 0.22, sx < 0 ? -0.5 : 0.5); grp.add(bench);
    for (const e of [-1, 1]) { const w = mesh(BOX_GEO, toon('#3a3f4e')); w.scale.set(0.25, 2.2, 2.0); w.position.set(e * 3.55, 1.1, 0); grp.add(w); }
  }
  // marcador
  const bz = -(FENCE_C + 10);
  for (const s of [-1, 1]) { const leg = mesh(new THREE.BoxGeometry(0.6, 9, 0.6), toon('#3a3f4e')); leg.position.set(s * 5, 4.5, bz); g.add(leg); }
  const frame = outline(mesh(new THREE.BoxGeometry(13, 6.6, 0.5), toon('#1d2340')), 1.02); frame.position.set(0, 11, bz); g.add(frame);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 6.1), new THREE.MeshBasicMaterial({ map: BOARD.tex, fog: false }));
  board.position.set(0, 11, bz + 0.27); g.add(board);
}

// ---------- capas de paisaje ----------
function ringSpots(n, r0, r1, margin = 4) {
  const out = [];
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    const a = rand(0, Math.PI * 2), r = rand(r0, r1);
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 15;
    if (!outsideField(x, z, margin)) continue;
    if (z > 4 && z < 60 && Math.abs(x) < 34) continue; // deja libre la vista de la cámara (detrás del home)
    out.push({ x, z });
  }
  return out;
}
function cloudsLayer(g, color = 0xffffff, emissive = 0x9fb8cc, n = 12) {
  const list = [];
  for (let c = 0; c < n; c++) {
    const a = rand(0, Math.PI * 2), r = rand(150, 210), y = rand(38, 64);
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r - 20;
    for (let j = 0; j < 5; j++) { const s = rand(7, 12); list.push({ x: cx + rand(-14, 14), y: y + rand(-3, 4), z: cz + rand(-8, 8), sx: s * 1.4, sy: s * 0.8, sz: s }); }
  }
  g.add(inst(blobGeo, new THREE.MeshLambertMaterial({ color, fog: false, emissive }), list));
}
function hillsLayer(g, color, n = 14, r = 190) {
  const mat = new THREE.MeshLambertMaterial({ color });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    h.position.set(Math.cos(a) * r, -2, Math.sin(a) * r - 20);
    h.scale.set(rand(40, 70), rand(16, 30), rand(26, 40));
    g.add(h);
  }
}
function groundPlane(g, color, map) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial(map ? { map } : { color }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, -0.01, -20); m.receiveShadow = true;
  g.add(m);
}
function treesLayer(g, spots, greens = ['#4caf3f', '#5bbf45', '#3f9e3a', '#6cc24a']) {
  const trunks = [], crowns = [];
  spots.forEach((t, i) => {
    const s = rand(1.2, 2.2);
    trunks.push({ x: t.x, y: 1.3 * s, z: t.z, s });
    for (const o of [[0, 3.6, 0, 2.0], [1.1, 3.0, 0.4, 1.5], [-1.0, 3.1, -0.3, 1.5], [0.2, 4.4, -0.5, 1.4]])
      crowns.push({ x: t.x + o[0] * s, y: o[1] * s, z: t.z + o[2] * s, rx: rand(0, 3), ry: rand(0, 3), sx: o[3] * s, sy: o[3] * s * 0.9, sz: o[3] * s, c: _col.set(greens[i % greens.length]).offsetHSL(0, 0, rand(-0.04, 0.04)).getHex() });
  });
  g.add(inst(new THREE.CylinderGeometry(0.28, 0.4, 2.6, 7), toon('#8a5a36'), trunks));
  g.add(inst(blobGeo, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGrad }), crowns));
}

const VENUES = {
  parque: {
    name: 'Parque', emoji: '🌳',
    sky: ['#3fa7f5', '#8fd3ff', '#dff4ff'], fog: [0xd4efff, 90, 260], hemi: [0xe8f6ff, 0x4f9a3f, 1.15], sun: [0xfff6e5, 1.7, 10, 24, 12],
    grass: ['#5cc451', '#52b648'], dirt: '#c98b55', out: '#58b94d', wall: '#1f6b4a', wall2: '#1b5e41', dust: 0xd9b98a,
    build(g) {
      groundPlane(g, 0x58b94d);
      const steps = [], fans = [];
      lineStands(steps, fans, 4, 30, 3, ['#d6dbe8', '#c3c9da'], 0.75);
      treesLayer(g, ringSpots(110, 62, 150));
      hillsLayer(g, 0x7cc767);
      cloudsLayer(g);
      return { fans: addStands(g, steps, fans) };
    },
  },
  playa: {
    name: 'Playa', emoji: '🏖️',
    sky: ['#1f8fe6', '#7fd0ff', '#fff1d6'], fog: [0xf1ead9, 100, 300], hemi: [0xfff4e0, 0xd9b77a, 1.15], sun: [0xfff0d0, 1.85, 14, 26, 6],
    grass: ['#63c35a', '#59b651'], dirt: '#e2bb7a', out: '#efd29a', outSpk: ['#e4c27f', '#f7e2b5', '#d9b46e'], wall: '#2a7fd6', wall2: '#2470bd', dust: 0xf3dcaa,
    build(g) {
      groundPlane(g, 0, vtex('sand', 256, 256, (c, w, h) => {
        c.fillStyle = '#efd29a'; c.fillRect(0, 0, w, h);
        speckle(c, w, h, 2600, ['#e4c27f', '#f7e2b5', '#d9b46e', '#fff1cf'], 2);
      }, [90, 90]));
      const seaTex = vtex('sea', 128, 128, (c, w, h) => {
        c.fillStyle = '#1aa7d6'; c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3;
        for (let i = 0; i < 6; i++) { c.beginPath(); for (let x = 0; x <= w; x += 4) c.lineTo(x, i * 22 + 8 + Math.sin(x / 10) * 3); c.stroke(); }
      }, [40, 20]);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(800, 300), new THREE.MeshLambertMaterial({ map: seaTex }));
      sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.03, -250);
      g.add(sea);
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(800, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
      foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.05, -100);
      g.add(foam);
      const steps = [], fans = [];
      lineStands(steps, fans, 4, 26, 2, ['#ffffff', '#ffe9b0'], 0.7);
      // palmeras
      const trunks = [], leaves = [], cocos = [];
      ringSpots(60, 60, 120).filter((p) => p.z > -95).forEach((p) => {
        const h = rand(7, 11), lean = rand(-0.25, 0.25), ry = rand(0, 6);
        for (let k = 0; k < 6; k++) trunks.push({ x: p.x + Math.sin(lean) * k * h / 6 * Math.cos(ry), y: k * h / 6 + 0.7, z: p.z + Math.sin(lean) * k * h / 6 * Math.sin(ry), rz: lean, s: 1.4 - k * 0.08 });
        const tx = p.x + Math.sin(lean) * h * Math.cos(ry), tz = p.z + Math.sin(lean) * h * Math.sin(ry);
        for (let k = 0; k < 7; k++) leaves.push({ x: tx, y: h + 0.4, z: tz, ry: (k / 7) * Math.PI * 2 + ry, s: 1.5, c: pick(['#3f9e3a', '#4caf3f', '#5bbf45']) });
        for (let k = 0; k < 3; k++) cocos.push({ x: tx + rand(-0.4, 0.4), y: h, z: tz + rand(-0.4, 0.4), s: 0.3 });
      });
      g.add(inst(new THREE.CylinderGeometry(0.22, 0.28, 1.45, 7), toon('#a7784a'), trunks));
      const leafGeo = new THREE.ConeGeometry(0.55, 3.4, 4, 1);
      leafGeo.rotateZ(-Math.PI / 2 - 0.35); leafGeo.translate(1.6, -0.5, 0); leafGeo.scale(1, 0.35, 1);
      g.add(inst(leafGeo, new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGrad }), leaves));
      g.add(inst(blobGeo, toon('#6b4a2a'), cocos));
      for (let i = 0; i < 14; i++) {
        const p = ringSpots(1, 58, 90)[0];
        if (!p) continue;
        const col = pick(['#ff4f9a', '#ffd23a', '#2fd27a', '#3a7bff', '#ff7a2f']);
        const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), toon('#ffffff')); pole.position.set(p.x, 1.3, p.z); g.add(pole);
        const top = outline(mesh(new THREE.ConeGeometry(1.5, 0.7, 10), toon(col))); top.position.set(p.x, 2.65, p.z); g.add(top);
      }
      cloudsLayer(g, 0xffffff, 0xb8c8d8, 8);
      return { fans: addStands(g, steps, fans), update(dt, t) { seaTex.offset.y = (t * 0.03) % 1; foam.material.opacity = 0.6 + Math.sin(t * 1.3) * 0.25; } };
    },
  },
  atardecer: {
    name: 'Ciudad', emoji: '🌇',
    sky: ['#2b1d5c', '#c3478a', '#ffb067'], fog: [0xd98a78, 110, 300], hemi: [0xffc9a8, 0x4a3a66, 1.05], sun: [0xffb36b, 1.65, -16, 14, -10],
    grass: ['#4fae58', '#47a050'], dirt: '#b9784a', out: '#6a6e7c', outSpk: ['#7f8491', '#5f6372'], wall: '#3a3f6e', wall2: '#333866', dust: 0xc9ccd6,
    build(g) {
      groundPlane(g, 0x6a6e7c);
      const steps = [], fans = [];
      lineStands(steps, fans, 3, 36, 4, ['#5d6272', '#4f5464'], 0.8);
      homeStands(steps, fans, 3, ['#5d6272', '#4f5464'], 0.8);
      const winTex = vtex('windows', 64, 128, (c, w, h) => {
        c.fillStyle = '#2a2f4a'; c.fillRect(0, 0, w, h);
        for (let y = 4; y < h; y += 10) for (let x = 4; x < w; x += 10) { c.fillStyle = Math.random() < 0.45 ? pick(['#ffd27a', '#ffe9a8', '#ffb35c']) : '#1d2236'; c.fillRect(x, y, 6, 6); }
      }, [2, 4]);
      const blds = [];
      for (let i = 0; i < 160; i++) {
        const a = rand(0, Math.PI * 2), r = rand(95, 210);
        const x = Math.cos(a) * r, z = Math.sin(a) * r - 20;
        if (z > 0 && Math.abs(x) < 60 && z < 120) continue;
        const hgt = rand(14, 70) * (r > 150 ? 1.3 : 1);
        blds.push({ x, y: hgt / 2, z, sx: rand(9, 20), sy: hgt, sz: rand(9, 20), ry: rand(0, 1), c: pick(['#ffffff', '#e6dcff', '#ffe0cc', '#d6e4ff']) });
      }
      g.add(inst(BOX_GEO, new THREE.MeshLambertMaterial({ map: winTex, color: 0xffffff, emissive: 0x2a2140 }), blds));
      const bulbs = [];
      for (const sx of [-1, 1]) {
        for (let k = 0; k <= 40; k++) {
          const f = k / 40, o = SIDE_W + 1.2, al = 4 + f * 32;
          bulbs.push({ x: sx * S2 * o + sx * S2 * al, y: 4.2 - Math.sin(f * Math.PI * 4) * 0.4, z: S2 * o - S2 * al, s: 0.12, c: pick(['#ffd27a', '#ff9ec7', '#9fe3ff', '#fff3b0']) });
        }
      }
      const bulbMesh = inst(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs);
      g.add(bulbMesh);
      cloudsLayer(g, 0xffc2d6, 0x8a4a7a, 8);
      return { fans: addStands(g, steps, fans), update(dt, t) { bulbMesh.material.color.setScalar(0.85 + Math.sin(t * 3) * 0.15); } };
    },
  },
  estadio: {
    name: 'Estadio', emoji: '🏟️',
    sky: ['#04071a', '#0b1533', '#1a2a55'], fog: [0x0b1533, 120, 330], hemi: [0x9fb4ff, 0x1d2340, 0.65], sun: [0xffffff, 2.0, 4, 30, 10],
    grass: ['#3fae4f', '#379a46'], dirt: '#c27d4a', out: '#1b2440', outSpk: ['#202a4a', '#18203a'], wall: '#1d3a8a', wall2: '#1a3279', dust: 0xd0d6e6,
    build(g) {
      groundPlane(g, 0x1b2440);
      const steps = [], fans = [];
      const cols = ['#2b3a66', '#334678'];
      lineStands(steps, fans, 2, FENCE_L + 4, 8, cols, 0.85);
      homeStands(steps, fans, 4, cols, 0.85);
      standsArc(steps, fans, -FAIR, FAIR, (a) => fenceR(a) + 3, 9, cols, 0.82, 1.2);
      // torres de luz
      for (const [x, z] of [[-36, 8], [36, 8], [-46, -46], [46, -46], [-18, -70], [18, -70]]) {
        const pole = mesh(new THREE.CylinderGeometry(0.35, 0.5, 26, 8), toon('#3a3f4e')); pole.position.set(x, 13, z); g.add(pole);
        const lamp = mesh(new THREE.BoxGeometry(5, 2.4, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff8e0 })); lamp.position.set(x, 26.5, z); lamp.lookAt(0, 0, -16); g.add(lamp);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: blobTex, color: 0xfff3c4, transparent: true, opacity: 0.85, depthWrite: false })); glow.position.set(x, 26.5, z); glow.scale.setScalar(14); g.add(glow);
      }
      const N = 600, sp = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { const a = rand(0, Math.PI * 2), e = rand(0.15, 1.3), r = 280; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, fog: false })));
      return { fans: addStands(g, steps, fans) };
    },
  },
};
const VENUE_IDS = Object.keys(VENUES);
const VENUE = { id: '', group: null, fx: null };
const skyCache = {};
let DUST = 0xd9b98a;
function setVenue(id) {
  if (!VENUES[id]) id = 'parque';
  if (VENUE.id === id) return;
  const v = VENUES[id];
  if (VENUE.group) {
    scene.remove(VENUE.group);
    VENUE.group.traverse((o) => {
      if (o.geometry && o.geometry !== blobGeo && o.geometry !== BOX_GEO) o.geometry.dispose();
      if (o.material && o.material.map && o.material.map !== BOARD.tex) o.material.map.dispose();
    });
  }
  const g = new THREE.Group();
  buildPark(g, v);
  VENUE.fx = v.build(g) || null;
  scene.add(g);
  VENUE.group = g; VENUE.id = id;
  if (!skyCache[id]) skyCache[id] = canvasTex(4, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, v.sky[0]); gr.addColorStop(0.55, v.sky[1]); gr.addColorStop(1, v.sky[2]);
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  scene.background = skyCache[id];
  scene.fog.color.setHex(v.fog[0]); scene.fog.near = v.fog[1]; scene.fog.far = v.fog[2];
  hemi.color.setHex(v.hemi[0]); hemi.groundColor.setHex(v.hemi[1]); hemi.intensity = v.hemi[2];
  sun.color.setHex(v.sun[0]); sun.intensity = v.sun[1]; SUN_OFF.set(v.sun[2], v.sun[3], v.sun[4]).normalize().multiplyScalar(40);
  DUST = v.dust;
  applyShadowFlags();
}
function applyShadowFlags() { if (!renderer.shadowMap.enabled) scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); }); }
// público que salta en los batazos
const CHEER = { t: 0 };
function updateVenue(dt, t) {
  if (VENUE.fx && VENUE.fx.update) VENUE.fx.update(dt, t);
  const F = VENUE.fx && VENUE.fx.fans;
  if (!F) return;
  if (CHEER.t > 0 || CHEER.was) {
    CHEER.t = Math.max(0, CHEER.t - dt);
    const amp = Math.min(1, CHEER.t / 0.6);
    const m = F.mesh;
    for (let i = 0; i < F.list.length; i++) {
      const it = F.list[i];
      const y = it.base + Math.max(0, Math.sin(t * 11 + it.ph)) * 0.35 * amp;
      _m4.compose(_p3.set(it.x, y, it.z), _q.setFromEuler(_e.set(0, it.ry || 0, 0)), _s3.set(it.sx, it.sy, it.sz));
      m.setMatrixAt(i, _m4);
    }
    m.instanceMatrix.needsUpdate = true;
    CHEER.was = CHEER.t > 0;
  }
}

// ---------- pelota ----------
const ballTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e8413a'; g.lineWidth = 5;
  for (const off of [0, w / 2]) {
    g.beginPath();
    for (let y = 0; y <= h; y += 3) g.lineTo(off + w / 4 + Math.sin((y / h) * Math.PI * 2) * w * 0.12, y);
    g.stroke();
  }
  g.setLineDash([3, 5]); g.lineWidth = 3;
  for (const off of [0, w / 2]) for (const d of [-9, 9]) {
    g.beginPath();
    for (let y = 0; y <= h; y += 3) g.lineTo(off + w / 4 + d + Math.sin((y / h) * Math.PI * 2) * w * 0.12, y);
    g.stroke();
  }
});
const BALL_VIS = 0.15;
const ballMesh = outline(mesh(new THREE.SphereGeometry(BALL_VIS, 20, 14), new THREE.MeshToonMaterial({ map: ballTex, gradientMap: toonGrad })), 1.14);
scene.add(ballMesh);
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_VIS * 1.3, 20), new THREE.MeshBasicMaterial({ color: 0x1d2340, transparent: true, opacity: 0.35, depthWrite: false }));
ballShadow.rotation.x = -Math.PI / 2;
scene.add(ballShadow);
// marcador de caída de la pelota
const landMark = new THREE.Group();
{
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 40), ringMat);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), ringMat);
  const outer = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.08, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
  for (const m of [ring, dot, outer]) { m.rotation.x = -Math.PI / 2; landMark.add(m); }
  landMark.userData = { ring, dot, outer, mat: ringMat };
  landMark.position.y = 0.035;
  landMark.visible = false;
  scene.add(landMark);
}
// mira sobre el campo (a dónde mandas el batazo / a qué base tiras)
const aimMark = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 36), mat);
  ring.rotation.x = -Math.PI / 2; aimMark.add(ring);
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.75), mat);
    t.rotation.x = -Math.PI / 2;
    const a = (i * Math.PI) / 2;
    t.position.set(Math.cos(a) * 1.45, 0, Math.sin(a) * 1.45);
    t.rotation.z = a + Math.PI / 2;
    aimMark.add(t);
  }
  aimMark.position.y = 0.04;
  aimMark.userData.mat = mat;
  aimMark.visible = false;
  scene.add(aimMark);
}
// flecha en el suelo hacia donde apuntas el batazo (se ve bien desde detrás del home)
const aimWedge = (() => {
  const tex = canvasTex(64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(255,225,77,0)'); gr.addColorStop(0.25, 'rgba(255,225,77,.55)'); gr.addColorStop(0.85, 'rgba(255,225,77,.55)'); gr.addColorStop(1, 'rgba(255,225,77,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 6;
    for (let y = 40; y < h - 20; y += 44) { g.beginPath(); g.moveTo(10, y + 18); g.lineTo(w / 2, y); g.lineTo(w - 10, y + 18); g.stroke(); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.2, 0, -3, 0.2, 0, -3, 2.2, 0, -36, -2.2, 0, -36], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.position.y = 0.05; m.visible = false; m.renderOrder = 3;
  scene.add(m);
  return m;
})();
// zona de strike, mira de lanzamiento y ayuda de bateo
const zoneGrp = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  const w = ZONE.x * 2, h = ZONE.y1 - ZONE.y0, t = 0.018, cy = (ZONE.y0 + ZONE.y1) / 2;
  for (const [sx, sy, x, y] of [[w + t, t, 0, ZONE.y0], [w + t, t, 0, ZONE.y1], [t, h, -ZONE.x, cy], [t, h, ZONE.x, cy]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), mat); m.position.set(x, y, 0); zoneGrp.add(m);
  }
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
  fill.position.set(0, cy, 0); zoneGrp.add(fill);
  for (const o of zoneGrp.children) o.material.side = THREE.DoubleSide;
  zoneGrp.visible = false;
  scene.add(zoneGrp);
}
function ringMarker(r0, r1, color, op = 0.95) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, depthTest: false }));
  m.renderOrder = 5; m.visible = false; scene.add(m);
  return m;
}
const pitchMark = ringMarker(0.075, 0.11, 0xffe14d);
const pitchDot = ringMarker(0, 0.03, 0xffe14d);
const crossMark = ringMarker(0.09, 0.125, 0xffffff);
const timingRing = ringMarker(0.13, 0.16, 0xffe14d, 0.9);
// círculo del bate (bateo con cursor) y aro de precisión del lanzamiento: anillos de radio 1 que se escalan
const batCursor = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), mat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.86, 40), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.16, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  const h = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06), mat), v = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.5), mat);
  for (const m of [ring, fill, h, v]) { m.renderOrder = 6; batCursor.add(m); }
  batCursor.userData = { mat, fill: fill.material };
  batCursor.visible = false;
  scene.add(batCursor);
}
const meterRing = ringMarker(0.9, 1, 0xffe14d, 0.95);
const meterGoal = ringMarker(0.085, 0.115, 0x7dffb0, 0.9);
const baseRings = [null];
for (let b = 1; b <= 4; b++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(BASES[b].x, 0.06, BASES[b].z); m.visible = false; scene.add(m);
  baseRings.push(m);
}

// ---------- partículas ----------
const PARTS = [];
function spawnPart(x, y, z, vx, vy, vz, size, color, life, grav = 0) {
  let s = PARTS.find((p) => !p.alive);
  if (!s) {
    if (PARTS.length > 260) return;
    const m = new THREE.SpriteMaterial({ map: blobTex, transparent: true, depthWrite: false });
    s = { sp: new THREE.Sprite(m), alive: false };
    scene.add(s.sp);
    PARTS.push(s);
  }
  Object.assign(s, { alive: true, x, y, z, vx, vy, vz, size, life, max: life, grav });
  s.sp.material.color.set(color);
  s.sp.visible = true;
}
let PART_SCALE = 1;
function puff(x, y, z, n = 8, color = 0xffffff, size = 0.5, spread = 2.2, up = 1.2) {
  n = Math.max(1, Math.round(n * PART_SCALE));
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(0.4, 1) * spread;
    spawnPart(x, y + 0.1, z, Math.cos(a) * sp, rand(0.3, 1) * up, Math.sin(a) * sp, size * rand(0.7, 1.3), color, rand(0.35, 0.6));
  }
}
function sparks(x, y, z, n = 14, color = 0xffe14d, sp0 = 3, sp1 = 7, grav = 9, size = 0.25) {
  n = Math.max(2, Math.round(n * PART_SCALE));
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), b = rand(-0.5, 1.2), sp = rand(sp0, sp1);
    spawnPart(x, y, z, Math.cos(a) * sp * Math.cos(b), Math.sin(b) * sp, Math.sin(a) * sp * Math.cos(b), rand(0.7, 1.3) * size, typeof color === 'function' ? color() : color, rand(0.4, 0.7), grav);
  }
}
function fireworks(x, y, z) {
  const col = pick([0xff4f9a, 0x2fd27a, 0xffd23a, 0x3a7bff, 0xff7a2f, 0xffffff]);
  sparks(x, y, z, 34, () => (Math.random() < 0.3 ? 0xffffff : col), 7, 13, 3, 1.2);
}
function updateParts(dt) {
  for (const p of PARTS) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; p.sp.visible = false; continue; }
    p.vy -= p.grav * dt;
    p.vx *= 1 - 2.5 * dt; p.vz *= 1 - 2.5 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = p.life / p.max;
    p.sp.position.set(p.x, p.y, p.z);
    p.sp.scale.setScalar(p.size * (1.4 - k * 0.4));
    p.sp.material.opacity = Math.min(1, k * 1.6);
  }
}
const CONF = [];
{
  const geo = new THREE.PlaneGeometry(0.16, 0.26);
  const cols = [0xff4f9a, 0x2fd27a, 0xffd23a, 0x3a7bff, 0xffffff, 0xff7a2f];
  for (let i = 0; i < 180; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
    m.visible = false;
    scene.add(m);
    CONF.push({ m, alive: false });
  }
}
function confetti(x, z, n = 120, spread = 6) {
  let c = 0;
  for (const p of CONF) {
    if (c >= n) break;
    if (p.alive) continue;
    c++;
    Object.assign(p, { alive: true, x: x + rand(-spread, spread), y: rand(6, 12), z: z + rand(-spread, spread), vx: rand(-1, 1), vy: rand(0, 3), vz: rand(-1, 1), rx: rand(0, 6), ry: rand(0, 6), life: rand(3, 5) });
    p.m.visible = true;
  }
}
function updateConfetti(dt) {
  for (const p of CONF) {
    if (!p.alive) continue;
    p.life -= dt;
    p.vy = Math.max(p.vy - 6 * dt, -2.2);
    p.x += (p.vx + Math.sin(p.life * 3) * 0.8) * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.rx += dt * 5; p.ry += dt * 4;
    if (p.life <= 0 || p.y < 0.02) { p.alive = false; p.m.visible = false; continue; }
    p.m.position.set(p.x, p.y, p.z);
    p.m.rotation.set(p.rx, p.ry, 0);
  }
}
const TRAIL = [];
for (let i = 0; i < 12; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: blobTex, transparent: true, depthWrite: false, color: 0xfff3b0 }));
  s.visible = false;
  scene.add(s);
  TRAIL.push(s);
}
const trailPts = [];
function updateTrail(bx, by, bz, speed, fire) {
  trailPts.unshift([bx, by, bz]);
  if (trailPts.length > TRAIL.length) trailPts.pop();
  const on = speed > 13 || (fire && speed > 2);
  TRAIL.forEach((s, i) => {
    const p = trailPts[i];
    if (!p || !on || i === 0) { s.visible = false; return; }
    s.visible = true;
    s.position.set(p[0], p[1], p[2]);
    const k = 1 - i / TRAIL.length;
    s.scale.setScalar(BALL_VIS * (fire ? 3.4 : 2.4) * k);
    s.material.opacity = 0.55 * k;
    s.material.color.setHex(fire ? (i % 2 ? 0xff7a1a : 0xffc93a) : 0xfff3b0);
  });
}
const shock = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
shock.visible = false;
scene.add(shock);
let shockT = 0;
function shockwave(x, y, z) { shock.position.set(x, y, z); shock.lookAt(camera.position); shockT = 0.3; shock.visible = true; }
function updateShock(dt) {
  if (shockT <= 0) return;
  shockT -= dt;
  const k = 1 - shockT / 0.3;
  shock.scale.setScalar(0.3 + k * 1.6);
  shock.material.opacity = 1 - k;
  if (shockT <= 0) shock.visible = false;
}

// =========================================================
//  PERSONAJES (chibi cartoon, hechos con primitivas)
// =========================================================
const GEO = {
  head: new THREE.SphereGeometry(0.4, 24, 18),
  cap: new THREE.SphereGeometry(0.425, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.46),
  bowl: new THREE.SphereGeometry(0.435, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
  hat: new THREE.SphereGeometry(0.445, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
  helmet: new THREE.SphereGeometry(0.47, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
  ball: new THREE.SphereGeometry(1, 14, 10),
  cone: new THREE.ConeGeometry(0.11, 0.34, 7),
  torso: new THREE.CapsuleGeometry(0.25, 0.2, 6, 14),
  shorts: new THREE.CylinderGeometry(0.255, 0.275, 0.2, 14),
  limb: new THREE.CylinderGeometry(0.062, 0.058, 1, 8),
  sleeve: new THREE.CylinderGeometry(0.09, 0.08, 0.16, 10),
  sock: new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8),
  torus: new THREE.TorusGeometry(0.41, 0.045, 8, 28),
  brim: new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20, 1, false, -Math.PI / 2, Math.PI),
  footRing: new THREE.RingGeometry(0.42, 0.52, 28),
  band: new THREE.CylinderGeometry(0.078, 0.078, 0.07, 10),
  chain: new THREE.TorusGeometry(0.2, 0.022, 6, 20),
};
const BAT_GEO = new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.034, 0.012], [0.019, 0.03], [0.018, 0.27], [0.025, 0.43], [0.037, 0.6], [0.043, 0.78], [0.041, 0.845], [0, 0.85]].map(([r, y]) => new THREE.Vector2(r, y)), 12);
const BLACK = '#1d2340';

function buildHair(head, look) {
  // siempre llevan gorra o casco: solo se ve el pelo de los lados y de atrás
  const hm = toon(look.hairColor);
  const add = (geo, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, ol = true) => {
    if (y > 0.27) return null;
    const m = mesh(geo, hm);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
    if (ol) outline(m, 1.07);
    head.add(m);
    return m;
  };
  const style = look.hair;
  if (style === 'bald') return;
  if (style === 'bowl') { add(GEO.bowl, 0, 0.02, -0.02, 1, 1, 1, -0.12); return; }
  add(GEO.cap, 0, 0.02, -0.03, 1, 1, 1, -0.32);
  if (style === 'spiky') {
    for (const [x, y, z, rx, rz] of [[0.28, 0.2, -0.1, -0.2, -1.0], [-0.28, 0.2, -0.1, -0.2, 1.0], [0, 0.16, -0.36, -1.4, 0], [0.18, 0.12, -0.3, -1.2, -0.6], [-0.18, 0.12, -0.3, -1.2, 0.6]])
      add(GEO.cone, x, y, z, 1, 1, 1, rx, 0, rz);
  } else if (style === 'buns') {
    add(GEO.ball, 0, 0.1, -0.42, 0.16, 0.16, 0.16);
  } else if (style === 'curly') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = 0.36;
      add(GEO.ball, Math.cos(a) * r, 0.12 + Math.sin(i * 1.7) * 0.05, Math.sin(a) * r - 0.04, 0.13, 0.13, 0.13, 0, 0, 0, false);
    }
  } else if (style === 'long') {
    add(GEO.ball, 0, -0.08, -0.2, 0.4, 0.42, 0.26);
  } else if (style === 'mohawk') {
    for (let i = 0; i < 3; i++) add(GEO.box, 0, 0.22 - i * 0.12, -0.4 - i * 0.02, 0.08, 0.16, 0.12, -0.3 - i * 0.3);
  } else if (style === 'swoop') {
    add(GEO.ball, 0, 0.0, -0.36, 0.22, 0.3, 0.16, 0.3, 0, 0);
  }
}

function buildAcc(c, look) {
  const h = look.acc, head = c.head;
  if (h === 'shades') {
    for (const s of [-1, 1]) { const g = mesh(GEO.box, toon(BLACK)); g.scale.set(0.2, 0.12, 0.04); g.position.set(s * 0.15, 0.05, 0.38); head.add(g); }
    const br = mesh(GEO.box, toon(BLACK)); br.scale.set(0.12, 0.03, 0.03); br.position.set(0, 0.08, 0.39); head.add(br);
  } else if (h === 'eyeblack') {
    for (const s of [-1, 1]) { const g = mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0x1d2340 }), false); g.scale.set(0.11, 0.03, 0.02); g.position.set(s * 0.15, -0.07, 0.375); g.rotation.z = s * 0.1; head.add(g); }
  } else if (h === 'mustache') {
    const m = mesh(GEO.box, toon(look.hair === 'bald' ? '#3b2a20' : look.hairColor), false); m.scale.set(0.18, 0.04, 0.03); m.position.set(0, -0.1, 0.39); head.add(m);
  } else if (h === 'band') {
    for (const el of c.elbows) { const b = mesh(GEO.band, toon('#ffffff'), false); b.position.y = -ARM + 0.08; el.add(b); }
  } else if (h === 'chain') {
    const ch = mesh(GEO.chain, toon('#ffcf3a'), false); ch.rotation.x = Math.PI / 2 - 0.35; ch.position.set(0, 0.6, 0.08); c.torso.add(ch);
  } else if (h === 'crown') {
    const cr = outline(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12, 1, true), toon('#ffcf3a', { side: THREE.DoubleSide })));
    cr.position.y = 0.5; head.add(cr);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const k = mesh(GEO.cone, toon('#ffcf3a')); k.scale.set(0.5, 0.4, 0.5); k.position.set(Math.cos(a) * 0.18, 0.61, Math.sin(a) * 0.18); head.add(k); }
  }
}

// Esqueleto: root → rig → pelvis → torso (brazos con codo, cabeza) + piernas con rodilla
const THIGH = 0.27, SHIN = 0.28;
const ARM = 0.26;
const legH = (h, k) => THIGH * Math.cos(h) + SHIN * Math.cos(h + k);
const BLOB_GEO = new THREE.CircleGeometry(0.45, 18), BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x1d2340, transparent: true, opacity: 0.28, depthWrite: false });
const _lookV = new THREE.Vector3(), _ckV = new THREE.Vector3(), _ckA = new THREE.Vector3(), _yUp = new THREE.Vector3(0, 1, 0);
const _bH = new THREE.Vector3(), _bD = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _ik = { sx: 0, rz: 0, el: 0 };
// IK de dos huesos (brazo + antebrazo) en el marco del torso; hombro en (s·0,31, 0,5, 0)
function solveArm(px, py, pz, s, out) {
  let ux = px - s * 0.31, uy = py - 0.5, uz = pz;
  const d0 = Math.hypot(ux, uy, uz);
  if (d0 < 1e-4) return false;
  ux /= d0; uy /= d0; uz /= d0;
  const d = clamp(d0, 0.12, 2 * ARM * 0.99);
  const flex = Math.PI - Math.acos(clamp(1 - (d * d) / (2 * ARM * ARM), -1, 1));
  const ca = Math.cos(flex / 2), sa = Math.sin(flex / 2);
  out.rz = Math.asin(clamp(ux / ca, -1, 1));
  out.sx = Math.atan2(-uz, -uy) + Math.atan2(sa, ca * Math.cos(out.rz));
  out.el = -flex;
  return true;
}
const ARM_CH = ['sx', 'sin', 'el'], LEG_CH = ['hx', 'kn', 'hz'], BODY_CH = ['lean', 'twist', 'leanZ', 'headX', 'mouth', 'rigX'];
function keyPose(keys, t, T) {
  let a = keys[0], b = a;
  const last = keys[keys.length - 1];
  if (t >= last.t) a = b = last;
  else if (t > a.t) for (let i = 0; i < keys.length - 1; i++) if (t <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
  const k = a === b ? 0 : SM((t - a.t) / (b.t - a.t));
  for (const c in a) {
    if (c === 't') continue;
    const va = a[c], vb = c in b ? b[c] : va;
    T[c] = Array.isArray(va) ? [va[0] + (vb[0] - va[0]) * k, va[1] + (vb[1] - va[1]) * k] : va + (vb - va) * k;
  }
}
function copyPose(P) { return { ...P, sx: [P.sx[0], P.sx[1]], sin: [P.sin[0], P.sin[1]], el: [P.el[0], P.el[1]], hx: [P.hx[0], P.hx[1]], hz: [P.hz[0], P.hz[1]], kn: [P.kn[0], P.kn[1]] }; }
function mixPose(T, A, wA, wL) {
  for (const c of ARM_CH) for (let i = 0; i < 2; i++) T[c][i] += (A[c][i] - T[c][i]) * wA;
  for (const c of BODY_CH) T[c] += (A[c] - T[c]) * wA;
  for (const c of LEG_CH) for (let i = 0; i < 2; i++) T[c][i] += (A[c][i] - T[c][i]) * wL;
  T.bounce += (A.bounce - T.bounce) * wL;
}
// ---- claves de animación (índice 0 = lado derecho del personaje: brazo de lanzar) ----
const STANCE = { hx: [-0.38, -0.3], kn: [0.66, 0.55], hz: [-0.24, 0.24], lean: 0.3, twist: -0.25, leanZ: 0, headX: -0.05, mouth: 0.03 };
const K_STANCE = [{ t: 0, ...STANCE }];
const K_SWING = [
  { t: 0, ...STANCE },
  { t: 0.06, hx: [-0.32, -0.62], kn: [0.7, 0.88], hz: [-0.22, 0.17], lean: 0.27, twist: -0.5, leanZ: 0.05, mouth: 0.03 },
  { t: SWING_DT, hx: [-0.16, -0.42], kn: [0.88, 0.22], hz: [-0.3, 0.33], lean: 0.32, twist: 0.45, leanZ: -0.12, mouth: 0.07 },
  { t: 0.24, hx: [0.04, -0.38], kn: [0.92, 0.16], hz: [-0.24, 0.3], lean: 0.18, twist: 1.15, leanZ: -0.16, mouth: 0.06 },
  { t: 0.6, hx: [0, -0.3], kn: [0.72, 0.25], hz: [-0.2, 0.25], lean: 0.12, twist: 1.2, leanZ: -0.1, mouth: 0.04 },
  { t: 0.95, ...STANCE },
];
const K_BUNT = [{ t: 0, hx: [-0.5, -0.45], kn: [0.95, 0.9], hz: [-0.26, 0.26], lean: 0.32, twist: 0.6, leanZ: 0, headX: 0, mouth: 0.03 }];
const K_PITCH = [ // lanzador derecho mirando al home: pierna izquierda arriba, zancada y brazo por arriba
  { t: 0, hx: [-0.05, -0.05], kn: [0.1, 0.1], hz: [0, 0], lean: 0.05, twist: 0, leanZ: 0, sx: [-0.9, -0.9], sin: [0.5, 0.5], el: [-1.7, -1.7], headX: -0.05, mouth: 0.03 },
  { t: 0.28, hx: [-0.05, -1.45], kn: [0.2, 1.7], hz: [0, 0.05], lean: -0.05, twist: -0.7, leanZ: 0.05, sx: [-1.1, -1.1], sin: [0.45, 0.45], el: [-1.6, -1.6], headX: -0.1 },
  { t: 0.46, hx: [0.15, -1.0], kn: [0.55, 0.6], hz: [-0.05, 0.1], lean: 0, twist: -0.55, leanZ: 0.1, sx: [-3.2, -1.5], sin: [-0.55, -0.1], el: [-1.6, -0.25], headX: -0.15 },
  { t: 0.6, hx: [0.55, -0.75], kn: [0.85, 0.55], hz: [-0.1, 0.1], lean: 0.45, twist: 0.55, leanZ: -0.15, sx: [-2.3, -0.6], sin: [-0.3, 0.3], el: [-0.25, -1.7], headX: -0.25, mouth: 0.06 },
  { t: 0.8, hx: [0.2, -0.85], kn: [0.9, 0.7], hz: [-0.1, 0.1], lean: 0.7, twist: 0.6, leanZ: -0.1, sx: [-0.35, -0.5], sin: [0.65, 0.3], el: [-0.5, -1.6], headX: -0.3 },
  { t: 1.15, hx: [-0.35, -0.35], kn: [0.7, 0.7], hz: [-0.15, 0.15], lean: 0.35, twist: 0, leanZ: 0, sx: [-0.7, -0.8], sin: [0.1, 0.1], el: [-0.9, -0.9], headX: -0.2 },
];
const K_THROW = [
  { t: 0, hx: [0.2, -0.5], kn: [0.5, 0.5], hz: [-0.1, 0.1], lean: 0, twist: -0.6, leanZ: 0.1, sx: [-3.1, -1.4], sin: [-0.5, -0.1], el: [-1.7, -0.3], headX: -0.15 },
  { t: 0.12, hx: [0.25, -0.55], kn: [0.55, 0.5], hz: [-0.1, 0.1], lean: 0.05, twist: -0.65, leanZ: 0.1, sx: [-3.2, -1.5], sin: [-0.55, -0.1], el: [-1.7, -0.3], headX: -0.15 },
  { t: 0.22, hx: [0.45, -0.6], kn: [0.7, 0.45], hz: [-0.1, 0.1], lean: 0.4, twist: 0.45, leanZ: -0.15, sx: [-2.2, -0.6], sin: [-0.3, 0.3], el: [-0.2, -1.6], headX: -0.2, mouth: 0.06 },
  { t: 0.38, hx: [0.1, -0.5], kn: [0.7, 0.5], hz: [-0.1, 0.1], lean: 0.55, twist: 0.5, leanZ: -0.05, sx: [-0.4, -0.6], sin: [0.6, 0.2], el: [-0.5, -1.4], headX: -0.25 },
  { t: 0.55, hx: [-0.2, -0.2], kn: [0.4, 0.4], hz: [0, 0], lean: 0.2, twist: 0, leanZ: 0, sx: [-0.4, -0.5], sin: [0.1, 0.1], el: [-0.6, -0.8], headX: -0.1 },
];
const K_FIELD = [ // agarrar una rola: agachado con el guante abajo
  { t: -0.2, hx: [-0.6, -0.6], kn: [1.2, 1.2], hz: [-0.25, 0.25], lean: 0.6, sx: [-0.8, -1.0], sin: [0.1, 0.2], el: [-0.3, -0.2], headX: -0.4 },
  { t: 0, hx: [-0.9, -0.9], kn: [1.6, 1.6], hz: [-0.3, 0.3], lean: 0.8, sx: [-0.7, -0.8], sin: [0.2, 0.3], el: [-0.15, -0.1], headX: -0.5 },
  { t: 0.25, hx: [-0.5, -0.5], kn: [1.0, 1.0], hz: [-0.2, 0.2], lean: 0.5, sx: [-1.2, -1.0], sin: [0.3, 0.3], el: [-1.4, -1.2], headX: -0.3 },
];
const K_SQUAT = [{ t: 0, hx: [-1.25, -1.25], kn: [2.3, 2.3], hz: [-0.42, 0.42], lean: 0.32, twist: 0, leanZ: 0, sx: [-0.6, -1.45], sin: [0.15, -0.1], el: [-1.2, -0.3], headX: -0.05, mouth: 0.03 }];
const K_CATCH = [
  { t: 0, sx: [-0.5, -2.7], sin: [0.1, -0.1], el: [-0.6, -0.2], lean: 0.05, headX: -0.4 },
  { t: 0.25, sx: [-0.5, -2.4], sin: [0.1, 0], el: [-0.6, -0.4], lean: 0.1, headX: -0.3 },
  { t: 0.5, sx: [-0.6, -1.0], sin: [0.1, 0.2], el: [-0.8, -1.4], lean: 0.15, headX: -0.15 },
];
const ACT = {
  stance: { keys: K_STANCE, D: 99, bi: 0.1, legs: 'own' },
  swing: { keys: K_SWING, D: 0.95, legs: 'own' },
  bunt: { keys: K_BUNT, D: 99, bi: 0.1, legs: 'own' },
  pitch: { keys: K_PITCH, D: 1.15, bo: 0.25, legs: 'own' },
  throw: { keys: K_THROW, D: 0.55, bo: 0.15, legs: 'pre' },
  field: { keys: K_FIELD, D: 0.45, bo: 0.15, legs: 'pre' },
  squat: { keys: K_SQUAT, D: 99, bi: 0.15, legs: 'own' },
  catch: { keys: K_CATCH, D: 0.5, bo: 0.15, legs: 'pre' },
};
const BAT_ANIM = { stance: 1, swing: 1, bunt: 1 };
// bate durante el swing: [t, ángulo respecto al cuerpo (0 = hacia el receptor, π/2 = sobre el home), elevación]
const SWING_KEYS = [[0, -0.6, 0.95], [0.06, -0.25, 0.32], [SWING_DT, Math.PI / 2, -0.06], [0.24, 3.6, 0.15], [0.45, 4.3, 0.75], [0.7, 4.4, 0.85]];

class Char {
  constructor(info) {
    this.id = info.id;
    this.team = info.team;
    this.variant = Math.abs(info.id * 7 + 3) % 3;
    const look = (this.look = info.look || randomLook());
    this.cel = look.cel || ['punos', 'salto', 'aplauso'][this.variant];
    const teamColor = TEAM_CSS[info.team], dark = TEAM_DARK[info.team];
    const pants = info.team === 0 ? '#ffffff' : '#e4e7f1';
    this.root = new THREE.Group();
    this.foot = new THREE.Mesh(GEO.footRing, new THREE.MeshBasicMaterial({ color: TEAM_HEX[info.team], transparent: true, opacity: 0.75, depthWrite: false }));
    this.foot.rotation.x = -Math.PI / 2;
    this.root.add(this.foot);
    const rig = (this.rig = new THREE.Group());
    this.root.add(rig);
    const pelvis = (this.pelvis = new THREE.Group());
    pelvis.position.y = 0.55;
    rig.add(pelvis);
    const torso = (this.torso = new THREE.Group());
    pelvis.add(torso);
    const tm = outline(mesh(GEO.torso, toon(teamColor))); tm.position.y = 0.33; tm.scale.set(1, 1, 0.85); torso.add(tm);
    const stripe = mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.06, 16), toon('#ffffff'), false); stripe.position.y = 0.42; stripe.scale.z = 0.86; torso.add(stripe);
    const shorts = outline(mesh(GEO.shorts, toon(pants))); shorts.position.y = 0.04; pelvis.add(shorts);
    const belt = mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.05, 16), toon(BLACK), false); belt.position.y = 0.13; pelvis.add(belt);
    this.hips = []; this.knees = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.12, 0, 0); pelvis.add(hip);
      const thigh = mesh(GEO.limb, toon(pants)); thigh.scale.set(1.4, THIGH, 1.4); thigh.position.y = -THIGH / 2; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -THIGH; hip.add(knee);
      const shin = mesh(GEO.limb, toon(dark)); shin.scale.set(1.15, 0.2, 1.15); shin.position.y = -0.1; knee.add(shin);
      const sock = mesh(GEO.sock, toon(dark)); sock.position.y = -0.19; knee.add(sock);
      const shoe = outline(mesh(GEO.ball, toon(BLACK))); shoe.scale.set(0.095, 0.065, 0.15); shoe.position.set(0, -SHIN + 0.03, 0.04); knee.add(shoe);
      hip.userData.s = s;
      this.hips.push(hip); this.knees.push(knee);
    }
    this.shoulders = []; this.elbows = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.31, 0.5, 0); torso.add(sh);
      const sl = mesh(GEO.sleeve, toon(teamColor)); sl.position.y = -0.04; sh.add(sl);
      const up = mesh(GEO.limb, toon(look.skin)); up.scale.set(1, ARM - 0.01, 1); up.position.y = -(ARM - 0.01) / 2; sh.add(up);
      const el = new THREE.Group(); el.position.y = -ARM; sh.add(el);
      const fo = mesh(GEO.limb, toon(look.skin)); fo.scale.set(0.95, ARM - 0.03, 0.95); fo.position.y = -(ARM - 0.03) / 2; el.add(fo);
      const hand = outline(mesh(GEO.ball, toon(look.skin)), 1.12); hand.scale.setScalar(0.09); hand.position.y = -ARM; el.add(hand);
      sh.userData.s = s;
      this.shoulders.push(sh); this.elbows.push(el);
    }
    // guante en la mano izquierda
    this.glove = outline(mesh(GEO.ball, toon(look.glove)), 1.1); this.glove.scale.set(0.13, 0.15, 0.09); this.glove.position.set(0, -ARM - 0.03, 0.04);
    this.elbows[1].add(this.glove);
    const head = (this.head = new THREE.Group()); head.position.y = 0.97; torso.add(head);
    const skull = outline(mesh(GEO.head, toon(look.skin)), 1.05); skull.scale.set(1, 0.95, 0.95); head.add(skull);
    for (const s of [-1, 1]) { const ear = mesh(GEO.ball, toon(look.skin)); ear.scale.set(0.08, 0.1, 0.06); ear.position.set(s * 0.39, -0.02, 0); head.add(ear); }
    const nose = mesh(GEO.ball, toon(look.skin), false); nose.scale.set(0.05, 0.04, 0.04); nose.position.set(0, -0.06, 0.39); head.add(nose);
    this.eyes = []; this.pupils = [];
    for (const s of [-1, 1]) {
      const eye = mesh(GEO.ball, toon('#ffffff'), false); eye.scale.set(0.085, 0.115, 0.05); eye.position.set(s * 0.14, 0.04, 0.345); head.add(eye);
      const pup = mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: 0x1d2340 }), false); pup.scale.set(0.045, 0.06, 0.03); pup.position.set(s * 0.14, 0.03, 0.385); head.add(pup);
      const hl = mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: 0xffffff }), false); hl.scale.set(0.32, 0.26, 0.4); hl.position.set(0.35, 0.35, 0.8); pup.add(hl);
      const brow = mesh(GEO.box, new THREE.MeshBasicMaterial({ color: look.hair === 'bald' ? 0x6b3e1f : look.hairColor }), false); brow.scale.set(0.12, 0.025, 0.02); brow.position.set(s * 0.14, 0.2, 0.36); brow.rotation.z = s * -0.12; head.add(brow);
      this.eyes.push(eye); this.pupils.push(pup);
    }
    this.mouth = mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: 0x7a2335 }), false);
    this.mouth.scale.set(0.06, 0.025, 0.02); this.mouth.position.set(0, -0.16, 0.365); head.add(this.mouth);
    buildHair(head, look);
    // gorra del equipo y casco de bateo
    this.cap = new THREE.Group(); head.add(this.cap);
    { const c = outline(mesh(GEO.hat, toon(teamColor))); c.rotation.x = -0.2; c.position.y = 0.05; this.cap.add(c);
      const b = outline(mesh(GEO.brim, toon(teamColor))); b.position.set(0, 0.17, 0.32); b.rotation.x = 0.12; b.scale.set(1, 1, 1.35); this.cap.add(b);
      const btn = mesh(GEO.ball, toon('#ffffff'), false); btn.scale.setScalar(0.04); btn.position.set(0, 0.47, -0.06); this.cap.add(btn); }
    this.helmet = new THREE.Group(); head.add(this.helmet);
    { const hm = toon(dark, { emissive: 0x111122 });
      const c = outline(mesh(GEO.helmet, hm)); c.rotation.x = -0.3; c.position.y = 0.03; this.helmet.add(c);
      const b = outline(mesh(GEO.brim, hm)); b.position.set(0, 0.19, 0.37); b.rotation.x = 0.05; b.scale.set(1.05, 1, 1.05); this.helmet.add(b);
      const flap = outline(mesh(GEO.ball, hm)); flap.scale.set(0.06, 0.19, 0.15); flap.position.set(0.43, -0.06, 0.0); this.helmet.add(flap);
      const shine = mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }), false); shine.scale.set(0.12, 0.05, 0.05); shine.position.set(-0.14, 0.36, 0.22); shine.rotation.z = 0.5; this.helmet.add(shine); }
    buildAcc(this, look);
    // bate (se coloca en el marco del torso)
    this.bat = new THREE.Group(); torso.add(this.bat);
    { const bm = mesh(BAT_GEO, toon(look.bat)); bm.scale.set(1.35, 1.3, 1.35); this.bat.add(bm);
      const o = new THREE.Mesh(BAT_GEO, outlineMat); o.userData.ol = true; o.visible = OUTLINES; o.scale.set(1.35, 1.012, 1.35); o.position.y = -0.005; bm.add(o); }
    // solo las piezas grandes proyectan sombra
    this.root.traverse((o) => { o.castShadow = false; });
    tm.castShadow = true; skull.castShadow = true; shorts.castShadow = true;
    this.blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT);
    this.blob.rotation.x = -Math.PI / 2;
    this.root.add(this.blob);
    scene.add(this.root);
    this.setGear('field');
    this.blinkT = rand(1, 4);
    this.ph = rand(0, 6);
    this.lastY = 0; this.squash = 0; this.prevSpeed = 0; this.dustT = 0;
    this.clock = 0; this.vLoc = 0; this.wLoc = 0; this.wL = 0; this.shufW = 0; this.legYaw = 0; this.gaitDir = 1;
    this.mvF = 1; this.mvL = 0; this.eF = 1; this.eL = 0; this.px = undefined; this.pz = 0; this.footSign = [1, 1]; this.twistD = 0; this.rigY = 0;
    this.snapYaw = false; this.gear = 'field';
  }
  dispose() { scene.remove(this.root); }
  // el receptor se vuelve transparente cuando la cámara está detrás de él
  ghostify() {
    if (this.ghostMats) return;
    this.ghostMats = [];
    this.root.traverse((o) => {
      if (!o.isMesh || o === this.foot || o === this.blob) return;
      o.material = o.material.clone();
      this.ghostMats.push({ m: o.material, ol: !!o.userData.ol });
    });
  }
  setGhost(a) {
    if (!this.ghostMats || this.ghostA === a) return;
    this.ghostA = a;
    for (const g of this.ghostMats) { g.m.transparent = a < 1; g.m.opacity = g.ol ? (a < 1 ? 0 : 1) : a; g.m.depthWrite = a >= 1; g.m.needsUpdate = true; }
  }
  setGear(mode) {
    if (this.gear === mode) return;
    this.gear = mode;
    this.bat.visible = mode === 'bat';
    this.helmet.visible = mode === 'bat' || mode === 'run';
    this.cap.visible = !this.helmet.visible;
    this.glove.visible = mode === 'field';
  }
  handPos(i, out) {
    this.root.updateMatrixWorld(true);
    return this.elbows[i].localToWorld(out.set(0, -ARM - 0.03, i === 1 ? 0.08 : 0.02));
  }

  // ---------- capa base: cuánto y hacia dónde se mueve de verdad ----------
  trackMotion(st, dt, dyaw) {
    let dist = 0;
    if (this.px !== undefined) {
      const dx = st.x - this.px, dz = st.z - this.pz;
      dist = Math.hypot(dx, dz);
      if (dist > 1.0) { dist = 0; dyaw = 0; }
      else if (dist > 1e-4) {
        const ry = this.root.rotation.y;
        this.mvF = (dx * Math.sin(ry) + dz * Math.cos(ry)) / dist;
        this.mvL = (dx * Math.cos(ry) - dz * Math.sin(ry)) / dist;
      }
    } else dyaw = 0;
    this.px = st.x; this.pz = st.z;
    const kE = 1 - Math.exp(-12 * dt);
    this.eF += (this.mvF - this.eF) * kE; this.eL += (this.mvL - this.eL) * kE;
    const idt = 1 / Math.max(dt, 1e-4);
    this.vLoc = damp(this.vLoc, Math.min(dist * idt, 9), 12, dt);
    const turnV = Math.min(dyaw * idt * 0.18, 2);
    this.wLoc = damp(this.wLoc, SM((Math.max(this.vLoc, turnV) - 0.15) / 0.75), 10, dt);
    const v = this.vLoc;
    const lateral = Math.abs(this.mvL) > Math.abs(this.mvF) * 1.1;
    const shuffle = lateral && v < 2.6;
    this.shufW = damp(this.shufW, shuffle ? 1 : 0, 10, dt);
    const mvAng = Math.atan2(this.mvL, this.mvF);
    let yawT = 0;
    if (!shuffle) yawT = (Math.abs(mvAng) <= Math.PI / 2 + 0.35 ? clamp(mvAng, -1.2, 1.2) : clamp(wrapA(mvAng + Math.PI), -1.0, 1.0)) * (lateral ? 1 : 0.6);
    this.legYaw = damp(this.legYaw, yawT * this.wLoc, 8, dt);
    this.gaitDir = Math.cos(mvAng - this.legYaw) >= -0.2 ? 1 : -1;
    const step = dist + dyaw * 0.18;
    const L = clamp(0.28 + 0.08 * v, 0.28, 0.78), Ls = clamp(0.36 + 0.1 * v, 0.4, 0.62);
    this.ph += lerp((step / L) * Math.PI, (step / Ls) * 2 * Math.PI, this.shufW);
  }
  gait(ready) {
    const v = this.vLoc, fast = SM(v / 5);
    const L = clamp(0.28 + 0.08 * v, 0.28, 0.78);
    const KS = 0.18, MX = THIGH + SHIN * Math.cos(KS), MY = SHIN * Math.sin(KS), ML = Math.hypot(MX, MY), DL = Math.atan2(MY, MX);
    const cy = Math.cos(this.legYaw), sy = Math.sin(this.legYaw);
    const ef = this.eF * cy + this.eL * sy, el = this.eL * cy - this.eF * sy;
    const Gp = {
      hx: [0, 0], kn: [0, 0], hz: [0, 0], sx: [0, 0], sin: [0.05, 0.05], el: [-1.1 - 0.3 * fast, -1.1 - 0.3 * fast],
      lean: 0.1 + 0.22 * fast * this.gaitDir, twist: 0, leanZ: 0, headX: -0.15, mouth: 0.03, rigX: 0, bounce: 0.04 * fast * Math.abs(Math.sin(this.ph)),
    };
    for (let i = 0; i < 2; i++) {
      const ph = this.ph + i * Math.PI;
      const u = ((ph % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const xf = u < Math.PI ? (L / 2) * (1 - 2 * u / Math.PI) : -(L / 2) * Math.cos(Math.PI * SM((u - Math.PI) / Math.PI));
      const hz = Math.asin(clamp(xf * el / ML, -0.6, 0.6));
      Gp.hz[i] = hz;
      Gp.hx[i] = -Math.asin(clamp(xf * ef / (ML * Math.cos(hz)), -0.9, 0.9)) - DL;
      Gp.kn[i] = KS + Math.max(0, -Math.sin(ph)) * (0.8 + 0.6 * fast);
      Gp.sx[i] = -0.25 - Gp.hx[i] * (0.7 + 0.3 * fast);
    }
    const sw = this.shufW;
    if (sw > 0.01) {
      const sg = this.mvL >= 0 ? 1 : -1, lead = sg > 0 ? 1 : 0;
      const u = (((this.ph / (Math.PI * 2)) % 1) + 1) % 1;
      const Ls = clamp(0.36 + 0.1 * v, 0.4, 0.62), w0 = 0.07 + Ls / 4;
      let offLead, offTrail, liftLead = 0, liftTrail = 0;
      if (u < 0.5) { const s = u / 0.5; offLead = Ls * (-0.25 + 0.5 * SM(s)); offTrail = Ls * (0.25 - 0.5 * s); liftLead = Math.sin(Math.PI * s); }
      else { const s = (u - 0.5) / 0.5; offLead = Ls * (0.25 - 0.5 * s); offTrail = Ls * (-0.25 + 0.5 * SM(s)); liftTrail = Math.sin(Math.PI * s); }
      const eN = Math.max(0.3, Math.hypot(this.eF, this.eL)), eLn = Math.abs(this.eL) / eN, eFn = this.eF / eN;
      for (let i = 0; i < 2; i++) {
        const isLead = i === lead, q = isLead ? offLead : offTrail;
        const footX = sg * ((isLead ? w0 : -w0) + q * eLn), footZ = q * eFn, hipX = i ? 0.12 : -0.12, lift = isLead ? liftLead : liftTrail;
        const hz = Math.asin(clamp((footX - hipX) / 0.5, -0.7, 0.7));
        Gp.hz[i] = lerp(Gp.hz[i], hz, sw);
        Gp.kn[i] = lerp(Gp.kn[i], 0.8 + lift * 0.55, sw);
        Gp.hx[i] = lerp(Gp.hx[i], -0.4 - lift * 0.25 - Math.asin(clamp(footZ / 0.5, -0.6, 0.6)), sw);
        Gp.sx[i] = lerp(Gp.sx[i], ready ? -0.55 : -0.2, sw);
        Gp.el[i] = lerp(Gp.el[i], ready ? -1.0 : -0.5, sw);
      }
      Gp.lean = lerp(Gp.lean, 0.28, sw);
      Gp.bounce = lerp(Gp.bounce, 0.03 * Math.abs(Math.sin(this.ph)), sw);
    }
    return Gp;
  }

  // ---------- pose objetivo: base + acción ----------
  pose(st, ctx) {
    const air = st.y > 0.04;
    const a = st.anim, t = st.animT || 0;
    const B = {
      lean: 0.05, leanZ: 0, twist: 0, rigX: 0, bounce: 0, headX: 0, mouth: 0.025,
      sx: [-0.05, -0.05], sin: [-0.12, -0.12], el: [-0.25, -0.25], hx: [0, 0], hz: [0, 0], kn: [0.05, 0.05],
    };
    const crouch = (P, c) => { P.hx = [-c, -c]; P.kn = [2 * c, 2 * c]; };
    if (air) {
      B.hx = [-0.35, 0.15]; B.kn = [0.9, 0.7];
      B.sx = [-1.3, -2.9]; B.el = [-0.5, -0.15]; B.sin = [-0.15, -0.15];
    } else {
      if (ctx.ready) { crouch(B, 0.36); B.lean = 0.42; B.headX = -0.2; B.sx = [-0.7, -0.95]; B.sin = [0.12, 0.12]; B.el = [-0.8, -0.55]; B.hz = [-0.16, 0.16]; }
      else crouch(B, 0.06);
      if (this.wLoc > 0.001) mixPose(B, this.gait(ctx.ready), this.wLoc, this.wLoc);
    }
    const T = copyPose(B);
    this.wL = 0;
    const def = ACT[a];
    if (def) {
      const keys = def.keys;
      const A = copyPose(B);
      keyPose(keys, t, A);
      const k0 = keys[0].t;
      let wA = k0 < 0 ? SM((t - k0) / 0.08) : def.bi ? SM(t / def.bi) : 1;
      const holdAir = air && def.legs === 'own';
      if (def.bo && !holdAir) wA *= 1 - SM((t - (def.D - def.bo)) / def.bo);
      if (t > def.D && !holdAir) wA = 0;
      const own = def.legs === 'own';
      let wL;
      if (air && !own) wL = 0;
      else if (own) wL = wA;
      else wL = wA * (1 - this.wLoc);
      mixPose(T, A, wA, wL);
      this.wL = wL;
    } else if (a === 'dive') {
      Object.assign(T, { rigX: 1.3, lean: 0, headX: -1.0, sx: [-2.95, -2.95], sin: [0.2, 0.2], el: [0, 0], hx: [0.2, 0.25], kn: [0.35, 0.2], hz: [0, 0], mouth: 0.05, bounce: 0 });
      this.wL = 1;
    } else if (a === 'lie') {
      const k = SM((t - 0.12) / 0.38);
      crouch(T, lerp(0.2, 0.55, k));
      Object.assign(T, { rigX: lerp(1.35, 0, k), lean: lerp(0, 0.5, k), headX: lerp(-1, -0.2, k), hz: [0, 0], bounce: 0 });
      T.sx = [lerp(-2.9, -0.7, k), lerp(-2.9, -0.7, k)]; T.el = [lerp(0, -0.6, k), lerp(0, -0.6, k)];
      this.wL = 1;
    } else if (a === 'slide') {
      Object.assign(T, { rigX: -1.15, lean: -0.25, headX: 0.55, sx: [-2.5, -2.4], sin: [-0.4, -0.4], el: [-0.4, -0.4], hx: [-1.35, -0.95], kn: [0.12, 1.05], hz: [0, 0], bounce: 0, mouth: 0.05 });
      this.wL = 1;
    } else if (a === 'cheer' || a === 'sad') {
      const A = copyPose(B);
      if (a === 'cheer') this.cheerPose(A, t); else this.sadPose(A);
      const wL = 1 - this.wLoc;
      mixPose(T, A, 1, wL);
      if (A.flip && this.wLoc < 0.1) T.flip = true;
      this.wL = wL;
    }
    return T;
  }
  cheerPose(A, t) {
    const w = Math.sin(t * 13);
    A.hx = [-0.12, -0.12]; A.kn = [0.24, 0.24];
    A.bounce = Math.abs(Math.sin(t * 6.5)) * 0.22;
    if (this.cel === 'salto') { A.bounce = Math.max(0, Math.sin(t * 5)) * 0.55; A.sx = [-2.9, -2.9]; A.sin = [-0.6, -0.6]; A.el = [-0.1, -0.1]; A.hx = [-0.5, -0.5]; A.kn = [1.0, 1.0]; }
    else if (this.cel === 'aplauso') { A.sx = [-1.35, -1.35]; A.el = [-0.7, -0.7]; A.sin = [0.25 + w * 0.2, 0.25 + w * 0.2]; A.bounce *= 0.4; }
    else if (this.cel === 'baile') {
      const s8 = Math.sin(t * 8);
      A.twist = s8 * 0.5; A.leanZ = s8 * 0.15; A.sx = [-2.4 + s8 * 0.9, -2.4 - s8 * 0.9]; A.el = [-0.7, -0.7]; A.sin = [-0.3, -0.3];
      A.hz = [-0.15, 0.15]; A.bounce = Math.abs(Math.cos(t * 8)) * 0.08;
    } else if (this.cel === 'voltereta') { A.flip = true; A.sx = [-2.9, -2.9]; A.sin = [-0.5, -0.5]; A.el = [0, 0]; A.bounce = 0; }
    else if (this.cel === 'campeon') {
      const cross = (t % 3) < 1.6;
      A.sx = cross ? [-1.25, -1.25] : [-0.3, -3.05]; A.sin = cross ? [0.95, 0.95] : [-0.1, 0.05]; A.el = cross ? [-1.95, -1.95] : [-0.3, 0];
      A.lean = -0.12; A.bounce = 0.02;
    } else { A.sx = [-2.95, -2.95]; A.el = [-1.1 + w * 0.6, -1.1 - w * 0.6]; A.sin = [-0.35, -0.35]; }
    A.mouth = 0.075; A.headX = this.cel === 'campeon' ? -0.35 : -0.3;
  }
  sadPose(A) {
    if (this.variant === 1) { A.hx = [-0.08, -0.08]; A.kn = [0.16, 0.16]; A.sx = [-2.7, -2.7]; A.el = [-2.3, -2.3]; A.sin = [0.25, 0.25]; A.headX = 0.25; }
    else { A.hx = [-0.5, -0.5]; A.kn = [1.0, 1.0]; A.lean = 0.8; A.sx = [-0.75, -0.75]; A.el = [-0.15, -0.15]; A.sin = [0.02, 0.02]; A.headX = 0.1; }
    A.mouth = 0.015;
  }

  // bate en las manos (postura, swing y toque); las manos van al mango con IK
  batPose(st) {
    const a = st.anim, t = st.animT || 0;
    _bH.set(-0.21, 0.7, 0.06); _bD.set(-0.24, 0.93, -0.28).normalize();
    let w = 0, th = 0, e = 0;
    if (a === 'swing') {
      const ks = SWING_KEYS;
      let i = 0;
      while (i < ks.length - 2 && t > ks[i + 1][0]) i++;
      const k0 = ks[i], k1 = ks[i + 1], u = clamp((t - k0[0]) / (k1[0] - k0[0]), 0, 1);
      const uu = i === 1 ? u * u : SM(u);
      th = lerp(k0[1], k1[1], uu); e = lerp(k0[2], k1[2], uu);
      w = SM(t / 0.04) * (1 - SM((t - 0.72) / 0.22));
    } else if (a === 'bunt') { th = Math.PI / 2; e = 0.08; w = SM(t / 0.12); }
    if (w > 0.001) {
      const tt = th - this.twistD, ce = Math.cos(e);
      _v1.set(-Math.cos(tt) * ce, Math.sin(e), Math.sin(tt) * ce);
      if (a === 'bunt') { const ha = tt - 1.35; _v2.set(0.02 - Math.cos(ha) * 0.2, 0.5, 0.22 + Math.sin(ha) * 0.2); }
      else { const ha = tt - 1.1; _v2.set(0.04 - Math.cos(ha) * 0.17, 0.42 + Math.max(0, e) * 0.15, 0.16 + Math.sin(ha) * 0.17); }
      _bH.lerp(_v2, w);
      _bD.lerp(_v1, w).normalize();
    }
    this.bat.position.copy(_bH);
    this.bat.quaternion.setFromUnitVectors(_yUp, _bD);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1, off = i === 0 ? 0.13 : 0.04;
      if (!solveArm(_bH.x + _bD.x * off, _bH.y + _bD.y * off, _bH.z + _bD.z * off, s, _ik)) continue;
      this.shoulders[i].rotation.x = _ik.sx; this.shoulders[i].rotation.z = _ik.rz; this.elbows[i].rotation.x = _ik.el;
    }
  }
  // el guante busca la pelota
  reachArm(R) {
    this.root.updateMatrixWorld(true);
    const P = this.torso.worldToLocal(_ckV.set(R.x, R.y, R.z));
    if (!solveArm(P.x, P.y, P.z, 1, _ik)) return;
    const w = clamp(R.w, 0, 1), sh = this.shoulders[1], el = this.elbows[1];
    sh.rotation.x += wrapA(_ik.sx - sh.rotation.x) * w;
    sh.rotation.z += wrapA(_ik.rz - sh.rotation.z) * w;
    el.rotation.x += (_ik.el - el.rotation.x) * w;
  }

  update(dt, st, lookX, lookY, lookZ, ctx = {}) {
    const r = this.root;
    this.clock += dt;
    const gy = groundY(st.x, st.z);
    r.position.set(st.x, st.y + gy, st.z);
    const prevYaw = r.rotation.y;
    if (this.snapYaw) { r.rotation.y = st.ry; this.snapYaw = false; this.px = undefined; }
    else r.rotation.y = angDamp(r.rotation.y, st.ry, 14, dt);
    this.trackMotion(st, dt, Math.abs(wrapA(r.rotation.y - prevYaw)));
    this.foot.position.y = -st.y + 0.025;
    this.blob.visible = !renderer.shadowMap.enabled;
    if (this.blob.visible) { this.blob.position.y = -st.y + 0.018; this.blob.scale.setScalar(Math.max(0.5, 1 - st.y * 0.25)); }
    this.foot.material.opacity = st.y > 0.05 ? 0.4 : ctx.me ? 0.95 : 0.7;
    const T = this.pose(st, ctx);
    const fast = st.anim === 'swing' || st.anim === 'pitch' || st.anim === 'throw';
    const K = fast ? 34 : 20, KL = (fast ? 34 : 20) + 40 * this.wLoc * (1 - this.wL);
    for (let i = 0; i < 2; i++) {
      const hip = this.hips[i], kn = this.knees[i];
      hip.rotation.x = damp(hip.rotation.x, T.hx[i], KL, dt);
      hip.rotation.z = damp(hip.rotation.z, T.hz[i], KL, dt);
      kn.rotation.x = damp(kn.rotation.x, T.kn[i], KL, dt);
      const sh = this.shoulders[i], s = sh.userData.s;
      sh.rotation.x = damp(sh.rotation.x, T.sx[i], K, dt);
      sh.rotation.z = damp(sh.rotation.z, -s * T.sin[i], K, dt);
      this.elbows[i].rotation.x = damp(this.elbows[i].rotation.x, T.el[i], K, dt);
    }
    const air = st.y > 0.04;
    let support = 0.55;
    if (!air) {
      const hL = legH(this.hips[0].rotation.x, this.knees[0].rotation.x) * Math.cos(this.hips[0].rotation.z);
      const hR = legH(this.hips[1].rotation.x, this.knees[1].rotation.x) * Math.cos(this.hips[1].rotation.z);
      support = Math.max(hL, hR) + 0.02;
    }
    this.pelvis.position.y = damp(this.pelvis.position.y, support + T.bounce, 22 + 30 * this.wLoc, dt);
    this.pelvis.rotation.y = damp(this.pelvis.rotation.y, this.legYaw, 10, dt);
    const KT = fast ? 40 : 14;
    this.twistD = damp(this.twistD, T.twist, KT, dt);
    this.torso.rotation.y = this.twistD - this.pelvis.rotation.y;
    this.torso.rotation.x = damp(this.torso.rotation.x, T.lean, KT, dt);
    this.torso.rotation.z = damp(this.torso.rotation.z, T.leanZ, fast ? KT : 10, dt);
    this.rig.rotation.x = damp(this.rig.rotation.x, T.rigX, 12, dt);
    this.rigY = damp(this.rigY, Math.abs(T.rigX) > 0.5 ? -0.3 : 0, 12, dt);
    let rigZ = 0, rigY = this.rigY;
    if (T.flip && !air) {
      const cyc = (st.animT || 0) % 1.7;
      if (cyc < 0.85) {
        const k = cyc / 0.85, th = -k * Math.PI * 2;
        this.rig.rotation.x = th;
        rigY = Math.sin(k * Math.PI) * 1.0 + 0.7 * (1 - Math.cos(th));
        rigZ = -0.7 * Math.sin(th);
        this.knees.forEach((kk) => { kk.rotation.x = 1.6; }); this.hips.forEach((h) => { h.rotation.x = -1.2; });
      } else this.rig.rotation.x = 0;
    }
    this.rig.position.set(0, rigY, rigZ);
    if (BAT_ANIM[st.anim]) this.batPose(st);
    else if (ctx.reach) this.reachArm(ctx.reach);
    this.mouth.scale.y = damp(this.mouth.scale.y, T.mouth, 14, dt);
    const vy = (st.y - this.lastY) / Math.max(dt, 1e-3);
    if (this.lastY > 0.04 && st.y <= 0.04) this.squash = 0.12;
    this.lastY = st.y;
    this.squash = Math.max(0, this.squash - dt * 0.9);
    const stretch = air ? clamp(vy * 0.008, -0.03, 0.06) : 0;
    r.scale.set(1 + this.squash * 0.6, 1 - this.squash + stretch, 1 + this.squash * 0.6);
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 0.15 : 1;
    if (this.blinkT < 0) this.blinkT = rand(2, 5);
    for (const e of this.eyes) e.scale.y = 0.115 * blink;
    if (lookX !== undefined) {
      const hm = ctx.headMax || 1.1;
      const d = wrapA(Math.atan2(lookX - st.x, lookZ - st.z) - r.rotation.y);
      this.head.rotation.y = damp(this.head.rotation.y, clamp(d, -hm, hm) * 0.8 - this.torso.rotation.y - this.pelvis.rotation.y, 10, dt);
      const up = Math.atan2(lookY - (st.y + 1.5), Math.hypot(lookX - st.x, lookZ - st.z));
      this.head.rotation.x = damp(this.head.rotation.x, clamp(T.headX - up * 0.5 - this.torso.rotation.x * 0.6, -1.2, 0.6), 10, dt);
      const v = _lookV.set(lookX, lookY, lookZ);
      this.root.updateMatrixWorld(true);
      this.head.worldToLocal(v);
      v.normalize();
      this.pupils.forEach((p, i) => {
        p.position.x = (i ? 0.14 : -0.14) + clamp(v.x, -1, 1) * 0.035;
        p.position.y = 0.03 + clamp(v.y, -1, 1) * 0.04;
        p.scale.y = 0.06 * blink;
      });
    }
    if (!air && ctx.dust !== false) {
      for (let i = 0; i < 2; i++) {
        const sg = Math.sin(this.ph + i * Math.PI) > 0 ? 1 : -1;
        if (sg > 0 && this.footSign[i] < 0 && this.vLoc > 3.2 && this.shufW < 0.5) {
          const fs = i ? 1 : -1;
          puff(st.x + Math.cos(r.rotation.y) * 0.12 * fs, 0, st.z - Math.sin(r.rotation.y) * 0.12 * fs, this.vLoc > 5.5 ? 3 : 2, DUST, 0.32 + this.vLoc * 0.03, 0.8, 0.5);
        }
        this.footSign[i] = sg;
      }
      this.skidT = (this.skidT || 0) - dt;
      if (this.skidT <= 0 && this.prevSpeed > 4 && this.vLoc < this.prevSpeed - 2.6) { puff(st.x, 0, st.z, 6, DUST, 0.45, 2.2, 0.6); this.skidT = 0.4; }
      this.dustT -= dt;
      if ((st.anim === 'dive' || st.anim === 'slide') && this.dustT <= 0) { this.dustT = 0.04; puff(st.x, 0, st.z, 2, DUST, 0.5, 1.4, 0.7); }
    }
    this.prevSpeed = damp(this.prevSpeed, this.vLoc, 8, dt);
  }
}

// etiquetas con nombre (DOM)
const tagLayer = $('#tags');
function makeTag(p, isMe) {
  const d = document.createElement('div');
  d.className = 'tag' + (isMe ? ' me' : '');
  const short = isMe ? p.name : String(p.name).split(' ')[0];
  d.innerHTML = `<span class="dot" style="background:${TEAM_CSS[p.team]}"></span><span class="nm">${escapeHtml(short)}</span>`;
  tagLayer.appendChild(d);
  return d;
}
const _v3 = new THREE.Vector3(), _tagV = new THREE.Vector3();
function worldToScreen(x, y, z) {
  _v3.set(x, y, z).project(camera);
  return { x: (_v3.x * 0.5 + 0.5) * innerWidth, y: (-_v3.y * 0.5 + 0.5) * innerHeight, vis: _v3.z < 1 && Math.abs(_v3.x) < 1.2 && Math.abs(_v3.y) < 1.2 };
}

// =========================================================
//  SIMULACIÓN DEL PARTIDO
// =========================================================
const S = { on: false, events: [], cmds: [], runners: [], teams: [[], []], players: [], clock: 0, inp: [{ mx: 0, mz: 0 }, { mx: 0, mz: 0 }], ctl: [false, false], remote: [false, false], me: -1, throwMode: ['auto', 'auto'] };
const HUMAN_D = { fieldV: 1, react: 0.28, throwV: 1 }; // defensores de una persona (los mueve la PC si no los toca)
function emit(type, d) { S.events.push(Object.assign({ type }, d || {})); }
const batTeam = () => S.half;
const fieldTeam = () => 1 - S.half;
const fielders = () => S.teams[1 - S.half];
const byRole = (role) => S.teams[1 - S.half].find((p) => p.role === role);
const byId = (id) => S.players[id];
// quién controla cada equipo (simulación): una persona (en este dispositivo o en línea) o la PC
const tH = (t) => !!S.ctl[t];
const batH = () => tH(S.half);
const fldH = () => tH(1 - S.half) && !S.derby;
// el jugador de ESTE dispositivo (interfaz)
const humanBats = () => S.me >= 0 && S.me === S.half;
const humanFields = () => S.me >= 0 && S.me === 1 - S.half && !S.derby;
const fD = () => (fldH() ? HUMAN_D : S.D);
const live = (r) => !r.out && !r.scored;
const onBase = (r) => Math.abs(r.p - Math.round(r.p)) < 1e-4;
const standing = (r) => Math.abs(r.p - r.target) < 1e-6 && onBase(r);
function runnerPos(r, out = {}) {
  const k = clamp(Math.floor(r.p + 1e-9), 0, 3), f = clamp(r.p - k, 0, 1);
  const A = BASES[k], B = BASES[k + 1];
  out.x = lerp(A.x, B.x, f); out.z = lerp(A.z, B.z, f);
  if (r.isBatter && r.p < 0.3) { const k2 = r.p / 0.3; out.x = lerp(BOX.x, BASES[1].x * 0.3, k2); out.z = lerp(BOX.z, BASES[1].z * 0.3, k2); }
  return out;
}
function cpuName(used) {
  const pool = CPU_NAMES.filter((n) => !used.has(n));
  const n = pool.length ? pick(pool) : 'Jugador ' + randi(10, 99);
  used.add(n);
  return n;
}
function makePlayer(id, team, name, look, cpu, role) {
  return {
    id, team, name, look, cpu, role, x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, ry: 0, anim: 'idle', animT: 0,
    hx: 0, hz: 0, goalX: 0, goalZ: 0, goalSp: 0, manual: false, mx: 0, mz: 0, snap: true,
    diveT: 0, lieT: 0, throwT: 0, throwBase: 0, throwRy: 0, plan: null, replanAt: 0, canThrowAt: 0, holdT0: 0,
    spd: rand(0.94, 1.06), arm: rand(0.92, 1.08), pow: rand(0.92, 1.08),
    stats: { ab: 0, h: 0, hr: 0, rbi: 0, r: 0, k: 0, bb: 0, pk: 0 },
  };
}
function makeRunner(pl, base, isBatter) {
  const cpuK = !tH(pl.team) && S.ctl.some(Boolean) ? [0.93, 1, 1.04][S.settings.diff] || 1 : 1;
  return { pl, p: base, base, base0: base, target: base, forced: -1, fdone: true, isBatter: !!isBatter, out: false, scored: false, manual: false, stay: false, startT: 0, decideAt: 0, speed: RUN_V * pl.spd * cpuK, slideT: 0, scoreT: 0, steal: false };
}
// opts: { settings, demo, derby, online, ctl: [bool, bool], remote: [bool, bool], me, captains: [{name, look} | null, …], throwMode: [..] }
function newGame(opts) {
  const set = opts.settings;
  const ctl = opts.ctl || (opts.demo ? [false, false] : [true, false]);
  Object.assign(S, {
    on: true, demo: !!opts.demo, derby: !!opts.derby, online: !!opts.online, net: opts.net || '', settings: set, D: DIFF[set.diff] || DIFF[1],
    ctl, remote: opts.remote || [false, false], me: opts.me ?? (opts.demo ? -1 : 0), throwMode: opts.throwMode || [SAVE.throwMode || 'manual', 'auto'],
    innings: set.innings, score: [0, 0], line: [[], []], hits: [0, 0], inning: 1, half: 0,
    outs: 0, balls: 0, strikes: 0, batIdx: [0, 0], runners: [], events: [], cmds: [], clock: 0,
    phase: 'none', t: 0, ended: false, derbyHr: 0, derbyOuts: 0, derbyLong: 0, derbyMax: 10, derbyN: 0,
    swing: null, pitch: null, batted: false, chase: null, ctrlId: -1, hr: false, walk: false, playRuns: [], cov: {}, humanActT: 0,
    inp: [{ mx: 0, mz: 0 }, { mx: 0, mz: 0 }], queued: null, stealPlay: false,
  });
  S.teams = [[], []]; S.players = [];
  const caps = opts.captains || [opts.demo ? null : { name: SAVE.name, look: SAVE.look }, null];
  const used = new Set(caps.filter(Boolean).map((c) => c.name));
  const R = Array.isArray(opts.roster) ? opts.roster : null; // alineación que manda el anfitrión (invitado)
  let id = 0;
  for (let team = 0; team < 2; team++) for (let i = 0; i < 9; i++) {
    const rr = R ? R[id] || {} : null;
    const cap = rr ? (rr.c ? { name: String(rr.n || 'Amigo').slice(0, 12), look: sanitizeLook(rr.l) } : null) : i === 0 ? caps[team] : null;
    const p = makePlayer(id++, team, rr ? String(rr.n || 'Jugador').slice(0, 14) : cap ? cap.name : cpuName(used), rr ? sanitizeLook(rr.l) : cap ? cap.look : randomLook(), !cap, ROLES[i]);
    p.order = i;
    if (cap) { p.pow = 1.04; p.spd = 1.04; p.arm = 1.05; p.captain = true; }
    S.teams[team].push(p); S.players.push(p);
  }
  S.avatarId = S.me >= 0 ? S.teams[S.me][0].id : -1;
  S.ball = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, st: 'held', holder: null, bounced: false, wall: false, batted: false, thrown: false, noCatchT: 0, noCatchT2: 0, outOfPark: false, fromId: -1, tgtBase: -1, b0x: 0, b0z: 0, side: false };
  enterPhase('pre');
}
function enterPhase(ph, kind) {
  S.phase = ph; S.t = 0;
  if (ph === 'pre') onPre();
  else if (ph === 'pitch') onPitch();
  else if (ph === 'dead') { S.deadKind = kind || 'pitch'; S.retBall = null; }
  else if (ph === 'switch') onSwitch();
}
function onPre() {
  Object.assign(S, { outs: 0, balls: 0, strikes: 0, runners: [], halfRuns: 0, capHit: false, walkoff: false });
  if (!S.derby) S.line[batTeam()][S.inning - 1] = 0;
  for (const p of S.players) p.anim = 'idle';
  placeFielders(true);
  setupBatter();
  emit('half');
}
function placeFielders(snap) {
  for (const f of fielders()) {
    const p = POS[f.role];
    f.hx = p[0]; f.hz = p[1];
    if (snap) { f.x = p[0]; f.z = p[1]; f.vx = f.vz = 0; f.snap = true; }
    f.goalX = f.hx; f.goalZ = f.hz;
    f.y = 0; f.vy = 0; f.diveT = f.lieT = f.throwT = 0; f.plan = null; f.manual = false;
    f.ry = f.role === 'C' ? Math.PI : Math.atan2(-f.x, -f.z);
    f.anim = f.role === 'C' ? 'squat' : 'idle'; f.animT = 0;
  }
}
function setupBatter() {
  const bt = batTeam();
  const b = S.teams[bt][S.batIdx[bt] % 9];
  S.batter = b;
  Object.assign(b, { x: BOX.x, z: BOX.z, y: 0, vx: 0, vz: 0, ry: Math.PI / 2, anim: 'stance', animT: 0, snap: true });
  ballToPitcher();
}
function ballToPitcher() {
  const b = S.ball;
  Object.assign(b, { st: 'held', holder: byRole('P'), vx: 0, vy: 0, vz: 0, outOfPark: false, bounced: false, wall: false, batted: false, thrown: false, side: false });
}
function onPitch() {
  Object.assign(S, { pitch: null, swing: null, contactDone: false, judged: false, cpuSwingAt: 0, batted: false, hr: false, walk: false, pend: null, flyOut: false, fair: null, chase: null, ctrlId: -1, flyCatchable: false, taken: false, waitT: 0, stealPlay: false, queued: null, playRuns: [] });
  S.cpuPitchAt = S.clock + (S.demo ? rand(0.6, 1.0) : S.derby ? rand(0.8, 1.2) : batH() ? rand(0.9, 1.5) : rand(1.0, 1.8));
  for (const f of fielders()) {
    if (f.role === 'C') { f.x = POS.C[0]; f.z = POS.C[1]; f.ry = Math.PI; f.anim = 'squat'; f.animT = 0; }
    else if (f.role === 'P') { f.x = POS.P[0]; f.z = POS.P[1]; f.ry = 0; f.anim = 'idle'; }
    else if (f.anim !== 'idle') f.anim = 'idle';
    f.vx = f.vz = 0;
  }
  if (S.batter) { const B = S.batter; Object.assign(B, { x: BOX.x, z: BOX.z, ry: Math.PI / 2, anim: 'stance', animT: 0 }); }
  ballToPitcher();
}

// ---------- lanzamiento ----------
// velocidad (m/s) y efecto (aceleración lateral y caída) de cada lanzamiento
const PITCHES = {
  recta: { name: 'Recta', v: 16, ax: 0, ay: -4.5 },
  curva: { name: 'Curva', v: 13, ax: 5.5, ay: -12 },
  slider: { name: 'Slider', v: 14.5, ax: 11, ay: -5 },
  cambio: { name: 'Cambio', v: 11, ax: -1.5, ay: -6 },
};
const PITCH_KEYS = Object.keys(PITCHES);
function cpuPitch() {
  let kind;
  const r = Math.random();
  if (S.derby) kind = r < 0.85 ? 'recta' : 'cambio';
  else if (S.settings.diff === 0) kind = r < 0.65 ? 'recta' : r < 0.8 ? 'curva' : r < 0.9 ? 'slider' : 'cambio';
  else kind = r < 0.42 ? 'recta' : r < 0.62 ? 'curva' : r < 0.8 ? 'slider' : 'cambio';
  const wantStrike = S.derby ? Math.random() < 0.9 : Math.random() < (S.balls === 3 ? 0.85 : S.strikes === 2 ? 0.48 : 0.64);
  let tx, ty;
  if (wantStrike) { tx = rand(-0.27, 0.27); ty = rand(0.5, 1.0); if (S.derby) { tx *= 0.6; ty = rand(0.6, 0.92); } }
  else if (Math.random() < 0.6) { tx = pick([-1, 1]) * rand(0.45, 0.72); ty = rand(0.35, 1.2); }
  else { tx = rand(-0.3, 0.3); ty = Math.random() < 0.5 ? rand(0.12, 0.3) : rand(1.22, 1.45); }
  const accR = S.derby ? [0.85, 1] : [[0.4, 0.85], [0.55, 0.95], [0.7, 1]][S.settings.diff] || [0.55, 0.95];
  return { kind, tx, ty, acc: rand(accR[0], accR[1]) };
}
function cpuStealDecide() {
  if (S.derby || S.outs >= 2 || S.strikes >= 2) return;
  const r1 = occAt(1), r2 = occAt(2), r3 = occAt(3);
  const pr = S.demo ? 0.06 : [0.04, 0.07, 0.1][S.settings.diff] || 0.07;
  if (r1 && !r2 && Math.random() < pr) r1.steal = true;
  else if (r2 && !r3 && !r1 && Math.random() < pr * 0.5) r2.steal = true;
}
// la precisión (0-1) decide cuánto se desvía de la mira y un poco de velocidad
function startWindup(p) {
  const acc = clamp(Number.isFinite(p.acc) ? p.acc : 0.8, 0, 1);
  const sc = (1 - acc) * 0.34, a = rand(0, Math.PI * 2);
  p.tx = clamp(p.tx + Math.cos(a) * sc, -1.1, 1.1); p.ty = clamp(p.ty + Math.sin(a) * sc, 0.05, 1.8);
  p.sf = 0.95 + 0.07 * acc + (acc > 0.85 ? 0.03 : 0);
  p.acc = acc;
  if (!PITCHES[p.kind]) p.kind = 'recta';
  S.pitch = p;
  const P = byRole('P');
  P.anim = 'pitch'; P.animT = 0; P.x = POS.P[0]; P.z = POS.P[1]; P.ry = 0;
  enterPhase('windup');
  emit('windup', { acc, kind: p.kind, team: P.team });
  // robos de base: el corredor sale con el movimiento del lanzador
  if (!batH()) cpuStealDecide();
  let st = 0;
  for (const r of S.runners) {
    if (!live(r) || !r.steal || !standing(r) || r.p >= 4) { r.steal = false; continue; }
    const k = Math.round(r.p);
    Object.assign(r, { target: k + 1, base0: k, manual: true, stealing: true, steal: false, startT: S.clock + 0.25 });
    st++;
  }
  if (st) emit('steal', { team: batTeam() });
}
function pitchAt(p, t, out = {}) {
  out.x = p.p0.x + p.v0.x * t + 0.5 * p.a.x * t * t;
  out.y = p.p0.y + p.v0.y * t + 0.5 * p.a.y * t * t;
  out.z = p.p0.z + p.v0.z * t;
  return out;
}
function releasePitch() {
  const p = S.pitch, b = S.ball, PT = PITCHES[p.kind];
  const v = PT.v * (p.sf || 1) * (fldH() ? 1 : S.demo ? 0.92 : S.D.pitchV) * (S.derby ? 0.88 : 1);
  const p0 = { x: PITCH_REL.x, y: PITCH_REL.y, z: PITCH_REL.z };
  const T0 = (0 - p0.z) / v;
  const a = { x: PT.ax, y: PT.ay };
  p.p0 = p0; p.a = a; p.v = v;
  p.v0 = { x: (p.tx - p0.x - 0.5 * a.x * T0 * T0) / T0, y: (p.ty - p0.y - 0.5 * a.y * T0 * T0) / T0, z: v };
  p.t0 = S.clock; p.T0 = T0; p.tt = 0;
  p.id = (S.pitchN = (S.pitchN || 0) + 1);
  p.tC = (CONTACT_Z - p0.z) / v;
  p.cross = pitchAt(p, T0); p.crossC = pitchAt(p, p.tC);
  p.strike = Math.abs(p.cross.x) <= ZONE.x + BALL_R && p.cross.y >= ZONE.y0 - BALL_R && p.cross.y <= ZONE.y1 + BALL_R;
  p.tContactAbs = S.clock + p.tC;
  Object.assign(b, { st: 'pitch', holder: null, x: p0.x, y: p0.y, z: p0.z, vx: p.v0.x, vy: p.v0.y, vz: v, batted: false, thrown: false });
  if (!batH()) cpuBatDecide();
  emit('pitch', { kind: p.kind });
  enterPhase('flight');
  if (S.net === 'host') netPitchRelease(p);
}
function cpuBatDecide() {
  const D = S.demo ? DIFF[1] : S.D, p = S.pitch;
  const inZ = p.strike;
  let pSwing = inZ ? 0.62 + 0.3 * D.eye : 0.42 * (1 - D.eye) + 0.05;
  if (S.strikes === 2) pSwing += inZ ? 0.15 : 0.12;
  if (S.balls === 3 && !inZ) pSwing *= 0.6;
  S.cpuSwingAt = 0;
  if (Math.random() > pSwing) return;
  let kind = 'normal';
  const r1 = S.runners.some((r) => live(r) && Math.round(r.p) === 1);
  if (S.outs < 2 && r1 && Math.random() < 0.08) kind = 'bunt';
  else if (S.strikes < 2 && Math.random() < 0.22) kind = 'power';
  let err = randn() * 3 * D.cpuSig; // randn() tiene desviación 1/3
  if (p.kind === 'cambio' && Math.random() < 0.55) err -= rand(0.04, 0.09);
  if (p.kind === 'curva') err += randn() * 0.06;
  if (p.kind === 'slider' && !inZ && Math.random() < 0.4) err += randn() * 0.12; // se tira a la que se escapa
  S.cpuSwingAt = kind === 'bunt' ? S.clock + p.tC - rand(0.3, 0.55) : S.clock + p.tC - SWING_DT + err;
  S.cpuSwingKind = kind;
  S.cpuAim = rand(-0.55, 0.55);
}
// calidad del contacto: tiempo (adelantado / tarde) + ubicación del lanzamiento
function evalContact(kind, err, cross, aim, pl, winScale) {
  const W = (kind === 'power' ? 0.075 : kind === 'bunt' ? 0.13 : 0.105) * winScale;
  const qt = 1 - Math.abs(err) / W;
  const dy = cross.y - 0.74;
  const ql = 1 - (cross.x / 0.6) ** 2 - (dy / 0.62) ** 2;
  if (qt <= 0 || ql <= 0) return { hit: false, err, early: err < 0 };
  if (kind === 'bunt') return { hit: true, v: 5 + 3.5 * qt, la: rand(-16, -6) * DEG, phi: clamp(aim * 0.7, -0.62, 0.62) + rand(-0.12, 0.12), grade: qt > 0.6 ? 'good' : 'weak', q: qt * 0.5 };
  if (qt < 0.18) {
    const side = err < 0 ? -1 : 1;
    return { hit: true, foulTip: true, v: rand(13, 21), la: rand(18, 62) * DEG, phi: side * rand(0.95, 2.2), grade: 'foul', q: 0.1 };
  }
  const q = qt * (0.55 + 0.45 * clamp(ql * 1.4, 0, 1));
  const pow = pl.pow * (!tH(pl.team) && S.ctl.some(Boolean) ? S.D.cpuPow : 1);
  const v = (kind === 'power' ? 13 + 23 * q : 11.5 + 20 * q) * pow;
  let la;
  if (q < 0.33) la = Math.random() < 0.6 ? rand(-20, -3) : rand(46, 66);
  else la = 11 + dy * 32 + (kind === 'power' ? 9 : 0) + randn() * 7 * (1.2 - q);
  const perfect = qt > 0.72 && ql > 0.4;
  if (perfect) la = kind === 'power' ? clamp(la, 20, 33) : clamp(la, 7, 25);
  const phi = aim * (0.35 + 0.65 * qt) + (err / W) * 0.55 + randn() * 0.05 * (1.3 - q);
  return { hit: true, v, la: la * DEG, phi, grade: perfect ? 'perfect' : q > 0.45 ? 'good' : 'weak', q };
}
// bateo con cursor: el círculo del bate tiene que estar donde pasa la pelota.
// Pelota por encima del centro del cursor → elevado; por debajo → rola. Adelantado → hacia la izquierda.
const CURSOR_R = { normal: 0.2, power: 0.135, bunt: 0.26 };
function evalCursor(kind, err, cross, cur, pl, winScale) {
  const R = (CURSOR_R[kind] || 0.2) + BALL_R;
  const W = (kind === 'power' ? 0.085 : kind === 'bunt' ? 0.14 : 0.11) * winScale;
  const cx = clamp(Number.isFinite(+cur.x) ? +cur.x : 0, -1, 1), cy = clamp(Number.isFinite(+cur.y) ? +cur.y : 0.75, 0, 2);
  const dx = cross.x - cx, dy = cross.y - cy, d = Math.hypot(dx, dy);
  const qt = 1 - Math.abs(err) / W;
  if (qt <= 0 || d > R + 0.05) return { hit: false, err, early: err < 0, far: d > R + 0.05 && qt > 0 };
  if (kind === 'bunt') return { hit: true, v: 4.5 + 4 * qt * (1 - d / (R + 0.05)), la: rand(-16, -5) * DEG, phi: clamp((err / W) * 0.6, -0.6, 0.6) + rand(-0.1, 0.1), grade: qt > 0.5 && d < R * 0.6 ? 'good' : 'weak', q: 0.3 };
  if (d > R || qt < 0.15) {
    const side = err < 0 ? -1 : 1;
    return { hit: true, foulTip: true, v: rand(12, 20), la: rand(15, 65) * DEG, phi: side * rand(0.9, 2.3), grade: 'foul', q: 0.1 };
  }
  const ql = 1 - d / R, u = clamp(dy / R, -1, 1);
  const q = qt * (0.45 + 0.55 * ql);
  const v = (kind === 'power' ? 13 + 24 * q : 11.5 + 20.5 * q) * pl.pow;
  let la = 13 + u * 38 + (kind === 'power' ? 7 : 0) + randn() * 4;
  const perfect = qt > 0.72 && ql > 0.55;
  if (perfect) la = kind === 'power' ? clamp(la, 18, 32) : clamp(la, 6, 24);
  const phi = (err / W) * 0.9 + randn() * 0.05 * (1.3 - q);
  return { hit: true, v, la: la * DEG, phi, grade: perfect ? 'perfect' : q > 0.45 ? 'good' : 'weak', q };
}
// c = { aim } (bateo simple / PC) o { mode: 'cursor', cur: {x, y} }; errIn = error de tiempo ya medido (bateador en línea)
function startSwing(kind, c, errIn) {
  if (S.swing || S.phase !== 'flight') return;
  if (!['normal', 'power', 'bunt'].includes(kind)) kind = 'normal';
  const p = S.pitch, B = S.batter, now = S.clock;
  let err = errIn;
  if (!Number.isFinite(err)) {
    if (kind === 'bunt') { const lead = p.tContactAbs - now; err = lead < 0.1 ? 0.1 - lead : lead > 0.8 ? -(lead - 0.8) : 0; }
    else err = now + SWING_DT - p.tContactAbs;
  }
  const win = batH() && !S.online ? S.D.win : 1;
  const res = c && c.mode === 'cursor' && c.cur ? evalCursor(kind, err, p.cross, c.cur, B, win) : evalContact(kind, err, p.crossC, clamp(+(c && c.aim) || 0, -0.8, 0.8), B, win);
  S.swing = { kind, err, res, t0: now };
  B.anim = kind === 'bunt' ? 'bunt' : 'swing'; B.animT = 0;
  if (kind !== 'bunt') emit('swing', { far: res.far });
}
function stepFlight(cmds) {
  const p = S.pitch, b = S.ball;
  const remote = S.remote[S.half];
  for (const c of cmds) {
    if (c.team !== S.half || !batH()) continue;
    if (c.t === 'swing') startSwing(c.kind, c, remote ? clamp(+c.err || 0, -2, 2) : undefined);
    else if (c.t === 'take') S.taken = true;
    else if (c.t === 'steal') stealCmd(c.base);
  }
  if (S.cpuSwingAt && !S.swing && S.clock >= S.cpuSwingAt) startSwing(S.cpuSwingKind, { aim: S.cpuAim });
  // bateador en línea: la pelota espera en el home hasta que llega su decisión (o 1,2 s)
  const hold = remote && !S.swing && !S.taken && p.tt >= p.tC;
  if (hold) { S.waitT += STEP; if (S.waitT > 1.2) S.taken = true; }
  else p.tt += STEP;
  const t = p.tt;
  pitchAt(p, t, b);
  b.vx = p.v0.x + p.a.x * t; b.vy = p.v0.y + p.a.y * t; b.vz = p.v0.z;
  if (S.swing && S.swing.res.hit && !S.contactDone && t >= p.tC - 1e-6) { doContact(); return; }
  if (!S.judged && b.z >= 0) judgePitch();
  if (b.z >= POS.C[1] - 0.2) catcherGets();
}
// robar base (antes del lanzamiento): el corredor de la base anterior sale con el lanzador
function stealCmd(base) {
  const r = occAt(base - 1);
  if (!r || base < 2 || base > 4 || occAt(base)) return;
  if (S.phase === 'pitch') { r.steal = !r.steal; emit('stealArm', { base, on: r.steal }); }
  else if ((S.phase === 'windup' || S.phase === 'flight') && !r.stealing) {
    const k = Math.round(r.p);
    Object.assign(r, { target: k + 1, base0: k, manual: true, stealing: true, steal: false, startT: S.clock });
    emit('steal', { team: batTeam() });
  }
}
function judgePitch() {
  S.judged = true;
  const p = S.pitch, sw = S.swing;
  if (sw && !sw.res.hit) emit('whiff', { early: sw.res.early });
  if (S.derby) {
    if (sw || p.strike) { S.derbyOuts++; emit('call', { call: sw ? 'whiff' : 'strike' }); S.pend = 'derby'; }
    else emit('call', { call: 'ball' });
    return;
  }
  if (sw || p.strike) { S.strikes++; emit('call', { call: sw ? 'whiff' : 'strike' }); if (S.strikes >= 3) S.pend = 'k'; }
  else { S.balls++; emit('call', { call: 'ball' }); if (S.balls >= 4) S.pend = 'bb'; }
}
function catcherGets() {
  const C = byRole('C'), b = S.ball;
  b.st = 'held'; b.holder = C; b.vx = b.vy = b.vz = 0;
  emit('pop', { soft: true, x: b.x, y: b.y, z: b.z });
  const pend = S.pend;
  S.batted = false;
  const stealing = S.runners.some((r) => live(r) && r.stealing);
  if (pend === 'k') {
    const B = S.batter; B.stats.k++; B.stats.ab++; byRole('P').stats.pk++;
    S.outs++; B.anim = 'sad'; B.animT = 0;
    emit('k', { id: B.id, team: B.team });
    if (S.outs < 3 && stealing) startStealPlay(true);
    else enterPhase('dead', S.outs >= 3 ? 'switch' : 'next');
  } else if (pend === 'bb') { S.batter.stats.bb++; emit('walk', { team: S.batter.team }); startWalk(); }
  else if (pend === 'derby') enterPhase('dead', 'next');
  else if (stealing) startStealPlay(false);
  else enterPhase('dead', 'pitch');
}
// robo en marcha: el receptor tiene la pelota y tira a la base
function startStealPlay(nextBatter) {
  Object.assign(S, { stealPlay: true, stealNext: nextBatter, playRuns: [], playOuts: 0, forceOuts: 0, endT: 0, fair: null, flyOut: false, chase: null });
  const C = byRole('C');
  Object.assign(C, { holdT0: S.clock, canThrowAt: S.clock + 0.2, plan: null, anim: 'idle', animT: 0 });
  S.reactUntil = S.clock;
  enterPhase('play');
}
function occAt(k) { return S.runners.find((r) => live(r) && standing(r) && Math.round(r.p) === k); }
function startWalk() {
  S.walk = true; S.playRuns = []; S.endT = 0;
  let k = 1;
  const movers = [];
  while (k <= 3 && occAt(k)) { movers.push(occAt(k)); k++; }
  for (const r of movers) r.target = Math.round(r.p) + 1;
  const br = makeRunner(S.batter, 0, true); br.target = 1;
  S.runners.push(br);
  enterPhase('play');
}

// ---------- contacto ----------
function doContact() {
  const p = S.pitch, sw = S.swing, res = sw.res, b = S.ball, B = S.batter;
  const P = pitchAt(p, p.tC);
  const cl = Math.cos(res.la);
  Object.assign(b, {
    x: P.x, y: P.y, z: CONTACT_Z, vx: Math.sin(res.phi) * cl * res.v, vy: Math.sin(res.la) * res.v, vz: -Math.cos(res.phi) * cl * res.v,
    st: 'air', holder: null, batted: true, bounced: false, wall: false, thrown: false, noCatchT: 0.18, noCatchT2: 0, outOfPark: false, fromId: -1, tgtBase: -1, side: false,
  });
  Object.assign(S, { contactT: S.clock, contactDone: true, judged: true, batted: true, fair: null, hr: false, playRuns: [], playOuts: 0, forceOuts: 0, endT: 0, flyOut: false, derbyCounted: false, chase: null });
  S.preRunners = S.runners.map((r) => ({ r, p: r.stealing ? r.base0 : r.p }));
  emit('crack', { grade: res.grade, q: res.q, kind: sw.kind, x: P.x, y: P.y, z: CONTACT_Z, v: res.v, team: B.team });
  for (const f of fielders()) if (f.anim === 'squat') { f.anim = 'idle'; f.animT = 0; }
  S.reactUntil = S.clock + (S.derby ? 0.2 : fD().react);
  S.chaseNext = 0;
  if (S.derby) { enterPhase('play'); return; }
  const br = makeRunner(B, 0, true);
  br.target = 1; br.forced = 1; br.fdone = false; br.startT = S.clock + (sw.kind === 'bunt' ? 0.12 : 0.32);
  let k = 1;
  const occ = (n) => S.runners.find((r) => live(r) && ((standing(r) && Math.round(r.p) === n) || (r.stealing && r.base0 === n)));
  while (k <= 3 && occ(k)) { const r = occ(k); r.forced = k + 1; r.fdone = r.p >= k + 1 - 1e-6; k++; }
  for (const r of S.runners) { r.base0 = r.stealing ? r.base0 : Math.round(r.p); r.manual = false; r.stay = false; r.stealing = false; }
  S.runners.push(br);
  enterPhase('play');
}

// ---------- física de la pelota ----------
function ballStep(b, dt, isLive) {
  if (b.st === 'air') {
    b.vy -= G * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.outOfPark) { if (b.y < -2) b.st = 'dead'; return; }
    if (b.y <= BALL_R) {
      b.y = BALL_R;
      const vin = -b.vy;
      if (!b.bounced) { b.bounced = true; b.b0x = b.x; b.b0z = b.z; }
      b.vy = vin * 0.42; b.vx *= 0.74; b.vz *= 0.74;
      if (b.vy < 1.4) { b.vy = 0; b.st = 'ground'; }
      if (isLive && vin > 2) emit('bounce', { x: b.x, z: b.z, v: vin });
    }
  } else if (b.st === 'ground') {
    const sp = Math.hypot(b.vx, b.vz), dec = 5.2 * dt;
    if (sp <= dec) { b.vx = b.vz = 0; } else { b.vx -= (b.vx / sp) * dec; b.vz -= (b.vz / sp) * dec; }
    b.x += b.vx * dt; b.z += b.vz * dt; b.y = BALL_R;
  } else return;
  const r = Math.hypot(b.x, b.z), ang = angOf(b.x, b.z);
  if (Math.abs(ang) <= FAIR + 0.02 && b.z < 0) {
    const R = fenceR(ang) + 0.4;
    if (r >= R - BALL_R) {
      if (b.st === 'air' && !b.bounced && !b.wall && b.batted && b.y > FENCE_H + 0.05) { b.outOfPark = true; if (isLive) emit('outpark'); }
      else {
        const nx = b.x / r, nz = b.z / r, vr = b.vx * nx + b.vz * nz;
        if (vr > 0) { b.vx -= 1.45 * vr * nx; b.vz -= 1.45 * vr * nz; if (isLive && vr > 2) emit('wall', { x: b.x, y: b.y, z: b.z, v: vr }); }
        b.x = nx * (R - BALL_R - 0.02); b.z = nz * (R - BALL_R - 0.02);
        b.wall = true;
      }
    }
  } else if (outsideField(b.x, b.z, -0.15)) {
    // muro de las gradas / red del home: rebota hacia el campo
    let nx, nz;
    if (b.z > 0 && r > SIDE_W - 0.3 && Math.abs(b.x) < r * S2 + 0.5) { nx = b.x / r; nz = b.z / r; }
    else if (b.x >= 0) { nx = S2; nz = S2; } else { nx = -S2; nz = S2; }
    const vr = b.vx * nx + b.vz * nz;
    if (vr > 0) { b.vx -= 1.5 * vr * nx; b.vz -= 1.5 * vr * nz; }
    b.x -= nx * 0.12; b.z -= nz * 0.12;
    b.side = true;
  }
}
const _pb = {};
function predictPath(b, maxT = 7) {
  const c = Object.assign(_pb, b);
  c.holder = null;
  const out = [];
  let t = 0;
  for (let i = 0; i < maxT * 60; i++) {
    ballStep(c, STEP, false);
    t += STEP;
    if (i % 2 === 0) out.push({ t, x: c.x, y: c.y, z: c.z, air: !c.bounced && c.st === 'air' });
    if (c.st === 'dead' || c.outOfPark) break;
    if (c.st === 'ground' && c.vx === 0 && c.vz === 0) { out.push({ t, x: c.x, y: c.y, z: c.z, air: false }); break; }
  }
  return out;
}
// bueno o foul
function decideFair(ang) {
  S.fair = Math.abs(ang) <= FAIR + 0.005;
  if (!S.fair) foulBall();
}
function fairFoulCheck() {
  const b = S.ball;
  if (!S.batted || S.fair !== null || b.holder) return;
  if (b.outOfPark) { S.fair = true; return; }
  if (b.side) { decideFair(Math.PI); return; }
  if (b.bounced) {
    const r0 = Math.hypot(b.b0x, b.b0z);
    if (r0 > 15.5) { decideFair(angOf(b.b0x, b.b0z)); return; }
    const r = Math.hypot(b.x, b.z);
    if (r >= 15.5 || (b.st === 'ground' && Math.hypot(b.vx, b.vz) < 0.4)) decideFair(angOf(b.x, b.z));
  }
}
function foulBall() {
  S.fair = false;
  emit('foul');
  if (S.derby) { S.derbyOuts++; S.derbyCounted = true; enterPhase('dead', 'next'); return; }
  if (S.strikes < 2) S.strikes++;
  for (const o of S.preRunners || []) Object.assign(o.r, { p: o.p, base: o.p, base0: o.p, target: o.p, forced: -1, fdone: true, out: false, scored: false, manual: false, stay: false, startT: 0 });
  S.runners = (S.preRunners || []).map((o) => o.r);
  const B = S.batter;
  Object.assign(B, { x: BOX.x, z: BOX.z, ry: Math.PI / 2, anim: 'stance', animT: 0, snap: true });
  S.foulDead = true;
  enterPhase('dead', 'pitch');
}
function homeRun() {
  S.hr = true; S.fair = true;
  const c = Object.assign({}, S.ball);
  let n = 0;
  while (c.y > 0 && n++ < 900) { c.vy -= G / 60; c.x += c.vx / 60; c.y += c.vy / 60; c.z += c.vz / 60; }
  const dist = Math.round(Math.hypot(c.x, c.z));
  S.hrDist = dist;
  if (S.derby) { S.derbyHr++; S.derbyLong = Math.max(S.derbyLong, dist); emit('hr', { dist, team: 0 }); return; }
  for (const r of S.runners) if (live(r)) { r.target = 4; r.forced = -1; r.fdone = true; r.manual = true; }
  emit('hr', { dist, id: S.batter.id, team: batTeam() });
}

// ---------- defensa (IA) ----------
function assignChase() {
  const b = S.ball;
  const path = predictPath(b);
  if (!path.length) return;
  const D = fD();
  const react = Math.max(0, S.reactUntil - S.clock);
  let best = null;
  for (const f of fielders()) {
    if (f.lieT > 0 || f.throwT > 0) continue;
    const sp = FIELD_V * f.spd * D.fieldV;
    const topH = f.role === 'C' ? 1.8 : 2.05;
    for (const q of path) {
      if (q.t < b.noCatchT || q.y > topH) continue;
      const d = Math.hypot(q.x - f.x, q.z - f.z) - 0.7;
      const moving = Math.hypot(f.vx, f.vz) > 2;
      if (d <= (moving ? sp * Math.max(0, q.t - react) : runDist(q.t - react, sp))) { if (!best || q.t < best.t) best = { f, t: q.t, x: q.x, z: q.z, air: q.air }; break; }
    }
  }
  if (!best) {
    const q = path[path.length - 1];
    let bd = 1e9;
    for (const f of fielders()) { const d = Math.hypot(q.x - f.x, q.z - f.z); if (d < bd) { bd = d; best = { f, t: q.t, x: q.x, z: q.z, air: false }; } }
  }
  S.chase = { id: best.f.id, x: best.x, z: best.z, t: S.clock + best.t, air: best.air };
  S.flyCatchable = best.air && b.st === 'air' && !b.bounced && b.batted;
}
function coverers() {
  const m = {}, b = S.ball, busy = new Set();
  if (S.chase) busy.add(S.chase.id);
  if (b.holder) busy.add(b.holder.id);
  const set = (base, roles) => {
    for (const r of roles) { const f = byRole(r); if (f && !busy.has(f.id) && m[f.id] === undefined) { m[f.id] = base; return; } }
  };
  const bx = b.holder ? b.holder.x : b.x;
  set(1, ['1B', 'P', '2B']);
  set(2, bx > 0 ? ['SS', '2B'] : ['2B', 'SS']);
  set(3, ['3B', 'SS', 'P']);
  set(4, ['C', 'P']);
  return m;
}
function coverOf(base) { for (const id in S.cov) if (S.cov[id] === base) return byId(+id); return null; }
// cuánto tarda la defensa en poner la pelota en una base
function threatTime(base) {
  const b = S.ball, B = BASES[base], D = fD();
  const tv = THROW_V * D.throwV;
  if (b.holder) {
    const h = b.holder, d = Math.hypot(B.x - h.x, B.z - h.z);
    return d < 2.5 ? d / FIELD_V : (h.throwT > 0 ? h.throwT : 0.32) + d / tv;
  }
  if (b.thrown && b.st === 'air' && b.tgtBase > 0) {
    const tg = BASES[b.tgtBase], dd = Math.hypot(tg.x - b.x, tg.z - b.z), sp = Math.hypot(b.vx, b.vz) || 20;
    const tA = dd / sp;
    return b.tgtBase === base ? tA : tA + 0.35 + Math.hypot(B.x - tg.x, B.z - tg.z) / tv;
  }
  if (S.chase) {
    const tc = Math.max(0, S.chase.t - S.clock);
    return tc + 0.4 + Math.hypot(B.x - S.chase.x, B.z - S.chase.z) / tv;
  }
  return 9;
}
function holderPlan(f) {
  const D = fD(), tv = THROW_V * f.arm * D.throwV, fv = FIELD_V * f.spd * D.fieldV;
  let best = null;
  for (const r of S.runners) {
    if (!live(r)) continue;
    let base = -1;
    if (r.forced >= 0 && !r.fdone) base = r.forced;
    else if (!standing(r)) base = Number.isInteger(r.target) ? r.target : Math.floor(r.p + 1e-6);
    if (base >= 1) {
      const B = BASES[base];
      const rem = Math.abs(base - r.p) * BASE / r.speed + Math.max(0, r.startT - S.clock);
      const dB = Math.hypot(B.x - f.x, B.z - f.z);
      const tRun = dB / fv, tThrow = 0.3 + dB / tv;
      const run = dB < 3 || tRun < tThrow;
      const tag = !(r.forced >= 0 && !r.fdone);
      const margin = rem - (run ? tRun : tThrow) - (tag ? 0.15 : 0);
      if (margin > 0.04) { const sc = base * 10 + margin; if (!best || sc > best.sc) best = { sc, kind: run ? 'run' : 'throw', base }; }
    }
    if (!onBase(r) && S.clock >= r.startT) {
      const rp = runnerPos(r), dR = Math.hypot(rp.x - f.x, rp.z - f.z);
      if (dR < 4.5) { const sc = 60 + (4.5 - dR); if (!best || sc > best.sc) best = { sc, kind: 'tag', r }; }
    }
  }
  if (best) return best;
  const adv = S.runners.filter((r) => live(r) && r.target > r.p + 1e-6);
  if (adv.length) {
    const lead = Math.min(4, Math.max(...adv.map((r) => Math.ceil(r.target - 1e-6))));
    if (lead >= 1) { const B = BASES[lead]; if (Math.hypot(B.x - f.x, B.z - f.z) > 3) return { kind: 'throw', base: lead }; }
  }
  if (Math.hypot(f.x, f.z) > 24) return { kind: 'throw', base: 2 };
  return { kind: 'hold' };
}
function holderAI(f) {
  if (f.throwT > 0) return { x: f.x, z: f.z };
  if (f.plan && f.plan.human) { if (S.clock >= f.canThrowAt) startThrow(f, f.plan.base); return { x: f.x, z: f.z }; }
  // defensor de una persona: en modo manual espera su tiro (la PC solo tira si tarda mucho);
  // en automático solo espera si esa persona lo está moviendo en esta jugada
  if (f.id === S.ctrlId && fldH()) {
    const since = S.clock - Math.max(f.holdT0, S.humanActT);
    const manual = S.throwMode[f.team] === 'manual';
    if (manual ? since < 2.6 : S.humanActT > (S.contactT || 0) && since < 0.9) return { x: f.x, z: f.z };
  }
  if (!f.plan || S.clock >= f.replanAt) { f.plan = holderPlan(f); f.replanAt = S.clock + 0.3; }
  const P = f.plan;
  if (P.kind === 'throw') { if (S.clock >= f.canThrowAt) startThrow(f, P.base); return { x: f.x, z: f.z }; }
  if (P.kind === 'run') { const B = BASES[P.base]; return { x: B.x, z: B.z }; }
  if (P.kind === 'tag') { const rp = runnerPos(P.r); return { x: rp.x, z: rp.z }; }
  return { x: f.x, z: f.z };
}
function startThrow(f, base) {
  if (f.throwT > 0 || S.ball.holder !== f) return;
  const B = BASES[base];
  f.throwT = 0.22; f.throwBase = base; f.anim = 'throw'; f.animT = 0;
  f.throwRy = Math.atan2(B.x - f.x, B.z - f.z); f.ry = f.throwRy;
  f.plan = null; f.vx *= 0.3; f.vz *= 0.3;
}
function releaseThrow(f) {
  const b = S.ball;
  if (b.holder !== f) return;
  const base = f.throwBase, B = BASES[base], D = fD();
  const hx = f.x + Math.sin(f.ry) * 0.3, hz = f.z + Math.cos(f.ry) * 0.3, hy = f.y + 1.75;
  const tx = B.x, tz = B.z, ty = 1.25;
  const d = Math.hypot(tx - hx, tz - hz);
  const v = Math.max(10, THROW_V * f.arm * D.throwV * (d < 6 ? 0.6 : d > 30 ? 0.86 : 1));
  const T = Math.max(0.12, d / v);
  Object.assign(b, {
    holder: null, st: 'air', x: hx, y: hy, z: hz, vx: (tx - hx) / T, vz: (tz - hz) / T, vy: (ty - hy + 0.5 * G * T * T) / T,
    thrown: true, batted: false, noCatchT: 0.1, noCatchT2: 0.35, fromId: f.id, tgtBase: base, bounced: false, wall: false,
  });
  const R = coverOf(base);
  S.chase = { id: R ? R.id : f.id, x: tx, z: tz, t: S.clock + T, air: true };
  S.chaseNext = S.clock + T + 0.05;
  emit('throw', { base, team: f.team });
}
function fieldersAI() {
  const b = S.ball, D = fD();
  const loose = !b.holder && !b.outOfPark && b.st !== 'dead';
  if (loose && !S.hr && S.clock >= S.chaseNext) { assignChase(); S.chaseNext = S.clock + 0.25; }
  if (!loose) { S.chase = null; S.flyCatchable = false; }
  S.cov = coverers();
  const wait = S.clock < S.reactUntil;
  for (const f of fielders()) {
    if (f.manual) continue;
    const full = FIELD_V * f.spd * D.fieldV;
    let tx = f.hx, tz = f.hz, sp = full * 0.7;
    if (S.hr) { tx = f.x; tz = f.z; }
    else if (b.holder === f) { const g = holderAI(f); tx = g.x; tz = g.z; sp = full; }
    else if (S.chase && S.chase.id === f.id) {
      tx = S.chase.x; tz = S.chase.z; sp = full;
      const d = Math.hypot(b.x - f.x, b.z - f.z);
      if (b.st === 'ground' && d < 5) { tx = b.x + b.vx * 0.12; tz = b.z + b.vz * 0.12; }
    } else if (S.cov[f.id] !== undefined) { const B = BASES[S.cov[f.id]]; tx = B.x; tz = B.z; sp = full * 0.95; }
    else if (IS_OF[f.role] && loose) { tx = lerp(f.hx, b.x, 0.5); tz = lerp(f.hz, b.z, 0.5); sp = full * 0.8; }
    if (wait && loose) { tx = f.x; tz = f.z; }
    f.goalX = tx; f.goalZ = tz; f.goalSp = sp;
  }
}
function tryCatch() {
  const b = S.ball;
  if (b.holder || b.outOfPark || b.st === 'dead' || b.noCatchT > 0 || S.hr) return;
  let best = null, bd = 1e9;
  // una línea muy fuerte nada más salir del bate: casi no da tiempo a reaccionar
  const hard = b.batted && S.clock - (S.contactT || 0) < fD().react + 0.15 && Math.hypot(b.vx, b.vy, b.vz) > 22;
  for (const f of fielders()) {
    if (f.lieT > 0 || f.throwT > 0) continue;
    if (f.id === b.fromId && b.noCatchT2 > 0) continue;
    const hd = Math.hypot(b.x - f.x, b.z - f.z);
    const reach = f.diveT > 0 ? 1.6 : hard ? 0.38 : 0.85;
    const top = f.y + (f.y > 0.05 ? 2.7 : 2.1);
    if (hd < reach && b.y < top && b.y > f.y - 0.2 && hd < bd) { best = f; bd = hd; }
  }
  if (best) onCatch(best);
}
function onCatch(f) {
  const b = S.ball;
  const fly = b.batted && !b.bounced && !b.wall && b.st === 'air';
  if (S.batted && S.fair === null && !fly) { decideFair(angOf(b.x, b.z)); if (S.phase !== 'play') return; }
  if (fly && S.fair === null) S.fair = Math.abs(angOf(b.x, b.z)) <= FAIR;
  b.holder = f; b.st = 'held'; b.vx = b.vy = b.vz = 0;
  f.holdT0 = S.clock; f.plan = null;
  f.canThrowAt = S.clock + (tH(f.team) ? 0.22 : fD().react * 0.8 + 0.08);
  f.anim = fly || b.y > 1.2 ? 'catch' : 'field'; f.animT = 0;
  S.chase = null;
  emit('catch', { id: f.id, fly: fly && S.batted, x: b.x, y: b.y, z: b.z, team: f.team });
  // tiro preparado: la persona eligió la base antes de atrapar
  const Q = S.queued;
  if (Q && Q.team === f.team && S.clock < Q.until && fldH()) {
    S.queued = null;
    const B = BASES[Q.base];
    if (Math.hypot(B.x - f.x, B.z - f.z) > 1.2) { f.plan = { kind: 'throw', base: Q.base, human: true }; f.replanAt = S.clock + 9; f.canThrowAt = S.clock + 0.14; S.humanActT = S.clock; S.ctrlId = f.id; }
  }
  if (fly && S.batted && !S.derby) {
    const br = S.runners.find((r) => r.isBatter && live(r));
    if (br) outRunner(br, 'fly');
    for (const r of S.runners) {
      if (!live(r) || r.isBatter) continue;
      if (r.p > r.base0 + 1e-3) Object.assign(r, { target: r.base0, forced: r.base0, fdone: false, manual: false, stay: true });
      else { r.forced = -1; r.fdone = true; }
    }
    S.flyOut = true;
  }
  b.batted = false;
}
function outRunner(r, how) {
  if (!live(r)) return;
  r.out = true; S.outs++; S.playOuts++;
  if (how === 'force') S.forceOuts++;
  for (const o of S.runners) if (live(o) && o.base0 > r.base0 && o.forced > o.base0) o.forced = -1;
  const pos = runnerPos(r);
  emit('out', { how, x: pos.x, z: pos.z, id: r.pl.id, team: r.pl.team, n: S.playOuts });
  if (S.outs >= 3 && (how === 'force' || r.isBatter) && S.playRuns.length) cancelRuns();
}
function cancelRuns() {
  const bt = batTeam();
  for (const r of S.playRuns) { S.score[bt]--; S.line[bt][S.inning - 1]--; S.halfRuns--; r.pl.stats.r--; S.batter.stats.rbi--; }
  emit('noRun', { n: S.playRuns.length });
  S.playRuns = [];
  S.walkoff = S.half === 1 && S.inning >= S.innings && S.score[1] > S.score[0];
}
function outsCheck() {
  const h = S.ball.holder;
  if (!h) return;
  for (const r of S.runners) {
    if (!live(r) || S.clock < r.startT) continue;
    if (r.forced >= 0 && !r.fdone) {
      const B = BASES[r.forced];
      if (Math.hypot(h.x - B.x, h.z - B.z) < 0.9) { outRunner(r, 'force'); continue; }
    }
    if (!onBase(r)) {
      const P = runnerPos(r);
      if (Math.hypot(h.x - P.x, h.z - P.z) < 0.8) outRunner(r, 'tag');
    }
  }
}

// ---------- corredores ----------
function touchBases(r, a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (let k = Math.ceil(lo - 1e-6); k <= Math.floor(hi + 1e-6); k++) {
    if (Math.abs(k - a) < 1e-6) continue;
    r.base = k;
    if (k === r.forced) r.fdone = true;
  }
}
function scoreRun(r) {
  r.scored = true; r.scoreT = S.clock;
  r.pl.anim = 'cheer'; r.pl.animT = 0;
  if (S.outs >= 3) return;
  const bt = batTeam();
  S.score[bt]++; S.line[bt][S.inning - 1] = (S.line[bt][S.inning - 1] || 0) + 1; S.halfRuns++;
  r.pl.stats.r++; S.batter.stats.rbi++;
  S.playRuns.push(r);
  emit('run', { team: bt, id: r.pl.id });
  if (S.half === 1 && S.inning >= S.innings && S.score[1] > S.score[0]) S.walkoff = true;
  if (S.halfRuns >= RUN_CAP) S.capHit = true;
}
const runMargin = (r) => (!S.ctl.some(Boolean) ? 0.4 : tH(r.pl.team) ? 0.35 : S.D.cpuRunM);
const blockedAt = (next, r) => S.runners.some((o) => o !== r && live(o) && ((Math.abs(o.p - next) < 1e-3 && o.target <= next + 1e-6) || (Math.abs(o.target - next) < 1e-6 && o.p < next)));
// al llegar a una base corriendo, ¿la redondea y sigue a la siguiente?
function tryExtend(r) {
  const t = r.target;
  if (!Number.isInteger(t) || t >= 4 || r.stay || r.p < t - 0.3 || S.clock < r.decideAt) return;
  r.decideAt = S.clock + 0.1;
  if (blockedAt(t + 1, r)) return;
  if (((t + 1 - r.p) * BASE) / r.speed + runMargin(r) < threatTime(t + 1)) r.target = t + 1;
}
function runnerAI(r) {
  const b = S.ball;
  if (S.flyCatchable && b.batted && b.st === 'air' && !b.bounced && !r.isBatter) {
    r.target = r.forced >= 0 && !r.fdone ? r.base0 + 0.42 : r.base0;
    return;
  }
  if (r.forced >= 0 && !r.fdone) { if (r.target < r.forced) r.target = r.forced; if (!S.flyCatchable) tryExtend(r); return; }
  if (!Number.isInteger(r.target)) { r.target = Math.round(r.p) >= r.p ? Math.ceil(r.p) : Math.floor(r.p); return; }
  if (standing(r)) {
    const k = Math.round(r.p);
    if (k >= 4 || r.stay || S.clock < r.decideAt) return;
    r.decideAt = S.clock + 0.1;
    const next = k + 1;
    if (blockedAt(next, r)) return;
    if (BASE / r.speed + runMargin(r) < threatTime(next)) r.target = next;
  } else if (r.target > r.p && r.p > r.target - 0.3) {
    tryExtend(r);
  } else if (r.target > r.p) {
    const remain = (r.target - r.p) * BASE / r.speed;
    const back = (r.p - Math.floor(r.p)) * BASE / r.speed;
    if (threatTime(r.target) + 0.1 < remain && back < remain && back + 0.15 < threatTime(Math.floor(r.p))) r.target = Math.floor(r.p);
  }
}
function applyRunCmd(dir) {
  const rs = S.runners.filter(live).sort((a, b) => b.p - a.p);
  let any = false;
  for (const r of rs) {
    if (S.clock < r.startT) continue;
    if (dir > 0) {
      if (r.forced >= 0 && !r.fdone && r.forced > r.base0) continue;
      if (r.target < r.p - 1e-6) r.target = Math.ceil(r.p - 1e-6);
      else if (standing(r) || !Number.isInteger(r.target)) r.target = Math.min(4, Math.floor(r.p + 1e-6) + 1);
      else continue;
      r.manual = true; r.stay = false; any = true;
    } else {
      if (r.forced >= 0 && !r.fdone && r.forced > r.base0) continue;
      if (r.target > r.p + 1e-6 || !Number.isInteger(r.target)) { r.target = Math.floor(r.p + 1e-6); r.manual = true; any = true; }
      r.stay = true;
    }
  }
  if (any) emit('runCmd', { dir });
}
// tocar una base en el rombo: el corredor que salió de ella vuelve; si no, el de la base anterior corre hacia ella
function runToBase(k) {
  if (k < 1 || k > 4) return;
  const rs = S.runners.filter((r) => live(r) && S.clock >= r.startT);
  const forcedFwd = (r) => r.forced >= 0 && !r.fdone && r.forced > r.base0;
  let r = rs.find((o) => Math.floor(o.p + 1e-6) === k && o.target > o.p + 1e-6 && !forcedFwd(o));
  if (r) { r.target = k; r.manual = true; r.stay = true; emit('runCmd', { dir: -1, base: k }); return; }
  r = rs.find((o) => Math.floor(o.p + 1e-6) === k - 1 && o.target <= k - 1 + 1e-6) || rs.find((o) => o.p < k && o.p > k - 1 && o.target < o.p);
  if (r && !blockedAt(k, r)) { r.target = k; r.manual = true; r.stay = false; emit('runCmd', { dir: 1, base: k }); }
}
function runnersStep(dt) {
  for (const r of S.runners) {
    if (!live(r) || S.clock < r.startT) continue;
    if (!S.hr && !S.walk && !r.manual) runnerAI(r);
    const v = ((S.hr ? 9 : S.walk ? 5.5 : r.speed) * dt) / BASE;
    const p0 = r.p;
    if (r.target > r.p + 1e-6) r.p = Math.min(r.target, r.p + v);
    else if (r.target < r.p - 1e-6) r.p = Math.max(r.target, r.p - v);
    if (r.p !== p0) touchBases(r, p0, r.p);
    if (r.p >= 4 - 1e-6 && !r.scored) { scoreRun(r); continue; }
    if (r.manual && Math.abs(r.p - r.target) < 1e-6) { r.manual = false; r.stealing = false; }
    r.slideT = Math.max(0, r.slideT - dt);
    // se desliza si la jugada en la base es cerrada
    if (!S.hr && !S.walk && r.slideT <= 0 && !r.slid && Number.isInteger(r.target) && r.target > r.p && r.target >= 2) {
      const rem = (r.target - r.p) * BASE;
      if (rem < 2.4 && rem > 1.2 && threatTime(r.target) < rem / r.speed + 0.5) { r.slideT = 0.5; r.slid = true; emit('slide', { id: r.pl.id }); }
    }
    if (onBase(r)) r.slid = false;
  }
}

// ---------- tu defensor ----------
function humanFielder() {
  for (const f of fielders()) f.manual = false;
  if (!fldH()) { S.ctrlId = -1; return; }
  const inp = S.inp[fieldTeam()];
  const b = S.ball;
  let c = null;
  if (b.holder) c = b.holder;
  else if (S.chase) c = byId(S.chase.id);
  if (c && c.team === fieldTeam() && c.id !== S.ctrlId) { S.ctrlId = c.id; emit('ctrl', { id: c.id }); }
  const f = S.ctrlId >= 0 ? byId(S.ctrlId) : null;
  if (!f || f.team !== fieldTeam()) return;
  const mag = Math.hypot(inp.mx, inp.mz);
  if (mag > 0.2 && f.lieT <= 0 && f.diveT <= 0 && f.throwT <= 0 && !S.hr) { f.manual = true; f.mx = inp.mx / Math.max(1, mag); f.mz = inp.mz / Math.max(1, mag); S.humanActT = S.clock; }
}
function baseByDir(f, dir) {
  let best = 0, bd = -2;
  for (let k = 1; k <= 4; k++) {
    const B = BASES[k], dx = B.x - f.x, dz = B.z - f.z, d = Math.hypot(dx, dz);
    if (d < 1.2) continue;
    const dot = (dx * dir.x + dz * dir.z) / d;
    if (dot > bd) { bd = dot; best = k; }
  }
  return best || null;
}
function fieldCmd(c) {
  const f = S.ctrlId >= 0 ? byId(S.ctrlId) : null;
  if (!f || f.team !== fieldTeam() || S.hr) return;
  const b = S.ball;
  if (c.t === 'jump') {
    if (f.y <= 0 && f.lieT <= 0 && f.diveT <= 0 && f.throwT <= 0) { f.vy = 6.6; emit('jump'); S.humanActT = S.clock; }
  } else if (c.t === 'dive') {
    if (f.lieT > 0 || f.diveT > 0 || f.throwT > 0 || b.holder === f || f.y > 0) return;
    let dx = S.inp[fieldTeam()].mx, dz = S.inp[fieldTeam()].mz;
    if (Math.hypot(dx, dz) < 0.2) { dx = b.x - f.x; dz = b.z - f.z; }
    const d = Math.hypot(dx, dz) || 1;
    Object.assign(f, { vx: (dx / d) * 8.5, vz: (dz / d) * 8.5, ry: Math.atan2(dx, dz), diveT: 0.36, anim: 'dive', animT: 0, manual: false });
    emit('dive'); S.humanActT = S.clock;
  } else if (c.t === 'throw') {
    const cb = clamp(c.base | 0, 0, 4);
    // aún no la tiene: el tiro queda preparado para cuando la atrape
    if (b.holder !== f) { if (cb && !b.holder) { S.queued = { team: f.team, base: cb, until: S.clock + 4 }; emit('queued', { base: cb, team: f.team }); } return; }
    if (f.throwT > 0) return;
    const dir = c.dir && Number.isFinite(+c.dir.x) && Number.isFinite(+c.dir.z) ? { x: +c.dir.x, z: +c.dir.z } : null;
    let base = cb || (dir ? baseByDir(f, dir) : null);
    if (!base) { const P = holderPlan(f); base = P.base || 1; }
    const B = BASES[base];
    if (Math.hypot(B.x - f.x, B.z - f.z) < 1.2) return;
    startThrow(f, base); S.humanActT = S.clock;
  }
}

// ---------- jugadores en movimiento ----------
function movePlayers(dt) {
  const b = S.ball, pitching = S.phase === 'pitch' || S.phase === 'windup' || S.phase === 'flight';
  for (const f of fielders()) {
    f.animT += dt;
    if (f.diveT > 0) {
      f.diveT -= dt; f.x += f.vx * dt; f.z += f.vz * dt; f.anim = 'dive';
      if (f.diveT <= 0) { f.lieT = 0.6; f.anim = 'lie'; f.animT = 0; f.vx = f.vz = 0; }
      continue;
    }
    if (f.lieT > 0) { f.lieT -= dt; if (f.lieT <= 0) { f.anim = 'idle'; f.animT = 0; } continue; }
    let dvx = 0, dvz = 0;
    if (f.manual) { const s = FIELD_V * 1.05 * f.spd; dvx = f.mx * s; dvz = f.mz * s; }
    else if (f.throwT <= 0 && (S.phase === 'play' || S.phase === 'dead')) {
      const dx = f.goalX - f.x, dz = f.goalZ - f.z, d = Math.hypot(dx, dz);
      if (d > 0.06) { const sp = Math.min(f.goalSp, d * 5); dvx = (dx / d) * sp; dvz = (dz / d) * sp; }
    }
    // aceleración limitada: arrancar cuesta (frenar es más rápido)
    const ex = dvx - f.vx, ez = dvz - f.vz, el = Math.hypot(ex, ez);
    const accel = (dvx * f.vx + dvz * f.vz < 0 || Math.hypot(dvx, dvz) < Math.hypot(f.vx, f.vz) ? 22 : FIELD_ACC) * dt;
    if (el > accel) { f.vx += (ex / el) * accel; f.vz += (ez / el) * accel; } else { f.vx = dvx; f.vz = dvz; }
    f.x += f.vx * dt; f.z += f.vz * dt;
    if (f.y > 0 || f.vy > 0) { f.vy -= PG * dt; f.y += f.vy * dt; if (f.y <= 0) { f.y = 0; f.vy = 0; } }
    const sp = Math.hypot(f.vx, f.vz);
    if (f.throwT > 0) { f.ry = f.throwRy; f.throwT -= dt; if (f.throwT <= 0) releaseThrow(f); }
    else if (sp > 0.8) f.ry = Math.atan2(f.vx, f.vz);
    else if (S.phase === 'play' && b.holder !== f) f.ry = Math.atan2(b.x - f.x, b.z - f.z);
    else if (pitching) f.ry = f.role === 'C' ? Math.PI : Math.atan2(-f.x, -f.z);
    if ((f.anim === 'throw' && f.animT > 0.55) || (f.anim === 'catch' && f.animT > 0.5) || (f.anim === 'field' && f.animT > 0.45) ||
      (f.anim === 'pitch' && f.animT > 1.15 && S.phase !== 'windup') || (f.anim === 'squat' && !pitching && S.phase !== 'pre')) { f.anim = 'idle'; f.animT = 0; }
  }
  for (const p of S.teams[batTeam()]) p.animT += dt;
  const P = {};
  for (const r of S.runners) {
    if (r.out) continue;
    const pl = r.pl;
    if (r.scored) continue;
    runnerPos(r, P);
    const dx = P.x - pl.x, dz = P.z - pl.z;
    if (Math.hypot(dx, dz) > 0.004) pl.ry = Math.atan2(dx, dz);
    else if (standing(r) && r.p < 4) pl.ry = angDamp(pl.ry, Math.atan2(b.x - pl.x, b.z - pl.z), 6, dt);
    pl.x = P.x; pl.z = P.z; pl.y = 0;
    if (r.slideT > 0) { if (pl.anim !== 'slide') { pl.anim = 'slide'; pl.animT = 0; } }
    else if (S.clock >= r.startT && (BAT_ANIM[pl.anim] || pl.anim === 'slide')) { pl.anim = 'idle'; pl.animT = 0; }
  }
}

// ---------- fases ----------
function stepPlay(dt, cmds) {
  const b = S.ball;
  if (!b.holder) ballStep(b, dt, true);
  if (b.noCatchT > 0) b.noCatchT -= dt;
  if (b.noCatchT2 > 0) b.noCatchT2 -= dt;
  if (S.batted) fairFoulCheck();
  if (S.phase !== 'play') return;
  if (b.outOfPark && !S.hr) homeRun();
  for (const c of cmds) {
    if (c.team === batTeam()) {
      if (!batH() || S.hr || S.walk) continue;
      if (c.t === 'run') applyRunCmd(c.dir > 0 ? 1 : -1);
      else if (c.t === 'runTo') runToBase(c.base | 0);
    } else if (c.team === fieldTeam() && fldH() && !S.walk) fieldCmd(c);
  }
  if (!S.walk) { fieldersAI(); humanFielder(); tryCatch(); }
  runnersStep(dt);
  if (!S.walk && !S.hr) outsCheck();
  if (S.derby) {
    if (S.hr) { S.endT += dt; if (S.endT > 2.6) enterPhase('dead', 'next'); }
    else if (b.holder || b.bounced || b.wall || b.st === 'dead') {
      if (!S.derbyCounted) { S.derbyCounted = true; S.derbyOuts++; emit('derbyMiss'); }
      S.endT += dt;
      if (S.endT > 0.9) enterPhase('dead', 'next');
    }
    return;
  }
  const settled = S.runners.every((r) => !live(r) || standing(r));
  if (S.outs >= 3) { S.endT += dt; if (S.endT > 0.7) endPlay(); return; }
  if ((S.walkoff || S.capHit) && !S.hr) { S.endT += dt; if (S.endT > 0.9) endPlay(); return; }
  if (S.hr) { if (S.runners.every((r) => !live(r))) { S.endT += dt; if (S.endT > 1.0) endPlay(); } return; }
  if (S.walk) { if (settled) { S.endT += dt; if (S.endT > 0.3) endPlay(); } return; }
  if (b.holder && settled && S.t > 0.8) { S.endT += dt; if (S.endT > (batH() ? 0.9 : 0.55)) endPlay(); }
  else S.endT = 0;
  if (S.t > 30) endPlay();
}
function endPlay() {
  const bt = batTeam();
  if (S.batted && !S.derby) {
    const B = S.batter;
    B.stats.ab++;
    const br = S.runners.find((r) => r.isBatter);
    if (S.hr) { B.stats.h++; B.stats.hr++; S.hits[bt]++; emit('hitType', { bases: 4, team: bt }); }
    else if (br && live(br) && S.fair && !S.flyOut && S.forceOuts === 0) { const bases = clamp(Math.round(br.p), 1, 3); B.stats.h++; S.hits[bt]++; emit('hitType', { bases, team: bt }); }
  }
  let rs = S.runners.filter(live);
  for (const r of rs) r.p = Math.max(1, onBase(r) ? Math.round(r.p) : Math.floor(r.p));
  rs.sort((a, b) => b.p - a.p);
  const used = new Set();
  rs = rs.filter((r) => { let k = r.p; while (used.has(k) && k > 1) k--; if (used.has(k)) return false; used.add(k); r.p = k; return true; });
  for (const r of rs) Object.assign(r, { base: r.p, base0: r.p, target: r.p, forced: -1, fdone: true, isBatter: false, manual: false, stay: false, startT: 0, slideT: 0, stealing: false, steal: false });
  S.runners = rs;
  S.walk = false;
  const steal = S.stealPlay;
  S.stealPlay = false;
  enterPhase('dead', S.walkoff || S.outs >= 3 || S.capHit ? 'switch' : steal && !S.stealNext ? 'pitch' : 'next');
}
function stepDead(dt) {
  const b = S.ball;
  const dur = S.deadKind === 'pitch' ? (S.foulDead ? 1.3 : 0.95) : S.deadKind === 'switch' ? 1.6 : S.batted ? 1.8 : 1.3;
  for (const f of fielders()) { f.goalX = f.hx; f.goalZ = f.hz; f.goalSp = 5.5; f.manual = false; }
  // la pelota vuelve al lanzador
  const P = byRole('P');
  if (!S.retBall && S.t > 0.4 && b.holder && b.holder !== P) {
    const h = b.holder;
    S.retBall = { x: h.x, y: 1.6, z: h.z, t0: S.clock, d: 0.7 };
    b.holder = null; b.st = 'toss';
  }
  if (S.retBall) {
    const R = S.retBall, k = clamp((S.clock - R.t0) / R.d, 0, 1);
    b.x = lerp(R.x, P.x, k); b.z = lerp(R.z, P.z, k); b.y = lerp(R.y, 1.4, k) + Math.sin(k * Math.PI) * (1 + Math.hypot(R.x - P.x, R.z - P.z) * 0.08);
    if (k >= 1) { b.holder = P; b.st = 'held'; S.retBall = null; S.retDone = true; }
  }
  if (S.t < dur) return;
  if (S.retBall) return;
  S.foulDead = false;
  for (const f of fielders()) {
    if (Math.hypot(f.x - f.hx, f.z - f.hz) > 1.2) { f.x = f.hx; f.z = f.hz; f.vx = f.vz = 0; f.snap = true; }
    f.lieT = f.diveT = f.throwT = 0; f.y = 0; f.vy = 0;
  }
  if (S.deadKind === 'switch') { enterPhase('switch'); return; }
  if (S.derby && S.derbyOuts >= S.derbyMax) { endGame(); return; }
  if (S.deadKind === 'next') {
    S.balls = 0; S.strikes = 0;
    if (!S.derby) S.batIdx[batTeam()] = (S.batIdx[batTeam()] + 1) % 9;
    setupBatter();
  }
  enterPhase('pitch');
}
function onSwitch() {
  const N = S.innings;
  let over = false;
  if (S.walkoff) over = true;
  else if (S.half === 0 && S.inning >= N && S.score[1] > S.score[0]) over = true;
  else if (S.half === 1 && S.inning >= N && S.score[0] !== S.score[1]) over = true;
  else if (S.half === 1 && S.inning >= N + 3) over = true;
  if (over) { endGame(); return; }
  emit('switch', { capHit: S.capHit });
}
function nextHalf() {
  if (S.half === 0) S.half = 1; else { S.half = 0; S.inning++; }
  S.runners = [];
  enterPhase('pre');
}
function endGame() { S.ended = true; S.phase = 'end'; S.t = 0; emit('end'); }
function simStep(dt) {
  if (!S.on || S.phase === 'end') return;
  S.clock += dt; S.t += dt;
  const cmds = S.cmds.splice(0);
  switch (S.phase) {
    case 'pre': if (S.t > (S.demo ? 1.0 : 2.2)) enterPhase('pitch'); break;
    case 'pitch': {
      for (const c of cmds) if (c.t === 'steal' && c.team === batTeam() && batH()) stealCmd(c.base | 0);
      if (fldH()) {
        for (const c of cmds) if (c.t === 'pitch' && c.team === fieldTeam()) { startWindup({ kind: String(c.kind), tx: clamp(+c.tx || 0, -0.95, 0.95), ty: clamp(+c.ty || 0.75, 0.12, 1.6), acc: clamp(+c.acc || 0, 0, 1), human: true }); break; }
      } else if (S.clock >= S.cpuPitchAt) startWindup(cpuPitch());
      break;
    }
    case 'windup':
      for (const c of cmds) if (c.t === 'steal' && c.team === batTeam() && batH()) stealCmd(c.base | 0);
      if (S.runners.some((r) => r.stealing)) runnersStep(dt);
      if (S.t >= 0.6) releasePitch();
      break;
    case 'flight': if (S.runners.some((r) => r.stealing)) runnersStep(dt); stepFlight(cmds); break;
    case 'play': stepPlay(dt, cmds); break;
    case 'dead': stepDead(dt); break;
    case 'switch': if (S.t > (S.demo ? 1.2 : 2.4)) nextHalf(); break;
  }
  if (S.phase !== 'end') movePlayers(dt);
}

// =========================================================
//  JUEGO: personajes, controles, cámara, HUD y pantallas
// =========================================================
const GAME = { mode: 'menu', paused: false, chars: new Map(), tags: new Map(), screen: 'scrMenu', hitStop: 0, slowmo: 0, shake: 0, camPunch: 0, tScale: 1 };
const FX = { fireT: 0, fwT: 0, fwNext: 0, landT: 0, land: null, spin: 0, axis: new THREE.Vector3(1, 0, 0) };
function buildCharacters() {
  for (const c of GAME.chars.values()) c.dispose();
  for (const t of GAME.tags.values()) t.remove();
  GAME.chars.clear(); GAME.tags.clear();
  for (const p of S.players) {
    const c = new Char(p);
    if (p.role === 'C') c.ghostify();
    GAME.chars.set(p.id, c);
    GAME.tags.set(p.id, makeTag(p, p.id === S.avatarId));
  }
}

// ---------- controles ----------
const INPUT = { keys: {}, mouse: { nx: 0, ny: 0, has: false }, joy: { x: 0, y: 0 }, batAim: 0, ptx: 0, pty: 0.75, throwBase: 0, cur: { x: 0, y: 0.75 }, power: false, pitchKind: 'recta', lastBatter: null };
const METER = { on: false, t: 0, kind: 'recta' }; // aro de precisión al lanzar
const playing = () => (GAME.mode === 'game' || GAME.mode === 'derby' || GAME.mode === 'online') && (!GAME.paused || S.online) && S.on && !S.ended && !S.demo && GAME.screen !== 'scrPause';
const cursorMode = () => SAVE.batMode !== 'simple';
function uiCtx() {
  if (!playing()) return 'none';
  if (humanBats()) {
    if ((S.phase === 'pitch' || S.phase === 'windup' || S.phase === 'flight') && !S.contactDone) return 'bat';
    if (S.phase === 'play' && !S.derby && !S.hr && !S.walk && S.runners.some(live)) return 'run';
    return 'none';
  }
  if (humanFields()) {
    if (S.phase === 'pitch') return 'pitch';
    if (S.phase === 'play' && !S.walk && !S.hr) return 'field';
  }
  return 'none';
}
function pushCmd(c) {
  if (!playing()) return;
  c.team = S.me;
  if (S.net === 'client') netSendCmd(c); else S.cmds.push(c);
}
// ¿la pelota ya salió de la mano del lanzador? (en el invitado se mira su propia copia del lanzamiento)
const pitchLive = () => (S.net === 'client' ? !!(CL.pitch && !CL.swingSent && S.clock < CL.pitch.tContactAbs + 0.3) : S.phase === 'flight' && !S.swing);
function swingCmd(kind) {
  if (!pitchLive()) return;
  const c = { t: 'swing', kind, aim: INPUT.batAim, mode: cursorMode() ? 'cursor' : 'simple', cur: { x: INPUT.cur.x, y: INPUT.cur.y } };
  if (S.net === 'client') clientSwing(c); else pushCmd(c);
}
function meterStart(kind) {
  if (METER.on) return;
  Object.assign(METER, { on: true, t: 0, kind });
  INPUT.pitchKind = kind;
  SFX.ui();
}
// el aro se cierra: cuanto más cerca del centro al soltar, más preciso
const meterR = () => Math.max(0.02, 0.6 * (1 - METER.t / 0.85));
function meterRelease() {
  if (!METER.on) return;
  METER.on = false;
  const acc = clamp(1 - Math.abs(meterR() - 0.1) / 0.28, 0, 1);
  pushCmd({ t: 'pitch', kind: METER.kind, tx: INPUT.ptx, ty: INPUT.pty, acc });
  popText(INPUT.ptx, INPUT.pty + 0.35, 0, acc > 0.85 ? '¡PERFECTO!' : acc > 0.6 ? 'BIEN' : 'IMPRECISO', acc > 0.85 ? 'perfect' : acc > 0.6 ? 'good' : 'bad');
  if (acc > 0.85) SFX.perfect();
}
function meterTick(dt, ctx) {
  if (!METER.on) return;
  if (ctx !== 'pitch') { METER.on = false; return; }
  METER.t += dt;
  if (METER.t > 1.1) meterRelease();
}
// el rombo de bases: tirar (defensa), mandar corredores (corriendo) o robar (antes del lanzamiento)
function baseTap(k) {
  SFX.resume();
  const c = uiCtx();
  if (c === 'field') { pushCmd({ t: 'throw', base: k }); SFX.ui(); }
  else if (c === 'run') pushCmd({ t: 'runTo', base: k });
  else if (c === 'bat' && (S.phase === 'pitch' || S.phase === 'windup' || S.phase === 'flight')) { pushCmd({ t: 'steal', base: k }); SFX.ui(); }
  else if (c === 'pitch' && !METER.on) { INPUT.pitchKind = PITCH_KEYS[k - 1] || 'recta'; SFX.ui(); HUD.ctx = '?'; }
}
function moveInput() {
  const k = INPUT.keys;
  let rx = INPUT.joy.x, ry = INPUT.joy.y;
  if (k.KeyA || k.ArrowLeft) rx -= 1;
  if (k.KeyD || k.ArrowRight) rx += 1;
  if (k.KeyW || k.ArrowUp) ry += 1;
  if (k.KeyS || k.ArrowDown) ry -= 1;
  const l = Math.hypot(rx, ry);
  if (l > 1) { rx /= l; ry /= l; }
  return { x: rx, y: ry };
}
function joyDir() { const m = moveInput(), l = Math.hypot(m.x, m.y); return l > 0.45 ? { x: m.x / l, z: -m.y / l } : null; }
// botón semántico: main (clic / BATEAR), alt (Espacio / PODER), sec (E / TOQUE), dive (clic der / PLANCHA)
// src = 'tb' si viene de un botón táctil
function act(btn, src) {
  SFX.resume();
  const c = uiCtx();
  if (c === 'bat') {
    if (cursorMode() && btn === 'alt') { INPUT.power = !INPUT.power; SFX.ui(); HUD.ctx = '?'; return; }
    const kind = btn === 'main' ? (cursorMode() && INPUT.power ? 'power' : 'normal') : btn === 'alt' ? 'power' : btn === 'sec' ? 'bunt' : null;
    if (kind) swingCmd(kind);
  } else if (c === 'run') {
    pushCmd({ t: 'run', dir: btn === 'main' || btn === 'alt' ? 1 : -1 });
  } else if (c === 'pitch') {
    if (src === 'tb') {
      // cada botón es un lanzamiento: tocar = empieza el aro; tocar otra vez = suelta
      if (METER.on) meterRelease(); else meterStart({ main: 'recta', alt: 'curva', sec: 'slider', dive: 'cambio' }[btn] || 'recta');
    } else if (btn === 'main' || btn === 'alt') { if (METER.on) meterRelease(); else meterStart(INPUT.pitchKind); }
    else if (!METER.on) { INPUT.pitchKind = PITCH_KEYS[(PITCH_KEYS.indexOf(INPUT.pitchKind) + 1) % PITCH_KEYS.length]; SFX.ui(); HUD.ctx = '?'; }
  } else if (c === 'field') {
    if (btn === 'main') pushCmd({ t: 'throw', base: INPUT.mouse.has && !IS_TOUCH ? INPUT.throwBase : 0, dir: joyDir() });
    else if (btn === 'alt') pushCmd({ t: 'jump' });
    else if (btn === 'dive') pushCmd({ t: 'dive' });
  }
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  INPUT.keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyF') { toggleFullscreen(); return; }
  if (!playing()) return;
  if (e.code === 'Space') act('alt');
  else if (e.code === 'KeyE' || e.code === 'KeyK') act('sec');
  else if (e.code === 'KeyJ' || e.code === 'Enter') act('main');
  else if (e.code === 'KeyQ' || e.code === 'KeyL' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') act('dive');
  else if (/^(Digit|Numpad)[1-4]$/.test(e.code)) baseTap(+e.code.slice(-1));
});
addEventListener('keyup', (e) => { INPUT.keys[e.code] = false; });
addEventListener('blur', () => { INPUT.keys = {}; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousemove', (e) => {
  INPUT.mouse.nx = (e.clientX / innerWidth) * 2 - 1;
  INPUT.mouse.ny = -(e.clientY / innerHeight) * 2 + 1;
  INPUT.mouse.has = true;
});
canvas.addEventListener('mousedown', (e) => {
  SFX.resume();
  if (!playing()) return;
  if (e.button === 0) act('main');
  else if (e.button === 2) act('dive');
  else if (e.button === 1) { e.preventDefault(); act('sec'); }
});
canvas.style.cursor = 'crosshair';
// táctil: joystick + botones
(() => {
  const zone = $('#joyZone'), joy = $('#joy'), knob = $('#joyKnob');
  let id = null, cx = 0, cy = 0;
  const R = 55;
  zone.addEventListener('pointerdown', (e) => {
    id = e.pointerId; zone.setPointerCapture(id);
    const r = zone.getBoundingClientRect();
    cx = e.clientX; cy = e.clientY;
    joy.style.left = cx - r.left - 65 + 'px'; joy.style.top = cy - r.top - 65 + 'px'; joy.style.bottom = 'auto';
    SFX.resume();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    INPUT.joy.x = dx / R; INPUT.joy.y = -dy / R;
  });
  const end = (e) => { if (e.pointerId !== id) return; id = null; INPUT.joy.x = INPUT.joy.y = 0; knob.style.transform = ''; };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  const bind = (sel, k) => {
    const el = $(sel);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('down'); act(k, 'tb'); });
    const up = () => el.classList.remove('down');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  bind('#tbHit', 'main'); bind('#tbJump', 'alt'); bind('#tbSet', 'sec'); bind('#tbDive', 'dive');
  for (const b of $$('#bd button')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); baseTap(+b.dataset.b); setTimeout(() => b.classList.remove('down'), 160); });
})();
const raycaster = new THREE.Raycaster();
const planeG = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _hit = new THREE.Vector3();
function mouseRay(plane) {
  if (!INPUT.mouse.has || IS_TOUCH) return null;
  raycaster.setFromCamera({ x: INPUT.mouse.nx, y: INPUT.mouse.ny }, camera);
  return raycaster.ray.intersectPlane(plane, _hit);
}
function updateAim(dt, ctx) {
  const m = moveInput();
  if (S.batter !== INPUT.lastBatter) { INPUT.lastBatter = S.batter; INPUT.cur.x = 0; INPUT.cur.y = 0.75; INPUT.power = false; }
  if (ctx === 'bat') {
    if (cursorMode()) {
      // el círculo del bate: ratón sobre la zona (PC) o joystick (móvil)
      const h = CAM.mode === 'bat' ? mouseRay(planeZ) : null;
      if (h) { INPUT.cur.x = clamp(h.x, -0.62, 0.62); INPUT.cur.y = clamp(h.y, 0.25, 1.3); }
      else { INPUT.cur.x = clamp(INPUT.cur.x + m.x * dt * 1.7, -0.62, 0.62); INPUT.cur.y = clamp(INPUT.cur.y + m.y * dt * 1.7, 0.25, 1.3); }
    } else {
      const h = mouseRay(planeG);
      if (h && h.z < -3) INPUT.batAim = clamp(angOf(h.x, h.z), -0.78, 0.78);
      else if (!h) INPUT.batAim = damp(INPUT.batAim, m.x * 0.7, 8, dt);
    }
  } else if (ctx === 'pitch') {
    if (METER.on) return; // la mira queda fija mientras se cierra el aro
    const h = mouseRay(planeZ);
    if (h && CAM.mode === 'pitch') { INPUT.ptx = clamp(h.x, -0.9, 0.9); INPUT.pty = clamp(h.y, 0.15, 1.55); }
    else if (!INPUT.mouse.has || IS_TOUCH) { INPUT.ptx = clamp(INPUT.ptx + m.x * dt * 1.2, -0.9, 0.9); INPUT.pty = clamp(INPUT.pty + m.y * dt * 1.2, 0.15, 1.55); }
  } else if (ctx === 'field') {
    INPUT.throwBase = 0;
    const f = S.ball.holder;
    if (f && f.id === S.ctrlId) {
      const h = mouseRay(planeG);
      if (h) { let bd = 1e9; for (let k = 1; k <= 4; k++) { const d = Math.hypot(BASES[k].x - h.x, BASES[k].z - h.z); if (d < bd) { bd = d; INPUT.throwBase = k; } } }
    }
  }
}
// base a la que se tiraría ahora mismo (para dibujar la mira)
function shownThrowBase(f) {
  if (INPUT.mouse.has && !IS_TOUCH && INPUT.throwBase) return INPUT.throwBase;
  const d = joyDir();
  if (d) return baseByDir(f, d);
  if (S.net === 'client') return 0;
  const P = holderPlan(f);
  return P.base || 1;
}

// ---------- cámara ----------
const CAM = { pos: new THREE.Vector3(0, 30, 40), look: new THREE.Vector3(0, 0, -16), orbit: 0.6, mode: '' };
const _tp = new THREE.Vector3(), _tl = new THREE.Vector3();
const PREVIEW = { x: -5, z: 2.6 };
function camMode() {
  if (GAME.screen === 'scrCustom') return 'custom';
  if (GAME.mode === 'menu' || !S.on) return 'orbit';
  if (S.phase === 'end') return 'field';
  if (S.phase === 'switch' || (S.phase === 'pre' && S.t < 1.3)) return 'overview';
  const atBat = (S.phase === 'pre' || S.phase === 'pitch' || S.phase === 'windup' || S.phase === 'flight') && !S.contactDone;
  const quiet = (S.phase === 'dead' && !S.batted) || (S.phase === 'play' && S.walk);
  if (atBat || quiet) return humanFields() ? 'pitch' : 'bat';
  return 'field';
}
function updateCamera(dt) {
  const portrait = camera.aspect < 0.8;
  const mode = camMode();
  let k = 3.5, fov = portrait ? 64 : 50;
  if (mode === 'custom') {
    const wide = innerWidth > 760;
    _tp.set(PREVIEW.x + (wide ? 1.1 : 0), 1.45, PREVIEW.z + 4.3); _tl.set(PREVIEW.x + (wide ? 1.1 : 0), wide ? 1.0 : 0.62, PREVIEW.z);
    k = 4;
  } else if (mode === 'orbit') {
    CAM.orbit += dt * 0.05;
    const a = CAM.orbit;
    _tl.set(0, 0, -18); _tp.set(Math.sin(a) * 48, 17 + Math.sin(a * 0.7) * 4, -18 + Math.cos(a) * 48);
    k = 1.2;
  } else if (mode === 'overview') {
    _tp.set(0, portrait ? 42 : 30, portrait ? 36 : 27); _tl.set(0, 0, -18); k = 1.8;
  } else if (mode === 'bat') {
    if (portrait) { _tp.set(0.2, 3.7, 9.0); _tl.set(0, 1.0, -9); fov = 60; } else { _tp.set(0.3, 2.85, 6.1); _tl.set(0, 1.05, -9); fov = 46; }
    k = 4;
  } else if (mode === 'pitch') {
    if (portrait) { _tp.set(0.8, 4.6, -18.5); _tl.set(0, 0.85, 0); fov = 46; } else { _tp.set(0.9, 4.4, -17.5); _tl.set(0, 0.95, 0); fov = 27; }
    k = 4;
  } else {
    const b = S.ball;
    let fx = b.x, fz = b.z;
    if (b.holder) { fx = b.holder.x; fz = b.holder.z; }
    if (S.hr && !S.derby && S.t > 2.4) { const lead = S.runners.find(live); if (lead) { const p = runnerPos(lead); fx = p.x; fz = p.z; } else { fx = 0; fz = -4; } }
    if (S.phase === 'end') { fx = 0; fz = -8; }
    fx = clamp(fx, -58, 58); fz = clamp(fz, -72, 6);
    const d = Math.hypot(fx, fz);
    _tl.set(fx * 0.82, 0, fz * 0.82 - 1.5);
    const H = 11.5 + d * 0.2, Dz = 13 + d * 0.1;
    _tp.set(_tl.x * 0.7, portrait ? H * 1.35 : H, _tl.z + (portrait ? Dz * 1.35 : Dz));
    k = 3;
  }
  CAM.mode = mode;
  const kk = 1 - Math.exp(-k * dt);
  const nf = lerp(camera.fov, fov, kk);
  if (Math.abs(nf - camera.fov) > 0.005) { camera.fov = nf; camera.updateProjectionMatrix(); }
  CAM.pos.lerp(_tp, kk); CAM.look.lerp(_tl, kk);
  camera.position.copy(CAM.pos);
  if (GAME.camPunch > 0.01 && GAME.mode !== 'menu') { camera.position.lerp(CAM.look, GAME.camPunch * 0.08); GAME.camPunch *= Math.exp(-5 * dt); }
  if (GAME.shake > 0.001) { camera.position.x += randn() * GAME.shake; camera.position.y += randn() * GAME.shake; GAME.shake *= Math.exp(-10 * dt); }
  camera.lookAt(CAM.look);
  sun.target.position.set(clamp(CAM.look.x, -50, 50), 0, clamp(CAM.look.z, -60, 8));
  sun.position.copy(sun.target.position).add(SUN_OFF);
}

// ---------- dibujar el partido ----------
const _hp = new THREE.Vector3(), _axis = new THREE.Vector3(1, 0, 0);
const VIS = new Set();
function renderGame(dt) {
  const b = S.ball;
  const pitching = S.phase === 'pitch' || S.phase === 'windup' || S.phase === 'flight';
  const ctxU = uiCtx();
  const custom = GAME.screen === 'scrCustom';
  VIS.clear();
  for (const f of fielders()) VIS.add(f.id);
  const brun = S.batter && S.runners.find((r) => r.pl === S.batter && !r.out);
  if (S.batter && !brun && S.phase !== 'switch') VIS.add(S.batter.id);
  for (const r of S.runners) { if (r.out || (r.scored && S.clock - r.scoreT > 1.1)) continue; VIS.add(r.pl.id); }
  for (const p of S.players) {
    const c = GAME.chars.get(p.id);
    if (!c) continue;
    const on = VIS.has(p.id) && !custom;
    c.root.visible = on;
    if (!on) continue;
    if (p.snap) { c.snapYaw = true; p.snap = false; }
    const isF = p.team === fieldTeam();
    const runner = !isF && S.runners.some((r) => r.pl === p && live(r));
    c.setGear(isF ? 'field' : runner || (p.anim !== 'stance' && p.anim !== 'swing' && p.anim !== 'bunt' && S.contactDone) ? 'run' : 'bat');
    const me = p.id === S.ctrlId && humanFields();
    const ctx = { ready: isF && pitching && p.role !== 'P' && p.role !== 'C' && p.anim === 'idle', me };
    let lx = b.x, ly = b.y, lz = b.z;
    if (!isF && S.batter === p && pitching) { ctx.headMax = 1.6; if (b.st === 'held') { lx = MOUND.x; ly = 1.5; lz = MOUND.z; } }
    if (isF && b.st !== 'held' && (S.phase === 'play' || S.phase === 'flight')) {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (p.role === 'C' && S.phase === 'flight') ctx.reach = { x: b.x, y: b.y, z: b.z, w: SM(1 - (POS.C[1] - b.z) / 9) * 0.95 };
      else if (d < 2.4 && b.y < p.y + 3) ctx.reach = { x: b.x, y: b.y, z: b.z, w: SM((2.4 - d) / 1.3) };
    }
    if (p.role === 'C') c.setGhost(isF && CAM.mode === 'bat' ? 0.3 : 1);
    c.foot.material.color.setHex(me ? 0xffd23a : TEAM_HEX[p.team]);
    c.foot.scale.setScalar(me ? 1.45 : 1);
    c.update(dt, p, lx, ly, lz, ctx);
  }
  // pelota
  ballMesh.visible = !custom && !(b.outOfPark && b.st === 'dead');
  if (b.holder && GAME.chars.get(b.holder.id) && GAME.chars.get(b.holder.id).root.visible) {
    const h = b.holder;
    const hand = (h.anim === 'throw' && (h.throwT > 0 || (S.net === 'client' && h.animT < 0.22))) || (h.anim === 'pitch' && S.phase === 'windup' && S.t > 0.3) ? 0 : 1;
    GAME.chars.get(h.id).handPos(hand, _hp);
    ballMesh.position.copy(_hp);
  } else ballMesh.position.set(b.x, b.y, b.z);
  const hs = Math.hypot(b.vx || 0, b.vz || 0), speed = Math.hypot(b.vx || 0, b.vy || 0, b.vz || 0);
  if (!b.holder && speed > 0.3) {
    if (b.st === 'ground') FX.spin = hs / BALL_VIS * 0.9; else if (b.st === 'pitch') FX.spin = 40; else FX.spin = Math.max(FX.spin * Math.exp(-0.5 * dt), 12);
    if (hs > 0.2) _axis.set(b.vz / hs, 0, -b.vx / hs);
    ballMesh.rotateOnWorldAxis(_axis, FX.spin * dt);
  }
  ballShadow.visible = ballMesh.visible && ballMesh.position.y < 30;
  ballShadow.position.set(ballMesh.position.x, 0.02 + groundY(ballMesh.position.x, ballMesh.position.z), ballMesh.position.z);
  ballShadow.scale.setScalar(1 + ballMesh.position.y * 0.1);
  ballShadow.material.opacity = clamp(0.45 - ballMesh.position.y * 0.03, 0.1, 0.45);
  FX.fireT = Math.max(0, FX.fireT - dt);
  updateTrail(ballMesh.position.x, ballMesh.position.y, ballMesh.position.z, b.holder ? 0 : speed, FX.fireT > 0 && !b.holder);
  if (FX.fireT > 0 && !b.holder && b.st === 'air') spawnPart(b.x + rand(-0.1, 0.1), b.y, b.z + rand(-0.1, 0.1), rand(-0.5, 0.5), rand(0.3, 1.2), rand(-0.5, 0.5), rand(0.3, 0.5), pick([0xff7a1a, 0xffc93a, 0xff4a1a]), rand(0.15, 0.3));
  // fuegos artificiales en los jonrones
  if (FX.fwT > 0) { FX.fwT -= dt; FX.fwNext -= dt; if (FX.fwNext <= 0) { FX.fwNext = rand(0.18, 0.4); fireworks(rand(-40, 40), rand(22, 34), rand(-75, -55)); SFX.firework(); } }
  // marcador de caída (elevados)
  FX.landT -= dt;
  const showLand = S.phase === 'play' && !b.holder && b.st === 'air' && !b.bounced && !b.outOfPark && S.batted && !custom;
  if (showLand && FX.landT <= 0) {
    FX.landT = 0.1;
    const path = predictPath(b, 5);
    FX.land = path.find((q) => !q.air) || null;
  }
  landMark.visible = showLand && !!FX.land;
  if (landMark.visible) {
    landMark.position.x = FX.land.x; landMark.position.z = FX.land.z;
    const col = humanFields() ? 0xffd23a : TEAM_HEX[fieldTeam()];
    landMark.userData.mat.color.setHex(col); landMark.userData.outer.material.color.setHex(col);
    const k = clamp((FX.land.t || 1) / 1.5, 0, 1);
    landMark.userData.ring.scale.setScalar(0.6 + k);
    landMark.userData.outer.scale.setScalar(1 + Math.sin(performance.now() / 90) * 0.06);
  }
  // zona, miras y ayudas
  const camAtPlate = CAM.mode === 'bat' || CAM.mode === 'pitch';
  zoneGrp.visible = pitching && camAtPlate && !custom && !S.demo;
  pitchMark.visible = pitchDot.visible = ctxU === 'pitch';
  if (pitchMark.visible) {
    pitchMark.position.set(INPUT.ptx, INPUT.pty, 0.02); pitchDot.position.copy(pitchMark.position);
    const inZ = Math.abs(INPUT.ptx) <= ZONE.x + BALL_R && INPUT.pty >= ZONE.y0 - BALL_R && INPUT.pty <= ZONE.y1 + BALL_R;
    pitchMark.material.color.setHex(inZ ? 0xffd23a : 0x9fe3ff); pitchDot.material.color.copy(pitchMark.material.color);
    pitchMark.scale.setScalar(METER.on ? 1 : 1 + Math.sin(performance.now() / 120) * 0.08);
  }
  meterRing.visible = meterGoal.visible = ctxU === 'pitch' && METER.on;
  if (meterRing.visible) {
    const r = meterR();
    meterRing.position.set(INPUT.ptx, INPUT.pty, 0.03); meterGoal.position.copy(meterRing.position);
    meterRing.scale.setScalar(r);
    meterRing.material.color.setHex(Math.abs(r - 0.1) < 0.045 ? 0x7dffb0 : r < 0.1 ? 0xff6b6b : 0xffe14d);
  }
  batCursor.visible = ctxU === 'bat' && cursorMode() && camAtPlate && !custom;
  if (batCursor.visible) {
    const R = CURSOR_R[INPUT.power ? 'power' : 'normal'] + BALL_R;
    batCursor.position.set(INPUT.cur.x, INPUT.cur.y, 0.05);
    batCursor.scale.setScalar(R);
    const col = INPUT.power ? 0xff8a2f : 0xffe14d;
    batCursor.userData.mat.color.setHex(col); batCursor.userData.fill.color.setHex(col);
    batCursor.userData.mat.opacity = S.swing || (S.net === 'client' && CL.swingSent) ? 0.4 : 0.95;
  }
  const help = SAVE.help && ctxU === 'bat' && S.pitch && S.pitch.cross && pitchLive();
  if (help) {
    const p = S.pitch, el = (S.clock - p.t0) / p.tC;
    crossMark.visible = timingRing.visible = el > 0.3;
    crossMark.position.set(p.cross.x, p.cross.y, 0.03); timingRing.position.copy(crossMark.position);
    crossMark.material.color.setHex(p.strike ? 0x7dffb0 : 0xffffff);
    const rem = p.tContactAbs - SWING_DT - S.clock;
    timingRing.scale.setScalar(1 + clamp(rem, 0, 0.7) * 7);
    timingRing.material.color.setHex(Math.abs(rem) < 0.035 ? 0x7dffb0 : 0xffd23a);
    if (rem < -0.1) timingRing.visible = false;
  } else crossMark.visible = timingRing.visible = false;
  let aimOn = false, selBase = 0;
  aimWedge.visible = ctxU === 'bat' && !cursorMode() && !custom;
  if (aimWedge.visible) { aimWedge.rotation.y = -INPUT.batAim; aimWedge.material.opacity = S.phase === 'flight' ? 0.55 : 1; }
  if (ctxU === 'bat') {
    // (la flecha del suelo hace de mira)
  } else if (ctxU === 'field' && b.holder && b.holder.id === S.ctrlId) {
    selBase = shownThrowBase(b.holder);
    if (selBase) { aimOn = true; aimMark.position.x = BASES[selBase].x; aimMark.position.z = BASES[selBase].z; aimMark.scale.setScalar(1); aimMark.userData.mat.color.setHex(0xffd23a); }
  }
  aimMark.visible = aimOn && !custom;
  if (aimOn) aimMark.rotation.y += dt * 1.5;
  for (let k = 1; k <= 4; k++) {
    const m = baseRings[k];
    m.visible = ctxU === 'field' && b.holder && b.holder.id === S.ctrlId;
    if (m.visible) { m.material.opacity = k === selBase ? 0.95 : 0.35; m.scale.setScalar(k === selBase ? 1.2 + Math.sin(performance.now() / 100) * 0.08 : 1); }
  }
  // etiquetas
  const mode = SAVE.tags || 'auto';
  for (const p of S.players) {
    const t = GAME.tags.get(p.id);
    if (!t) continue;
    const c = GAME.chars.get(p.id);
    let want = false;
    if (c && c.root.visible && GAME.mode !== 'menu' && !custom && S.phase !== 'end') {
      const isRunner = S.runners.some((r) => r.pl === p && live(r));
      const key = p.id === S.ctrlId || (p === S.batter && pitching) || isRunner || p.captain;
      want = mode === 'todos' || (mode === 'auto' && key) || (mode === 'ninguno' && p.id === S.ctrlId);
    }
    if (!want) { t.style.display = 'none'; continue; }
    const s = worldToScreen(p.x, p.y + 2.05 + groundY(p.x, p.z), p.z);
    if (!s.vis) { t.style.display = 'none'; continue; }
    t.style.display = '';
    const isMe = p.id === S.ctrlId && humanFields();
    t.classList.toggle('me', isMe || p.id === S.avatarId);
    const d = camera.position.distanceTo(_tagV.set(p.x, p.y + 2, p.z));
    const sc = isMe ? 1 : clamp(18 / d, 0.62, 1);
    t.style.transform = `translate(${s.x | 0}px,${s.y | 0}px) translate(-50%,-100%) scale(${sc.toFixed(2)})`;
  }
  // marcador gigante
  const key = `${S.score[0]}|${S.score[1]}|${S.inning}|${S.half}|${S.outs}|${S.derbyHr}|${S.derby}`;
  if (key !== BOARD.key) { BOARD.key = key; drawBoard(S); }
}

// ---------- HUD ----------
const HUD = { sA: $('#sA'), sB: $('#sB'), pA: $('#pA'), pB: $('#pB'), inn: $('#inn'), hint: $('#hint'), banner: $('#banner'), last: [0, 0], ctx: '', card: '' };
const DIA = { 1: $('#dia .b1'), 2: $('#dia .b2'), 3: $('#dia .b3') };
const CNT = { bl: $$('#cnt .bl i'), st: $$('#cnt .st i'), ou: $$('#cnt .ou i') };
const TB = { hit: $('#tbHit'), jump: $('#tbJump'), set: $('#tbSet'), dive: $('#tbDive') };
const TB_LAYOUT = {
  bat: { hit: ['BATEAR', '#ff4f9a'], jump: ['PODER', '#ff7a2f'], set: ['TOQUE', '#ffb21e'] },
  run: { hit: ['CORRER', '#2fd27a'], set: ['VOLVER', '#8a93b5'] },
  pitch: { hit: ['RECTA', '#3a7bff'], jump: ['CURVA', '#a24bff'], set: ['SLIDER', '#ff7a2f'], dive: ['CAMBIO', '#18b6a5'] },
  field: { hit: ['LANZAR', '#ff4f9a'], jump: ['SALTO', '#3a7bff'], dive: ['PLANCHA', '#8a6bff'] },
  none: {},
};
function cardHtml(ctx) {
  if (ctx === 'bat') return cursorMode()
    ? `<div class="ttl">Al bate</div><div><b>Ratón</b> mueve el círculo del bate</div><div><b>Clic</b> batear</div><div><b>Espacio</b> modo poder: ${INPUT.power ? '<span style="color:#ff7a2f">ON</span>' : 'off'}</div><div><b>E</b> toque de bola</div><div><b>2 3 4</b> robar base</div>`
    : '<div class="ttl">Al bate</div><div><b>Ratón</b> apunta el batazo</div><div><b>Clic</b> batear</div><div><b>Espacio</b> batazo de poder</div><div><b>E</b> toque de bola</div><div><b>2 3 4</b> robar base</div>';
  if (ctx === 'run') return '<div class="ttl">Corriendo</div><div><b>Clic · Espacio</b> todos ¡corren!</div><div><b>E · Clic der</b> todos ¡vuelven!</div><div><b>1 2 3 4</b> manda a un corredor a esa base</div>';
  if (ctx === 'pitch') return '<div class="ttl">Lanzando</div><div><b>Ratón</b> apunta en la zona</div>' + PITCH_KEYS.map((k, i) => `<div${k === INPUT.pitchKind ? ' style="color:#2453b8;font-weight:700"' : ''}><b>${i + 1}</b> ${PITCHES[k].name}${k === INPUT.pitchKind ? ' ◀' : ''}</div>`).join('') + '<div><b>Clic</b> lanzar: suelta cuando el aro<br>se cierre en el centro verde</div>';
  if (ctx === 'field') return '<div class="ttl">Defendiendo</div><div><b>WASD</b> correr (si no, va solo)</div><div><b>1 2 3 4</b> tirar a esa base</div><div><b>Clic</b> tirar a la base que apuntas</div><div><b>Espacio</b> saltar · <b>Clic der</b> plancha</div>';
  return '';
}
function hintText(ctx) {
  if (ctx === 'bat') {
    if (S.phase === 'flight' || pitchLive()) return '';
    if (S.derby) return IS_TOUCH ? 'Batea cuando llegue la pelota · PODER = más fuerte' : 'Clic = batear · Espacio = batazo de poder (¡a la calle!)';
    if (cursorMode()) return IS_TOUCH ? 'Joystick = mueve el círculo hacia la pelota · BATEAR · PODER = círculo pequeño y fuerte' : 'Pon el círculo donde va a pasar la pelota y haz clic · Espacio = modo poder';
    return IS_TOUCH ? 'Joystick = apuntar · BATEAR cuando llegue (PODER = más fuerte)' : 'Apunta con el ratón · clic = batear · Espacio = poder · E = toque';
  }
  if (ctx === 'run') return IS_TOUCH ? 'CORRER / VOLVER = todos · toca una base del rombo = un corredor' : 'Clic / Espacio = ¡corren! · E = ¡vuelven! · 1-4 = un corredor';
  if (ctx === 'pitch') {
    if (METER.on) return IS_TOUCH ? '¡Toca otra vez cuando el aro llegue al círculo verde!' : '¡Clic otra vez cuando el aro llegue al círculo verde!';
    return IS_TOUCH ? 'Joystick = apuntar · toca un lanzamiento para empezar el aro' : `Apunta · 1-4 = lanzamiento (${PITCHES[INPUT.pitchKind].name}) · clic = empezar el aro`;
  }
  if (ctx === 'field') {
    const f = S.ball.holder;
    if (f && f.id === S.ctrlId) return IS_TOUCH ? 'Toca una base del rombo para tirar' : 'Tira con 1 2 3 4 o apuntando con el ratón + clic';
    return IS_TOUCH ? '¡A la pelota! Puedes elegir la base del rombo antes de atrapar' : 'WASD = correr (si no, va solo) · 1-4 = tiro preparado';
  }
  return '';
}
// rombo de bases (arriba a la izquierda): tirar, mandar corredores, robar o elegir lanzamiento
const DMD = { el: $('#bd'), cap: $('#bdCap'), btn: {} };
for (const b of $$('#bd button')) DMD.btn[b.dataset.b] = b;
function updateDiamond(ctx) {
  let mode = '';
  const runnerOn = (k) => S.runners.some((r) => live(r) && standing(r) && Math.round(r.p) === k);
  if (ctx === 'field') mode = 'throw';
  else if (ctx === 'run') mode = 'run';
  else if (ctx === 'bat' && !S.derby && (runnerOn(1) || runnerOn(2) || runnerOn(3))) mode = 'steal';
  else if (ctx === 'pitch' && !IS_TOUCH) mode = 'pitch';
  DMD.el.className = mode ? 'on ' + mode : '';
  if (!mode) return;
  DMD.cap.textContent ={ throw: 'TIRAR A…', run: 'CORREDORES', steal: 'ROBAR BASE', pitch: 'LANZAMIENTO' }[mode];
  const sel = mode === 'throw' && S.ball.holder && S.ball.holder.id === S.ctrlId ? shownThrowBase(S.ball.holder) : mode === 'throw' && S.queued ? S.queued.base : 0;
  for (let k = 1; k <= 4; k++) {
    const b = DMD.btn[k];
    let lab = k === 4 ? 'H' : k + 'ª', cls = '';
    if (mode === 'pitch') { lab = PITCHES[PITCH_KEYS[k - 1]].name.slice(0, 6); cls = PITCH_KEYS[k - 1] === INPUT.pitchKind ? 'sel' : ''; }
    else {
      if (k < 4 && runnerOn(k)) cls = 'runner';
      if (mode === 'steal') { const r = k > 1 && S.runners.find((o) => live(o) && standing(o) && Math.round(o.p) === k - 1); if (r && !runnerOn(k)) cls += r.steal || r.stealing ? ' sel' : ' can'; }
      if (mode === 'throw' && k === sel) cls += ' sel';
      if (mode === 'run') { const mv = S.runners.find((o) => live(o) && !standing(o) && Math.abs(o.target - k) < 1e-6); if (mv) cls += ' can'; }
    }
    if (b.textContent !== lab) b.textContent = lab;
    if (b.dataset.cls !== cls) { b.dataset.cls = cls; b.className = cls; }
  }
}
function updateHud(ctx) {
  if (S.score[0] !== HUD.last[0]) { HUD.pA.classList.remove('bump'); void HUD.pA.offsetWidth; HUD.pA.classList.add('bump'); }
  if (S.score[1] !== HUD.last[1]) { HUD.pB.classList.remove('bump'); void HUD.pB.offsetWidth; HUD.pB.classList.add('bump'); }
  HUD.last = [S.score[0], S.score[1]];
  HUD.sA.textContent = S.score[0]; HUD.sB.textContent = S.score[1];
  HUD.pA.classList.toggle('bat', S.half === 0); HUD.pB.classList.toggle('bat', S.half === 1);
  HUD.inn.innerHTML = S.derby ? '💥<small>DERBY</small>' : `${S.half ? '▼' : '▲'}${S.inning}<small>ENTRADA</small>`;
  for (let k = 1; k <= 3; k++) DIA[k].classList.toggle('on', S.runners.some((r) => live(r) && standing(r) && Math.round(r.p) === k));
  CNT.bl.forEach((d, i) => d.classList.toggle('on', i < S.balls));
  CNT.st.forEach((d, i) => d.classList.toggle('on', i < S.strikes));
  CNT.ou.forEach((d, i) => d.classList.toggle('on', i < S.outs));
  if (S.derby) { $('#dHr').textContent = S.derbyHr; $('#dOuts').textContent = `Fallos: ${S.derbyOuts} / ${S.derbyMax}`; }
  const h = hintText(ctx);
  if (HUD.hint.textContent !== h) HUD.hint.textContent = h;
  HUD.hint.classList.toggle('on', !!h);
  updateDiamond(ctx);
  const key = ctx + (ctx === 'bat' ? INPUT.power : ctx === 'pitch' ? INPUT.pitchKind + METER.on : '');
  if (key !== HUD.ctx) {
    HUD.ctx = key;
    const L = TB_LAYOUT[ctx] || {};
    for (const k of ['hit', 'jump', 'set', 'dive']) {
      const el = TB[k], v = L[k];
      el.classList.toggle('off', !v);
      if (v) { el.textContent = v[0]; el.style.background = v[1]; }
      el.classList.remove('lit');
    }
    if (ctx === 'bat' && cursorMode()) { TB.jump.textContent = INPUT.power ? 'PODER ON' : 'PODER'; TB.jump.classList.toggle('lit', INPUT.power); }
    if (ctx === 'pitch' && METER.on) for (const k of ['hit', 'jump', 'set', 'dive']) TB[k].classList.toggle('lit', TB_LAYOUT.pitch[k][0] === PITCHES[METER.kind].name.toUpperCase());
    const card = $('#ctrlCard');
    const html = cardHtml(ctx);
    if (html) { card.innerHTML = html; card.style.opacity = 1; card.style.display = IS_TOUCH ? 'none' : ''; }
    else card.style.opacity = 0;
  }
}
function showBanner(text, sub, color) {
  const b = HUD.banner;
  b.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
  b.style.color = color || '#fff';
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function popText(x, y, z, text, cls) {
  const s = worldToScreen(x, y, z);
  if (!s.vis) return;
  const d = document.createElement('div');
  d.className = 'pop ' + (cls || '');
  d.textContent = text;
  d.style.left = clamp(s.x, 60, innerWidth - 60) + 'px'; d.style.top = clamp(s.y, 90, innerHeight - 40) + 'px';
  $('#pops').appendChild(d);
  setTimeout(() => d.remove(), 1100);
}
let toastT = null;
function buzz(p) { if (IS_TOUCH && SAVE.vib !== false && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* sin vibración */ } }
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), ms);
}

// ---------- eventos → sonido, partículas y textos ----------
function handleEvent(e) {
  if (window.__JPlog) window.__JPlog.push(Object.assign({ c: +S.clock.toFixed(2), ph: S.phase }, e, e.r ? { r: undefined } : {}));
  if (S.demo) { if (e.type === 'end') setTimeout(() => { if (GAME.mode === 'menu') startDemo(); }, 600); return; }
  const mine = (team) => team === S.me;
  const b = S.ball;
  switch (e.type) {
    case 'half': {
      const bt = batTeam();
      if (S.derby) showBanner('¡DERBY DE JONRONES!', `${S.derbyMax} fallos y se acaba`, '#ffe14d');
      else showBanner(`${S.half ? '▼' : '▲'} ${S.inning}ª ENTRADA`, bt === S.me ? '¡Te toca batear!' : 'Te toca lanzar y defender', TEAM_CSS[bt]);
      if (bt === S.me) SFX.organ();
      break;
    }
    case 'pitch': SFX.swish(0.45); break;
    case 'swing': SFX.swish(1); if (e.far && humanBats() && S.net !== 'client') popText(INPUT.cur.x, INPUT.cur.y + 0.3, 0, '¡LEJOS!', 'bad'); break;
    case 'steal': popText(BASES[2].x * 0.5, 2.2, BASES[2].z * 0.5, '¡ROBO!', mine(e.team) ? 'good' : 'bad'); SFX.cheer(0.4); break;
    case 'stealArm': if (S.net !== 'client') popText(BASES[e.base].x, 2, BASES[e.base].z, e.on ? 'ROBO LISTO' : 'SIN ROBO', 'good'); break;
    case 'queued': if (mine(e.team)) popText(BASES[e.base].x, 2, BASES[e.base].z, 'TIRO A ' + (e.base === 4 ? 'HOME' : e.base + 'ª'), 'good'); break;
    case 'crack': {
      SFX.crack(clamp(e.q, 0.2, 1));
      CHEER.t = Math.max(CHEER.t, e.q * 1.2);
      if (e.grade === 'perfect') {
        popText(e.x, e.y + 0.7, e.z, '¡PERFECTO!', 'perfect'); SFX.perfect(); sparks(e.x, e.y, e.z, 18);
        shockwave(e.x, e.y, e.z); GAME.hitStop = 0.07; GAME.shake = 0.12; GAME.camPunch = 1; FX.fireT = e.kind === 'power' ? 1.6 : 0.9; buzz(30);
      } else if (e.grade === 'good') { popText(e.x, e.y + 0.7, e.z, 'BIEN', 'good'); sparks(e.x, e.y, e.z, 8, 0xffffff); }
      else if (e.grade === 'weak') popText(e.x, e.y + 0.7, e.z, 'DÉBIL', 'bad');
      break;
    }
    case 'whiff': if (humanBats() && S.swing) popText(0, 1.4, CONTACT_Z, e.early ? '¡MUY TEMPRANO!' : '¡TARDE!', 'bad'); break;
    case 'call':
      if (e.call === 'ball') { SFX.ballCall(); popText(0, 1.75, 0, 'BOLA', humanBats() ? 'good' : ''); }
      else { SFX.strike(); popText(0, 1.75, 0, '¡STRIKE!', humanFields() ? 'perfect' : 'bad'); }
      break;
    case 'pop': SFX.pop(); break;
    case 'k': showBanner('¡PONCHADO!', mine(e.team) ? 'Te sentaron, ¡a la próxima!' : '¡Lo dejaste mirando!', mine(e.team) ? '#ff9a9a' : '#ffe14d'); SFX.point(!mine(e.team)); if (!mine(e.team)) { CHEER.t = 1.2; SFX.cheer(0.6); } break;
    case 'walk': popText(0, 1.9, 0, 'BASE POR BOLAS', mine(e.team) ? 'good' : 'bad'); break;
    case 'foul': popText(b.x, b.y + 0.6, b.z, 'FOUL', 'bad'); SFX.foul(); break;
    case 'bounce': SFX.bounce(clamp(e.v / 12, 0.2, 1)); puff(e.x, 0, e.z, 4, DUST, 0.45, 1.4, 0.8); break;
    case 'wall': SFX.wall(); puff(e.x, e.y, e.z, 8, 0xffffff, 0.6, 2, 1); GAME.shake = 0.06; break;
    case 'catch':
      SFX.pop();
      if (e.fly && !S.derby) { popText(e.x, e.y + 0.9, e.z, '¡ATRAPADA!', mine(e.team) ? 'perfect' : 'bad'); if (mine(e.team)) buzz(25); }
      break;
    case 'throw': SFX.swish(0.6); break;
    case 'out': {
      const good = !mine(e.team);
      popText(e.x, 2.2, e.z, e.n >= 2 ? '¡DOBLE PLAY!' : '¡OUT!', good ? 'perfect' : 'bad');
      if (e.n === 2) { showBanner('¡DOBLE PLAY!', '', good ? '#ffe14d' : '#ff9a9a'); if (good) { SFX.cheer(1); CHEER.t = 1.5; } }
      SFX.point(good); puff(e.x, 0.2, e.z, 8, DUST, 0.6, 2, 1);
      break;
    }
    case 'run':
      popText(0, 2.4, 0, '+1 CARRERA', mine(e.team) ? 'perfect' : 'bad');
      SFX.point(mine(e.team));
      if (mine(e.team)) { SFX.cheer(0.8); CHEER.t = 1.6; confetti(0, -1, 40, 4); buzz(40); }
      break;
    case 'hr':
      showBanner('¡JONRÓN!', `${e.dist} metros`, '#ffe14d');
      SFX.hype(); SFX.cheer(1.3); CHEER.t = 3.8; GAME.slowmo = 0.55; FX.fwT = 2.6; FX.fwNext = 0.2;
      confetti(0, -8, 150, 10); buzz([40, 60, 90]);
      break;
    case 'hitType':
      if (e.bases < 4) showBanner(['', '¡SENCILLO!', '¡DOBLE!', '¡TRIPLE!'][e.bases], '', TEAM_CSS[e.team]);
      if (mine(e.team)) { CHEER.t = Math.max(CHEER.t, 1.2); SFX.cheer(0.5); }
      break;
    case 'switch':
      showBanner('CAMBIO', e.capHit ? `Máximo de ${RUN_CAP} carreras por entrada` : `${TEAM_NAME[0]} ${S.score[0]} - ${S.score[1]} ${TEAM_NAME[1]}`);
      SFX.ui();
      break;
    case 'noRun': toast('La carrera no cuenta: el tercer out fue forzado', 2600); break;
    case 'slide': SFX.slide(); break;
    case 'jump': SFX.jump(); break;
    case 'dive': SFX.dive(); break;
    case 'derbyMiss': popText(b.x, b.y + 1, b.z, `FALLO ${S.derbyOuts}/${S.derbyMax}`, 'bad'); break;
    case 'runCmd': SFX.ui(); popText(0, 2, -BD, e.dir > 0 ? '¡CORRE!' : '¡VUELVE!', 'good'); break;
    case 'end': if (S.net === 'client') break; if (S.net === 'host') netSendEnd(); showEndScreen(); break;
  }
}

// ---------- pantallas ----------
function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
  const prev = GAME.screen;
  GAME.screen = id || '';
  if (id === 'scrMenu') refreshMenu();
  if (id === 'scrSetup') syncChips();
  if (id === 'scrHelp' && !SAVE.seenHelp) { SAVE.seenHelp = true; storeSave(); }
  if (id === 'scrCustom' && prev !== 'scrCustom') openCustom();
  if (id !== 'scrCustom' && prev === 'scrCustom') closeCustom();
}
function refreshMenu() {
  $('#mLvl').textContent = SAVE.level;
  $('#mName').textContent = SAVE.name;
  const need = xpNeed(SAVE.level);
  $('#mXp').style.width = Math.round((SAVE.xp / need) * 100) + '%';
  $('#mXpTxt').textContent = `${SAVE.xp} / ${need} XP para el nivel ${SAVE.level + 1}`;
  $('#mStats').textContent = SAVE.games ? `🏆 ${SAVE.wins} victorias · 🔥 racha ${SAVE.streak}` + (SAVE.derbyBest ? ` · 💥 ${SAVE.derbyBest}` : '') : SAVE.derbyBest ? `💥 Récord del derby: ${SAVE.derbyBest}` : '¡Juega tu primer partido!';
  $('#bMute').textContent = SFX.muted ? '🔇' : '🔊';
  $('#helpBadge').style.display = SAVE.seenHelp ? 'none' : '';
}
function syncChips() {
  $$('[data-opt]').forEach((row) => {
    const k = row.dataset.opt;
    row.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', c.dataset.v === String(SAVE[k])));
  });
}
function toggleMute() {
  SFX.muted = !SFX.muted; SAVE.muted = SFX.muted; storeSave();
  $('#bMute').textContent = SFX.muted ? '🔇' : '🔊';
  toast(SFX.muted ? 'Sonido apagado' : 'Sonido encendido', 1200);
}
function togglePause() {
  if (GAME.mode === 'menu') { if (!['scrMenu', 'scrLobby'].includes(GAME.screen)) showScreen(NET.role === 'off' ? 'scrMenu' : 'scrLobby'); return; }
  if (GAME.screen === 'scrEnd') return;
  GAME.paused = !GAME.paused;
  syncPauseBtns();
  $('#bResume').textContent = S.online ? 'Volver al partido (sigue en línea)' : 'Continuar';
  showScreen(GAME.paused ? 'scrPause' : null);
}
// opts (en línea): { net, me, ctl, remote, captains, roster, throwMode, settings }
function startGame(derby, opts) {
  GAME.mode = opts ? 'online' : derby ? 'derby' : 'game';
  GAME.paused = false;
  const settings = opts ? opts.settings : { innings: SAVE.innings, diff: SAVE.diff, venue: SAVE.venue, help: !!SAVE.help };
  setVenue(settings.venue);
  newGame(Object.assign({ settings, derby }, opts || {}));
  if (opts && opts.net === 'client') clientInitMatch(opts);
  buildCharacters();
  METER.on = false; INPUT.power = false; INPUT.pitchKind = 'recta';
  showScreen(null);
  $('#hud').classList.add('on');
  $('#touchUI').classList.toggle('on', IS_TOUCH);
  document.body.classList.toggle('derby', derby);
  HUD.last = [0, 0]; HUD.ctx = '?';
  CAM.pos.set(0, 34, 34);
  INPUT.batAim = 0; INPUT.ptx = 0; INPUT.pty = 0.75;
  SFX.resume();
  if (IS_TOUCH && innerHeight > innerWidth) toast('📱 Gira el teléfono en horizontal para ver mejor el campo', 3500);
}
function startDemo() {
  GAME.mode = 'menu';
  setVenue(SAVE.venue);
  newGame({ settings: { innings: 99, diff: 1, venue: SAVE.venue, help: false }, demo: true });
  buildCharacters();
}
function leaveToMenu() {
  netReset();
  GAME.paused = false;
  $('#hud').classList.remove('on');
  $('#touchUI').classList.remove('on');
  document.body.classList.remove('derby');
  startDemo();
  showScreen('scrMenu');
}

// ---------- pantalla final + experiencia ----------
function grantXp(xp, oldLv) {
  SAVE.xp += xp;
  while (SAVE.xp >= xpNeed(SAVE.level)) { SAVE.xp -= xpNeed(SAVE.level); SAVE.level++; }
  storeSave();
  $('#eLvl').textContent = SAVE.level;
  $('#eXp').style.width = '0%';
  setTimeout(() => { $('#eXp').style.width = Math.round((SAVE.xp / xpNeed(SAVE.level)) * 100) + '%'; }, 350);
  $('#eXpTxt').textContent = `${SAVE.xp} / ${xpNeed(SAVE.level)} XP para el nivel ${SAVE.level + 1}`;
  const unlocks = [];
  for (const k of Object.keys(OPTS)) for (const o of OPTS[k]) if (o.lv > oldLv && o.lv <= SAVE.level) unlocks.push(`${OPT_LABEL[k]}: ${o.n || '<span style="display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:middle;background:' + o.v + '"></span>'}`);
  $('#eUnlocks').innerHTML = (SAVE.level > oldLv ? `<div class="unlock">⬆️ ¡Subiste al nivel ${SAVE.level}!</div>` : '') + unlocks.map((u) => `<div class="unlock">🔓 Nuevo — ${u}</div>`).join('');
  if (SAVE.level > oldLv) SFX.levelUp();
}
function showEndScreen() {
  setTimeout(() => {
    if (GAME.mode === 'menu') return;
    const oldLv = SAVE.level;
    if (S.derby) {
      const rec = S.derbyHr > SAVE.derbyBest;
      SAVE.derbyBest = Math.max(SAVE.derbyBest, S.derbyHr); SAVE.derbyLong = Math.max(SAVE.derbyLong || 0, S.derbyLong); SAVE.hrTotal += S.derbyHr;
      $('#eTitle').textContent = rec && S.derbyHr > 0 ? '💥 ¡NUEVO RÉCORD!' : '💥 Derby terminado';
      $('#eTitle').style.color = '#ff7a2f';
      $('#eScore').innerHTML = `<span style="background:#ff7a2f">${S.derbyHr} jonrón${S.derbyHr === 1 ? '' : 'es'}</span>`;
      $('#eLine').innerHTML = '';
      $('#eMvp').innerHTML = `🏆 Tu récord: <b>${SAVE.derbyBest}</b>` + (S.derbyLong ? ` · el más largo de hoy: <b>${S.derbyLong} m</b>` : '') + (SAVE.derbyLong ? ` · histórico: ${SAVE.derbyLong} m` : '');
      $('#eTable').innerHTML = '';
      const xp = Math.round(25 + S.derbyHr * 18 + (rec ? 40 : 0));
      $('#eXpGain').textContent = `+${xp} XP` + (rec ? ' · ¡récord!' : '');
      grantXp(xp, oldLv);
      if (rec && S.derbyHr > 0) { confetti(0, -4, 160, 8); SFX.levelUp(); }
      $('#bAgain').textContent = '💥 Otra ronda';
    } else {
      const me = Math.max(0, S.me), op = 1 - me;
      const won = S.score[me] > S.score[op], tie = S.score[me] === S.score[op];
      $('#eTitle').textContent = won ? '¡VICTORIA!' : tie ? 'Empate' : 'Derrota';
      $('#eTitle').style.color = won ? TEAM_CSS[me] : '#8a93b5';
      $('#eScore').innerHTML = `<span style="background:${TEAM_CSS[0]}">${S.score[0]}</span> - <span style="background:${TEAM_CSS[1]}">${S.score[1]}</span>`;
      const n = Math.max(S.innings, S.inning);
      let html = '<tr><th>Equipo</th>' + [...Array(n)].map((_, i) => `<th>${i + 1}</th>`).join('') + '<th>C</th><th>H</th></tr>';
      for (let t = 0; t < 2; t++) html += `<tr><td><span style="color:${TEAM_CSS[t]}">●</span> ${TEAM_NAME[t]}</td>` + [...Array(n)].map((_, i) => `<td>${S.line[t][i] ?? 'x'}</td>`).join('') + `<td class="tot">${S.score[t]}</td><td class="tot">${S.hits[t]}</td></tr>`;
      $('#eLine').innerHTML = html;
      const val = (s) => s.h * 2 + s.hr * 4 + s.rbi * 2 + s.r + s.pk * 1.5 - s.k * 0.5;
      const mvp = S.players.slice().sort((a, c) => val(c.stats) - val(a.stats))[0];
      $('#eMvp').innerHTML = `⭐ MVP: <b style="color:${TEAM_CSS[mvp.team]}">${escapeHtml(mvp.name)}</b>${mvp.id === S.avatarId ? ' — ¡eres tú!' : ''}` + (mvp.stats.hr ? ` · ${mvp.stats.hr} HR` : '') + (mvp.stats.pk ? ` · ${mvp.stats.pk} ponches` : '');
      const rows = S.teams[me];
      $('#eTable').innerHTML = `<tr><th>${TEAM_NAME[me]}</th><th>VB</th><th>H</th><th>HR</th><th>CI</th><th>CA</th><th>K</th></tr>` +
        rows.map((p) => `<tr class="${p.id === S.avatarId ? 'me' : ''}"><td>${escapeHtml(p.name)} <small style="opacity:.55">${p.role}</small></td><td>${p.stats.ab}</td><td>${p.stats.h}</td><td>${p.stats.hr}</td><td>${p.stats.rbi}</td><td>${p.stats.r}</td><td>${p.stats.k}</td></tr>`).join('') +
        `<tr><td colspan="7" style="text-align:center;opacity:.7;font-size:13px">🎯 Ponches de tu lanzador: <b>${S.teams[me][0].stats.pk}</b></td></tr>`;
      const T = S.teams[me].reduce((a, p) => ({ h: a.h + p.stats.h, hr: a.hr + p.stats.hr }), { h: 0, hr: 0 });
      let xp = 60 + (won ? 120 : tie ? 40 : 0) + S.score[me] * 12 + T.h * 6 + T.hr * 25 + S.teams[me][0].stats.pk * 8;
      if (mvp.id === S.avatarId) xp += 50;
      xp *= S.online ? 1.3 : [0.7, 1, 1.4][S.settings.diff] || 1;
      SAVE.games++;
      if (won) { SAVE.wins++; SAVE.streak++; SAVE.best = Math.max(SAVE.best, SAVE.streak); } else SAVE.streak = 0;
      if (won && SAVE.streak >= 2) xp += SAVE.streak * 15;
      SAVE.hrTotal += T.hr;
      xp = Math.round(xp);
      $('#eXpGain').textContent = `+${xp} XP` + (won && SAVE.streak >= 2 ? ` · 🔥 racha de ${SAVE.streak}` : '');
      grantXp(xp, oldLv);
      if (won) { confetti(0, -4, 160, 8); SFX.cheer(1); CHEER.t = 3; if (S.net !== 'client') for (const p of S.teams[me]) { p.anim = 'cheer'; p.animT = 0; } }
      $('#bAgain').textContent = S.net === 'client' ? 'Esperando al anfitrión…' : '¡Revancha!';
      $('#bAgain').disabled = S.net === 'client';
    }
    $('#bEndMenu').textContent = S.online ? 'Salir de la sala' : 'Menú';
    $('#bToLobby').style.display = S.net === 'host' ? '' : 'none';
    showScreen('scrEnd');
  }, 1700);
}
$('#bAgain').onclick = () => { SFX.ui(); if (S.net === 'host') hostStart(); else startGame(GAME.mode === 'derby'); };
$('#bEndMenu').onclick = () => { SFX.ui(); leaveToMenu(); };
$('#bToLobby').onclick = () => { SFX.ui(); netSendAll({ t: 'tolobby' }); backToLobby(); };

// ---------- personalización ----------
let previewChar = null;
function openCustom() { $('#cName').value = SAVE.name; renderCustRows(); rebuildPreview(); }
function closeCustom() {
  const n = $('#cName').value.trim().slice(0, 12);
  if (n) { SAVE.name = n; storeSave(); }
  if (previewChar) { previewChar.dispose(); previewChar = null; }
}
function rebuildPreview() {
  if (previewChar) previewChar.dispose();
  previewChar = new Char({ id: 999, team: 0, look: SAVE.look });
  previewChar.setGear('bat');
  previewChar.snapYaw = true;
}
function renderCustRows() {
  const box = $('#custRows');
  box.innerHTML = '';
  for (const k of Object.keys(OPTS)) {
    const lab = document.createElement('label');
    lab.className = 't'; lab.textContent = OPT_LABEL[k];
    box.appendChild(lab);
    const row = document.createElement('div');
    row.className = 'row';
    for (const o of OPTS[k]) {
      const locked = o.lv > SAVE.level;
      const el = document.createElement('button');
      if (o.v.startsWith('#')) { el.className = 'sw'; el.style.background = o.v; }
      else { el.className = 'chip'; el.innerHTML = o.n + (locked ? `<small>🔒 Nv ${o.lv}</small>` : ''); }
      if (locked) { el.classList.add('lock'); el.title = 'Se desbloquea en el nivel ' + o.lv; }
      if (SAVE.look[k] === o.v) el.classList.add('sel');
      el.onclick = () => {
        if (locked) { toast('Se desbloquea en el nivel ' + o.lv); return; }
        SAVE.look[k] = o.v; storeSave(); SFX.ui();
        if (k === 'cel') GAME.previewCheer = performance.now() + 3400;
        renderCustRows(); rebuildPreview();
      };
      row.appendChild(el);
    }
    box.appendChild(row);
  }
}
$('#cName').addEventListener('input', () => { const n = $('#cName').value.trim().slice(0, 12); if (n) { SAVE.name = n; storeSave(); } });

// ---------- botones de menú ----------
$$('[data-go]').forEach((b) => b.addEventListener('click', () => { SFX.resume(); SFX.ui(); showScreen(b.dataset.go); }));
for (const row of $$('.venueRow')) row.innerHTML = VENUE_IDS.map((id) => '<button class="chip" data-v="' + id + '">' + VENUES[id].emoji + '<small>' + VENUES[id].name + '</small></button>').join('');
$$('[data-opt]').forEach((row) => row.addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  const k = row.dataset.opt, v = c.dataset.v;
  SAVE[k] = isNaN(+v) ? v : +v;
  storeSave(); syncChips(); SFX.ui();
  if (k === 'venue') { setVenue(v); if (GAME.mode === 'menu') startDemo(); }
}));
$('#bPlay').onclick = () => startGame(false);
$('#bDerby').onclick = () => { SFX.resume(); startGame(true); };
$('#bResume').onclick = () => togglePause();
$('#bQuit').onclick = () => leaveToMenu();
$('#pauseBtn').onclick = () => togglePause();
$('#bMute').onclick = () => toggleMute();
const TAG_MODES = { auto: 'Auto', todos: 'Todos', ninguno: 'Solo el tuyo' };
function syncPauseBtns() {
  $('#bTags').textContent = '🏷️ Nombres: ' + TAG_MODES[SAVE.tags || 'auto'];
  $('#bHelpTog').textContent = '🎯 Ayuda al batear: ' + (SAVE.help ? 'Sí' : 'No');
  $('#bVib').textContent = '📳 Vibración: ' + (SAVE.vib !== false ? 'Sí' : 'No');
  $('#bVib').style.display = IS_TOUCH ? '' : 'none';
  $('#bBatMode').textContent = '⚾ Bateo: ' + (cursorMode() ? 'Con cursor' : 'Simple');
  $('#bThrowMode').textContent = '🧤 Tiros en defensa: ' + (SAVE.throwMode === 'auto' ? 'Automáticos' : 'Manuales');
  syncQualityBtn();
}
$('#bBatMode').onclick = () => { SAVE.batMode = cursorMode() ? 'simple' : 'cursor'; storeSave(); syncPauseBtns(); HUD.ctx = '?'; SFX.ui(); };
$('#bThrowMode').onclick = () => {
  SAVE.throwMode = SAVE.throwMode === 'auto' ? 'manual' : 'auto'; storeSave(); syncPauseBtns(); SFX.ui();
  if (S.on && S.me >= 0) { S.throwMode[S.me] = SAVE.throwMode; if (S.net === 'client') netSendCmd({ t: 'tmode', v: SAVE.throwMode, team: S.me }); }
};
$('#bTags').onclick = () => { const ks = Object.keys(TAG_MODES); SAVE.tags = ks[(ks.indexOf(SAVE.tags || 'auto') + 1) % ks.length]; storeSave(); syncPauseBtns(); SFX.ui(); };
$('#bHelpTog').onclick = () => { SAVE.help = SAVE.help ? 0 : 1; storeSave(); if (S.settings) S.settings.help = !!SAVE.help; syncPauseBtns(); SFX.ui(); };
$('#bVib').onclick = () => { SAVE.vib = SAVE.vib === false; storeSave(); syncPauseBtns(); SFX.ui(); };
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) { toast('En iPhone: toca Compartir y luego "Añadir a pantalla de inicio"; ábrelo desde ahí para jugar a pantalla completa', 5000); return; }
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => { try { if (IS_TOUCH && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* sin bloqueo */ } }).catch(() => toast('Tu navegador no permitió la pantalla completa'));
  } catch (e) { toast('Tu navegador no permitió la pantalla completa'); }
}
function syncFsIcon() {
  const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
  for (const b of [$('#fsBtn'), $('#bFs')]) { b.textContent = on ? '🗗' : '⛶'; b.title = on ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'; }
}
document.addEventListener('fullscreenchange', syncFsIcon);
document.addEventListener('webkitfullscreenchange', syncFsIcon);
$('#fsBtn').onclick = () => toggleFullscreen();
$('#bFs').onclick = () => toggleFullscreen();
document.addEventListener('visibilitychange', () => { if (document.hidden && playing() && !S.online && GAME.screen !== 'scrEnd') togglePause(); });

// =========================================================
//  EN LÍNEA (PeerJS / WebRTC, con relevo MQTT de respaldo)
//  1 contra 1: el anfitrión (Verdes) simula el partido; el invitado
//  (Rosas) manda sus controles y recibe el estado ~20 veces por segundo.
//  El invitado mide su propio tiempo de bateo y el anfitrión lo usa.
// =========================================================
const PEER_PREFIX = 'jonronpark-v1-';
const PEER_OPTS = {
  debug: 1,
  config: {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
    ],
  },
};
const INTERP = 0.1;
const NET = {
  role: 'off', peer: null, conns: new Map(), hostConn: null, code: '', guest: null,
  lobby: [], settings: { innings: 3, diff: 1, venue: 'parque' }, started: false,
  snapT: 0, pingT: 0, sendT: 0, evQueue: [], snaps: [], tiOff: null, rtt: 0.1,
  relays: [], relayConns: new Map(), via: '', welcomed: false, lastHostMsg: 0,
};
const CL = { pitch: null, swingSent: false, takeSent: false, batAnim: null, scoreT: new Map(), lastPid: 0 };
const ANIMS = ['idle', 'stance', 'swing', 'bunt', 'pitch', 'throw', 'field', 'squat', 'catch', 'dive', 'lie', 'slide', 'cheer', 'sad'];
const ANIM_IDX = Object.fromEntries(ANIMS.map((a, i) => [a, i]));
const BST = ['held', 'pitch', 'air', 'ground', 'dead', 'toss'];
const r2 = (v) => Math.round((+v || 0) * 100) / 100;
const num = (v, a, b) => clamp(Number.isFinite(+v) ? +v : 0, a, b);
function genCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function netSendAll(msg) {
  for (const c of NET.conns.values()) if (c.conn.open) { try { c.conn.send(msg); } catch (e) { /* ignorar */ } }
}
function netSend(msg) { if (NET.hostConn && NET.hostConn.open) { try { NET.hostConn.send(msg); } catch (e) { /* ignorar */ } } }
function netSendCmd(c) { netSend({ t: 'cmd', c }); }
function netReset() {
  const peer = NET.peer;
  if (NET.role === 'host') netSendAll({ t: 'hostbye' });
  try { if (NET.hostConn && NET.hostConn.relay) NET.hostConn.close(); } catch (e) { /* ignorar */ }
  for (const cl of NET.relays) { try { cl.end(); } catch (e) { /* ignorar */ } }
  Object.assign(NET, { relays: [], welcomed: false, via: '', role: 'off', peer: null, hostConn: null, lobby: [], started: false, snaps: [], evQueue: [], tiOff: null, guest: null });
  NET.relayConns.clear(); NET.conns.clear();
  Object.assign(CL, { pitch: null, swingSent: false, takeSent: false, batAnim: null, lastPid: 0 });
  CL.scoreT.clear();
  try { if (peer) peer.destroy(); } catch (e) { /* ignorar */ }
}
function sanitizeLook(l) {
  const out = {};
  for (const k of Object.keys(OPTS)) out[k] = l && OPTS[k].some((o) => o.v === l[k]) ? l[k] : OPTS[k][0].v;
  return out;
}
function linkFor(code) {
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('sala', code);
  return u.toString();
}
// comandos del invitado: solo lo que el juego entiende, con números acotados
function cleanCmd(c) {
  if (!c || typeof c !== 'object') return null;
  const t = String(c.t || '');
  const o = { t };
  if (t === 'swing') {
    o.kind = ['normal', 'power', 'bunt'].includes(c.kind) ? c.kind : 'normal';
    o.err = num(c.err, -2, 2); o.aim = num(c.aim, -0.8, 0.8); o.mode = c.mode === 'cursor' ? 'cursor' : 'simple';
    o.cur = { x: num(c.cur && c.cur.x, -1, 1), y: num(c.cur && c.cur.y, 0, 2) };
  } else if (t === 'pitch') { o.kind = PITCHES[c.kind] ? c.kind : 'recta'; o.tx = num(c.tx, -0.95, 0.95); o.ty = num(c.ty, 0.12, 1.6); o.acc = num(c.acc, 0, 1); }
  else if (t === 'throw') { o.base = num(c.base, 0, 4) | 0; o.dir = c.dir ? { x: num(c.dir.x, -1, 1), z: num(c.dir.z, -1, 1) } : null; }
  else if (t === 'run') o.dir = c.dir > 0 ? 1 : -1;
  else if (t === 'runTo' || t === 'steal') o.base = num(c.base, 1, 4) | 0;
  else if (t === 'tmode') o.v = c.v === 'auto' ? 'auto' : 'manual';
  else if (!['take', 'jump', 'dive'].includes(t)) return null;
  return o;
}

// ---------- relevo (plan B): si la conexión directa falla, los mensajes viajan por un servidor MQTT público ----------
const RELAY_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const LIB_MQTT = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';
const LIB_QR = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
const scriptCache = {};
function loadScript(src) {
  if (!scriptCache[src]) {
    scriptCache[src] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res;
      s.onerror = () => { delete scriptCache[src]; rej(new Error('no se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }
  return scriptCache[src];
}
const rTopic = (code, k) => `jonronpark/v1/${code}/${k}`;
function relayConnectOne(i) {
  return loadScript(LIB_MQTT).then(() => new Promise((res, rej) => {
    let done = false;
    const cl = window.mqtt.connect(RELAY_BROKERS[i], { clientId: 'jp_' + Math.random().toString(36).slice(2, 12), clean: true, connectTimeout: 7000, reconnectPeriod: 2500, keepalive: 30 });
    cl.on('connect', () => { if (!done) { done = true; res(cl); } });
    cl.on('error', () => { /* reintenta solo */ });
    setTimeout(() => { if (!done) { done = true; try { cl.end(true); } catch (e) { /* ignorar */ } rej(new Error('relay timeout')); } }, 8000);
  }));
}
const waitFor = (fn, ms) => new Promise((res) => {
  const t0 = performance.now();
  const iv = setInterval(() => { if (fn()) { clearInterval(iv); res(true); } else if (performance.now() - t0 > ms) { clearInterval(iv); res(false); } }, 100);
});
function hostRelayStart(code) {
  RELAY_BROKERS.forEach((_, i) => {
    relayConnectOne(i).then((cl) => {
      if (NET.role !== 'host' || NET.code !== code) { cl.end(true); return; }
      NET.relays.push(cl);
      cl.subscribe(rTopic(code, 'h'));
      cl.on('message', (tp, payload) => {
        let m;
        try { m = JSON.parse(payload.toString()); } catch (e) { return; }
        if (m && typeof m.f === 'string') hostRelayMsg(cl, m.f.slice(0, 16), m.d);
      });
    }).catch(() => { /* ese servidor no responde: queda el otro */ });
  });
}
function hostRelayMsg(cl, cid, d) {
  const key = 'relay:' + cid;
  let v = NET.relayConns.get(key);
  if (!v) {
    if (!d || d.t !== 'hello') return;
    v = { peer: key, open: true, relay: true, lastT: 0, send(msg) { if (this.open) cl.publish(rTopic(NET.code, 'c/' + cid), JSON.stringify(msg)); }, close() { this.open = false; } };
    NET.relayConns.set(key, v);
  }
  v.lastT = performance.now();
  if (d && d.t === 'bye') { v.open = false; NET.relayConns.delete(key); hostDrop(v); return; }
  hostOnData(v, d);
}
async function clientRelayJoin(code) {
  setJoinStatus('Probando conexión por servidor de relevo…');
  const cid = Math.random().toString(36).slice(2, 12);
  for (let i = 0; i < RELAY_BROKERS.length; i++) {
    let cl;
    try { cl = await relayConnectOne(i); } catch (e) { continue; }
    if (NET.role !== 'client' || NET.code !== code) { cl.end(true); return; }
    const conn = {
      open: true, relay: true,
      send(msg) { if (this.open) cl.publish(rTopic(code, 'h'), JSON.stringify({ f: cid, d: msg })); },
      close() { try { this.send({ t: 'bye' }); } catch (e) { /* ignorar */ } this.open = false; setTimeout(() => { try { cl.end(true); } catch (e) { /* ignorar */ } }, 200); },
    };
    cl.subscribe(rTopic(code, 'c/' + cid));
    cl.on('message', (tp, payload) => {
      if (NET.hostConn !== conn) return;
      let m;
      try { m = JSON.parse(payload.toString()); } catch (e) { return; }
      NET.lastHostMsg = performance.now();
      clientOnData(m);
    });
    NET.hostConn = conn; NET.via = 'relevo'; NET.welcomed = false;
    NET.lastHostMsg = performance.now();
    conn.send(helloMsg());
    if (await waitFor(() => NET.welcomed, 6000)) { setJoinStatus('¡Conectado (por relevo)!'); return; }
    conn.close();
    if (NET.hostConn === conn) NET.hostConn = null;
  }
  if (NET.role === 'client' && NET.code === code) setJoinStatus('No se pudo conectar. Revisa el código, que la sala siga abierta en el otro dispositivo y tu internet.');
}
// latidos: el anfitrión detecta invitados caídos; el invitado detecta anfitrión caído
setInterval(() => {
  const now = performance.now();
  if (NET.role === 'host') {
    if (GAME.mode !== 'online') netSendAll({ t: 'ping', ts: now });
    for (const [key, v] of NET.relayConns) if (now - v.lastT > 12000) { v.open = false; NET.relayConns.delete(key); hostDrop(v); }
  } else if (NET.role === 'client' && NET.welcomed && NET.hostConn && now - NET.lastHostMsg > 12000) {
    toast('Se perdió la conexión con el anfitrión');
    leaveToMenu();
  }
}, 2000);

// ---------- anfitrión ----------
function hostCreate() {
  netReset();
  NET.role = 'host';
  NET.code = genCode();
  NET.settings = { innings: SAVE.innings, diff: SAVE.diff, venue: SAVE.venue };
  NET.lobby = [{ id: 'h', name: SAVE.name, look: SAVE.look, team: 0, tm: SAVE.throwMode || 'manual' }];
  showScreen('scrLobby');
  setLobbyStatus('Creando sala…');
  renderLobby();
  hostRelayStart(NET.code);
  loadScript(LIB_QR).then(renderLobby).catch(() => { /* sin QR */ });
  if (!window.Peer) { setLobbyStatus('Sala lista (por relevo). Comparte el código, el link o el QR.'); return; }
  const peer = new Peer(PEER_PREFIX + NET.code, PEER_OPTS);
  NET.peer = peer;
  peer.on('open', () => { setLobbyStatus('Comparte el código, el link o el QR. Si nadie entra, juegas contra la PC.'); renderLobby(); });
  peer.on('connection', (conn) => {
    conn.on('data', (d) => hostOnData(conn, d));
    conn.on('close', () => hostDrop(conn));
    conn.on('error', () => hostDrop(conn));
  });
  peer.on('error', (err) => {
    if (err.type === 'unavailable-id') { hostCreate(); return; }
    if (NET.peer === peer) setLobbyStatus('La conexión directa no está disponible; tu amigo entrará por relevo.');
  });
  peer.on('disconnected', () => { try { if (NET.peer === peer) peer.reconnect(); } catch (e) { /* ignorar */ } });
}
function hostOnData(conn, d) {
  if (!d || typeof d !== 'object') return;
  const c = NET.conns.get(conn.peer);
  switch (d.t) {
    case 'hello': {
      if (c) return;
      if (NET.guest) { try { conn.send({ t: 'full' }); } catch (e) { /* ignorar */ } setTimeout(() => { try { conn.close(); } catch (e) { /* ignorar */ } }, 400); return; }
      const entry = { id: 'g', name: String(d.name || 'Amigo').slice(0, 12), look: sanitizeLook(d.look), team: 1, tm: d.tm === 'auto' ? 'auto' : 'manual' };
      NET.lobby = [NET.lobby[0], entry];
      NET.conns.set(conn.peer, { conn, rtt: 0.1 });
      NET.guest = conn.peer;
      conn.send({ t: 'welcome', code: NET.code });
      broadcastLobby();
      toast(entry.name + ' entró a la sala');
      SFX.ui();
      // partido en marcha (p. ej. se le cortó la conexión): vuelve a jugar con los Rosas
      if (S.net === 'host' && S.on && !S.ended && GAME.mode === 'online') {
        S.ctl[1] = true; S.remote[1] = true; S.throwMode[1] = entry.tm;
        conn.send({ t: 'start', roster: S.players.map((p) => ({ n: p.name, l: p.look, c: p.captain ? 1 : 0 })), settings: S.settings, me: 1 });
        toast(entry.name + ' vuelve a jugar con los Rosas');
      }
      break;
    }
    case 'in':
      if (c && S.net === 'host' && S.remote[1]) S.inp[1] = { mx: num(d.mx, -1, 1), mz: num(d.mz, -1, 1) };
      break;
    case 'cmd': {
      if (!c || S.net !== 'host' || !S.remote[1]) return;
      const cc = cleanCmd(d.c);
      if (!cc) return;
      cc.team = 1;
      if (cc.t === 'tmode') S.throwMode[1] = cc.v; else S.cmds.push(cc);
      break;
    }
    case 'pong': if (c) c.rtt = clamp((performance.now() - d.ts) / 1000, 0, 1); break;
    case 'cping': try { conn.send({ t: 'cpong', ts: d.ts }); } catch (e) { /* ignorar */ } break;
  }
}
function hostDrop(conn) {
  if (!NET.conns.has(conn.peer)) return;
  NET.conns.delete(conn.peer);
  const g = NET.lobby[1];
  NET.lobby = NET.lobby.slice(0, 1);
  if (NET.guest === conn.peer) NET.guest = null;
  if (g) toast(g.name + ' salió' + (S.net === 'host' && !S.ended ? ': la PC juega por los Rosas' : ''));
  if (S.net === 'host') { S.ctl[1] = false; S.remote[1] = false; S.throwMode[1] = 'auto'; S.inp[1] = { mx: 0, mz: 0 }; }
  broadcastLobby();
}
function broadcastLobby() {
  netSendAll({ t: 'lobby', players: NET.lobby, settings: NET.settings, started: NET.started });
  renderLobby();
}
function hostStart() {
  const g = NET.lobby.find((p) => p.team === 1);
  const settings = { innings: NET.settings.innings, diff: NET.settings.diff, venue: NET.settings.venue, help: !!SAVE.help };
  NET.started = true;
  NET.snapT = 0; NET.evQueue = [];
  startGame(false, {
    net: 'host', online: true, me: 0, ctl: [true, !!g], remote: [false, !!g],
    captains: [{ name: SAVE.name, look: SAVE.look }, g ? { name: g.name, look: g.look } : null],
    throwMode: [SAVE.throwMode || 'manual', g ? g.tm : 'auto'], settings,
  });
  const roster = S.players.map((p) => ({ n: p.name, l: p.look, c: p.captain ? 1 : 0 }));
  netSendAll({ t: 'start', roster, settings, me: 1 });
  broadcastLobby();
}
function netSnapshot() {
  const b = S.ball;
  return {
    t: 's', ti: performance.now() / 1000, ph: S.phase, pt: r2(S.t), h: S.half, inn: S.inning, o: S.outs, b: S.balls, k: S.strikes,
    sc: S.score, hi: S.hits, ln: S.line, bat: S.batter ? S.batter.id : -1, ctrl: S.ctrlId,
    cd: +!!S.contactDone, bd: +!!S.batted, wk: +!!S.walk, hr: +!!S.hr, sp: +!!S.stealPlay, q: S.queued && S.queued.team === 1 ? S.queued.base : 0,
    p: S.players.map((p) => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.ry), ANIM_IDX[p.anim] ?? 0, r2(p.animT)]),
    bl: [r2(b.x), r2(b.y), r2(b.z), r2(b.vx), r2(b.vy), r2(b.vz), Math.max(0, BST.indexOf(b.st)), b.holder ? b.holder.id : -1, (b.bounced ? 1 : 0) | (b.outOfPark ? 2 : 0) | (b.batted ? 4 : 0)],
    ru: S.runners.map((r) => [r.pl.id, r2(r.p), r2(r.target), (r.out ? 1 : 0) | (r.scored ? 2 : 0) | (r.isBatter ? 4 : 0) | (r.steal ? 8 : 0) | (r.stealing ? 16 : 0), r2(r.slideT)]),
  };
}
function hostTick(dt, evs) {
  for (const e of evs) NET.evQueue.push(e);
  NET.snapT += dt; NET.pingT += dt;
  if (NET.snapT >= 1 / 20) {
    NET.snapT = 0;
    const s = netSnapshot();
    s.ev = NET.evQueue.splice(0);
    netSendAll(s);
  }
  if (NET.pingT >= 1) { NET.pingT = 0; netSendAll({ t: 'ping', ts: performance.now() }); }
}
// el lanzamiento sale ya: el invitado lo dibuja con su propio reloj para poder batear a tiempo
function netPitchRelease(p) {
  netSendAll({ t: 'rel', id: p.id, kind: p.kind, p0: p.p0, v0: p.v0, a: p.a, tC: p.tC, T0: p.T0, cross: p.cross, strike: p.strike });
}
function netSendEnd() {
  netSendAll({ t: 'end', sc: S.score, ln: S.line, hi: S.hits, inn: S.inning, stats: S.players.map((p) => p.stats) });
  NET.started = false;
  setTimeout(broadcastLobby, 200);
}

// ---------- invitado ----------
const helloMsg = () => ({ t: 'hello', name: SAVE.name, look: SAVE.look, tm: SAVE.throwMode || 'manual' });
function clientJoin(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) { setJoinStatus('Escribe el código de la sala'); return; }
  netReset();
  NET.role = 'client'; NET.code = code;
  setJoinStatus('Conectando…');
  let fellBack = false;
  const fallback = () => {
    if (fellBack || NET.role !== 'client' || NET.code !== code || NET.welcomed) return;
    fellBack = true;
    const peer = NET.peer;
    NET.peer = null;
    if (NET.hostConn && !NET.hostConn.relay) NET.hostConn = null;
    try { if (peer) peer.destroy(); } catch (e) { /* ignorar */ }
    clientRelayJoin(code);
  };
  if (!window.Peer || new URLSearchParams(location.search).has('relevo')) { fallback(); return; }
  const peer = new Peer(PEER_OPTS);
  NET.peer = peer;
  const to = setTimeout(fallback, 7000);
  peer.on('open', () => {
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
    NET.hostConn = conn; NET.via = 'directa';
    conn.on('open', () => { clearTimeout(to); conn.send(helloMsg()); setJoinStatus('¡Conectado!'); });
    conn.on('data', clientOnData);
    conn.on('close', () => { if (NET.peer === peer && NET.hostConn === conn) { toast('Se cerró la conexión con el anfitrión'); leaveToMenu(); } });
    conn.on('error', fallback);
    setTimeout(() => {
      const pc = conn.peerConnection;
      if (pc) pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'failed') fallback(); });
    }, 0);
  });
  peer.on('error', () => { clearTimeout(to); fallback(); });
}
function clientOnData(d) {
  if (!d || typeof d !== 'object') return;
  NET.lastHostMsg = performance.now();
  switch (d.t) {
    case 'welcome': NET.code = d.code; NET.welcomed = true; showScreen('scrLobby'); renderLobby(); break;
    case 'hostbye': if (NET.role === 'client') { toast('El anfitrión cerró la sala'); leaveToMenu(); } break;
    case 'full': setJoinStatus('La sala ya tiene dos jugadores'); break;
    case 'lobby':
      NET.lobby = d.players || []; NET.settings = d.settings || NET.settings; NET.started = d.started;
      if (GAME.mode === 'menu' && NET.settings.venue) setVenue(NET.settings.venue);
      renderLobby();
      break;
    case 'start':
      if (!Array.isArray(d.roster) || d.roster.length !== 18) return;
      startGame(false, { net: 'client', online: true, me: 1, ctl: [true, true], remote: [false, false], roster: d.roster, settings: Object.assign({}, d.settings, { help: !!SAVE.help }) });
      break;
    case 's': if (S.net === 'client') clientSnap(d); break;
    case 'rel': if (S.net === 'client') clientRelease(d); break;
    case 'end': if (S.net === 'client') clientEnd(d); break;
    case 'ping': netSend({ t: 'pong', ts: d.ts }); break;
    case 'cpong': NET.rtt = damp(NET.rtt, clamp((performance.now() - d.ts) / 1000, 0, 1), 3, 1); break;
    case 'tolobby': if (S.net === 'client') backToLobby(); break;
  }
}
function clientInitMatch() {
  S.events = []; NET.snaps = []; NET.tiOff = null;
  Object.assign(CL, { pitch: null, swingSent: false, takeSent: false, batAnim: null, lastPid: 0 });
  CL.scoreT.clear();
  S.clock = performance.now() / 1000;
}
function clientSnap(s) {
  const now = performance.now() / 1000;
  const off = now - s.ti;
  if (NET.tiOff === null || off < NET.tiOff) NET.tiOff = off; else NET.tiOff += (off - NET.tiOff) * 0.02;
  NET.snaps.push(s);
  while (NET.snaps.length > 40) NET.snaps.shift();
  if (s.ev) for (const e of s.ev) setTimeout(() => { if (S.net === 'client') S.events.push(e); }, INTERP * 1000);
}
function clientRelease(d) {
  const now = performance.now() / 1000;
  const p = { id: d.id, kind: d.kind, p0: d.p0, v0: d.v0, a: d.a, tC: +d.tC, T0: +d.T0, cross: d.cross, strike: !!d.strike };
  p.t0 = now + INTERP; // sale a la vez que el brazo del lanzador que se ve (va INTERP por detrás)
  p.tContactAbs = p.t0 + p.tC;
  Object.assign(CL, { pitch: p, swingSent: false, takeSent: false, lastPid: d.id });
  S.pitch = p;
}
// el invitado batea con SU reloj: manda cuánto se adelantó o atrasó y dónde tenía el cursor
function clientSwing(c) {
  const P = CL.pitch;
  if (!P || CL.swingSent) return;
  const now = performance.now() / 1000;
  if (c.kind === 'bunt') { const lead = P.tContactAbs - now; c.err = lead < 0.1 ? 0.1 - lead : lead > 0.8 ? -(lead - 0.8) : 0; }
  else c.err = now + SWING_DT - P.tContactAbs;
  CL.swingSent = true;
  CL.batAnim = { anim: c.kind === 'bunt' ? 'bunt' : 'swing', t0: now };
  c.team = S.me;
  netSendCmd(c);
  if (c.kind !== 'bunt') SFX.swish(1);
}
function clientEnd(d) {
  S.score = d.sc; S.line = d.ln; S.hits = d.hi; S.inning = d.inn;
  if (Array.isArray(d.stats)) d.stats.forEach((st, i) => { if (S.players[i] && st) S.players[i].stats = st; });
  S.ended = true; S.phase = 'end';
  showEndScreen();
}
function clientTick(dt, inp) {
  const now = performance.now() / 1000;
  S.clock = now;
  NET.sendT += dt; NET.pingT += dt;
  if (NET.sendT >= (NET.via === 'relevo' ? 1 / 15 : 1 / 25)) { NET.sendT = 0; netSend({ t: 'in', mx: r2(inp.mx), mz: r2(inp.mz) }); }
  if (NET.pingT >= 1) { NET.pingT = 0; netSend({ t: 'cping', ts: performance.now() }); }
  if (!NET.snaps.length || NET.tiOff === null) return;
  const rt = now - NET.tiOff - INTERP;
  let s0 = NET.snaps[0], s1 = null;
  for (let i = NET.snaps.length - 1; i >= 0; i--) if (NET.snaps[i].ti <= rt) { s0 = NET.snaps[i]; s1 = NET.snaps[i + 1] || null; break; }
  const k = s1 ? clamp((rt - s0.ti) / Math.max(0.001, s1.ti - s0.ti), 0, 1) : 0;
  const el = Math.max(0, rt - s0.ti);
  // estado del partido
  Object.assign(S, {
    phase: s0.ph, t: s0.pt + el, half: s0.h, inning: s0.inn, outs: s0.o, balls: s0.b, strikes: s0.k, score: s0.sc, hits: s0.hi, line: s0.ln || S.line,
    batter: s0.bat >= 0 ? S.players[s0.bat] : null, ctrlId: s0.ctrl, contactDone: !!s0.cd, batted: !!s0.bd, walk: !!s0.wk, hr: !!s0.hr, stealPlay: !!s0.sp,
    queued: s0.q ? { base: s0.q, team: 1 } : null,
  });
  // jugadores (interpolados)
  for (let i = 0; i < s0.p.length; i++) {
    const a = s0.p[i], b1 = s1 ? s1.p[i] : null, p = S.players[a[0]];
    if (!p) continue;
    const L = (j) => (b1 ? lerp(a[j], b1[j], k) : a[j]);
    const ox = p.x, oz = p.z;
    p.x = L(1); p.y = L(2); p.z = L(3);
    if (Math.hypot(p.x - ox, p.z - oz) > 3) p.snap = true;
    let da = (b1 ? b1[4] : a[4]) - a[4];
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    p.ry = a[4] + da * k;
    p.anim = ANIMS[a[5]] || 'idle'; p.animT = a[6] + el;
  }
  // mi swing se ve al instante (el anfitrión lo confirma después)
  if (CL.batAnim && S.batter && now - CL.batAnim.t0 < 0.95) { S.batter.anim = CL.batAnim.anim; S.batter.animT = now - CL.batAnim.t0; }
  // corredores
  S.runners = s0.ru.map((a) => {
    const b1 = s1 && s1.ru.find((x) => x[0] === a[0]);
    const scored = !!(a[3] & 2);
    if (scored && !CL.scoreT.has(a[0])) CL.scoreT.set(a[0], now);
    if (!scored) CL.scoreT.delete(a[0]);
    return { pl: S.players[a[0]], p: b1 ? lerp(a[1], b1[1], k) : a[1], target: a[2], out: !!(a[3] & 1), scored, isBatter: !!(a[3] & 4), steal: !!(a[3] & 8), stealing: !!(a[3] & 16), slideT: a[4], scoreT: CL.scoreT.get(a[0]) || now, base: Math.floor(a[1]) };
  });
  for (const r of S.runners) { if (r.out || r.scored || !r.pl) continue; const P = runnerPos(r); r.pl.x = P.x; r.pl.z = P.z; if (r.slideT > 0) r.pl.anim = 'slide'; }
  // pelota
  const B = S.ball, bl = s0.bl, st = BST[bl[6]] || 'held';
  B.holder = bl[7] >= 0 ? S.players[bl[7]] : null;
  B.bounced = !!(bl[8] & 1); B.outOfPark = !!(bl[8] & 2); B.batted = !!(bl[8] & 4);
  const P = CL.pitch, pt = P ? now - P.t0 : 99;
  if (P && !S.contactDone && pt > -INTERP && pt < P.tC + 0.55 && (S.phase === 'windup' || S.phase === 'flight' || S.phase === 'pitch')) {
    if (pt < 0) { B.st = 'held'; B.holder = S.players.find((q) => q.team === 1 - S.half && q.role === 'P') || null; }
    else { B.st = 'pitch'; B.holder = null; pitchAt(P, pt, B); B.vx = P.v0.x + P.a.x * pt; B.vy = P.v0.y + P.a.y * pt; B.vz = P.v0.z; }
  } else {
    B.st = st;
    const b1 = s1 ? s1.bl : null;
    if (b1 && BST[b1[6]] === st && st !== 'held') { B.x = lerp(bl[0], b1[0], k); B.y = lerp(bl[1], b1[1], k); B.z = lerp(bl[2], b1[2], k); }
    else { const t = Math.min(el, 0.2); B.x = bl[0] + bl[3] * t; B.z = bl[2] + bl[5] * t; B.y = st === 'air' ? Math.max(BALL_R, bl[1] + bl[4] * t - 0.5 * G * t * t) : bl[1]; }
    B.vx = bl[3]; B.vy = bl[4]; B.vz = bl[5];
  }
  S.swing = CL.swingSent && P && !S.contactDone ? { kind: 'normal' } : S.contactDone ? { kind: 'normal' } : null;
  // ¿la pelota pasó y no batee? se lo digo al anfitrión
  if (P && humanBats() && !CL.swingSent && !CL.takeSent && now > P.tContactAbs + 0.04) { CL.takeSent = true; netSendCmd({ t: 'take', team: S.me }); }
}
function backToLobby() {
  GAME.mode = 'menu'; GAME.paused = false;
  $('#hud').classList.remove('on');
  $('#touchUI').classList.remove('on');
  startDemo();
  if (NET.role !== 'off') { showScreen('scrLobby'); renderLobby(); } else showScreen('scrMenu');
}

// ---------- sala ----------
function setLobbyStatus(s) { $('#lStatus').textContent = s; }
function setJoinStatus(s) { $('#jStatus').textContent = s; }
function renderLobby() {
  $('#lCode').textContent = NET.code || '-----';
  $('#lLink').value = NET.code ? linkFor(NET.code) : '';
  const qrBox = $('#lQr');
  if (NET.code && window.qrcode && qrBox.dataset.code !== NET.code) {
    try { const q = window.qrcode(0, 'M'); q.addData(linkFor(NET.code)); q.make(); qrBox.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); qrBox.dataset.code = NET.code; } catch (e) { /* sin QR */ }
  }
  const host = NET.role === 'host';
  $('#qrRow').style.display = NET.code && host ? '' : 'none';
  for (const t of [0, 1]) {
    const p = NET.lobby.find((x) => x.team === t);
    const me = (host && t === 0) || (!host && t === 1);
    $('#lTeam' + t).innerHTML = p ? `<div class="pl">${escapeHtml(p.name)}${me ? ' <em>(tú)</em>' : ''}${t === 0 ? ' <em>👑</em>' : ''}</div>` : '<div class="pl"><em>🤖 PC (esperando a tu amigo…)</em></div>';
  }
  $('#lHostOpts').style.display = host ? '' : 'none';
  $('#bStart').style.display = host ? '' : 'none';
  $('#bStart').textContent = NET.lobby.length > 1 ? '¡Empezar partido!' : 'Empezar contra la PC';
  $$('[data-lopt]').forEach((row) => {
    const k = row.dataset.lopt;
    row.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', c.dataset.v === String(NET.settings[k])));
  });
  if (!host) setLobbyStatus(NET.started ? 'Hay un partido en curso: entrarás en el siguiente.' : 'Esperando a que el anfitrión empiece… (tú juegas con los Rosas)');
}
$('#bHost').onclick = () => { SFX.resume(); SFX.ui(); hostCreate(); };
$('#bJoin').onclick = () => { SFX.resume(); clientJoin($('#jCode').value); };
$('#jCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') clientJoin($('#jCode').value); });
$('#bStart').onclick = () => { SFX.resume(); if (NET.role === 'host') hostStart(); };
$('#bLeave').onclick = () => { SFX.ui(); leaveToMenu(); };
$('#bCopy').onclick = () => {
  const v = $('#lLink').value;
  const ok = () => toast('Link copiado: pásaselo a tu amigo');
  if (navigator.clipboard) navigator.clipboard.writeText(v).then(ok).catch(() => { $('#lLink').select(); document.execCommand('copy'); ok(); });
  else { $('#lLink').select(); document.execCommand('copy'); ok(); }
};
$$('[data-lopt]').forEach((row) => row.addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c || NET.role !== 'host') return;
  const k = row.dataset.lopt, v = c.dataset.v;
  NET.settings[k] = isNaN(+v) ? v : +v;
  if (k === 'venue') setVenue(v);
  SFX.ui();
  broadcastLobby();
}));

// =========================================================
//  CALIDAD Y BUCLE PRINCIPAL
// =========================================================
const QUALITY = {
  alta: { name: 'Alta', pr: 2, sh: 2048, shadows: true, outlines: true, parts: 1 },
  media: { name: 'Media', pr: 1.25, sh: 1024, shadows: true, outlines: true, parts: 0.7 },
  baja: { name: 'Baja', pr: 1, sh: 512, shadows: false, outlines: false, parts: 0.45 },
};
const Q_ORDER = ['auto', 'alta', 'media', 'baja'];
let QL = '';
const qualityPref = () => SAVE.quality || 'auto';
function applyQuality(name) {
  const q = QUALITY[name];
  if (!q) return;
  QL = name;
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.pr));
  onResize();
  if (sun.shadow.mapSize.x !== q.sh) { sun.shadow.mapSize.set(q.sh, q.sh); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  if (renderer.shadowMap.enabled !== q.shadows) {
    renderer.shadowMap.enabled = q.shadows;
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  }
  OUTLINES = q.outlines;
  scene.traverse((o) => { if (o.userData.ol) o.visible = OUTLINES; });
  PART_SCALE = q.parts;
  syncQualityBtn();
}
function startQuality() { const p = qualityPref(); applyQuality(p === 'auto' ? SAVE.autoQ || (IS_TOUCH ? 'media' : 'alta') : p); }
const FPSM = { t: 0, f: 0, low: 0 };
function autoQuality(rawDt) {
  if (qualityPref() !== 'auto' || GAME.mode === 'menu' || document.hidden || GAME.paused || rawDt > 0.4) { FPSM.t = 0; FPSM.f = 0; return; }
  FPSM.t += rawDt; FPSM.f++;
  if (FPSM.t < 2.5) return;
  const fps = FPSM.f / FPSM.t;
  FPSM.t = 0; FPSM.f = 0;
  if (fps >= 45) { FPSM.low = 0; return; }
  if (++FPSM.low < 2) return;
  FPSM.low = 0;
  const next = QL === 'alta' ? 'media' : QL === 'media' ? 'baja' : null;
  if (!next) return;
  SAVE.autoQ = next; storeSave();
  applyQuality(next);
  toast('⚙️ Calidad ajustada a ' + QUALITY[next].name + ' para que el juego vaya más fluido', 3000);
}
function syncQualityBtn() {
  const p = qualityPref();
  $('#bQuality').textContent = '⚙️ Calidad: ' + (p === 'auto' ? 'Automática (' + (QUALITY[QL] ? QUALITY[QL].name : '…') + ')' : QUALITY[p].name);
}
$('#bQuality').onclick = () => {
  const p = qualityPref();
  SAVE.quality = Q_ORDER[(Q_ORDER.indexOf(p) + 1) % Q_ORDER.length];
  if (SAVE.quality === 'auto') SAVE.autoQ = null;
  storeSave(); startQuality(); SFX.ui();
};

let last = performance.now(), acc = 0, lastRaf = 0, lastWk = 0;
// avanza la simulación (local o anfitrión) y reparte los eventos
function simAdvance(dt) {
  let sdt = dt;
  if (GAME.hitStop > 0) { GAME.hitStop -= dt; sdt *= 0.12; }
  if (GAME.slowmo > 0) { GAME.slowmo -= dt; sdt *= 0.35; }
  if (GAME.paused && !S.online) sdt = 0;
  GAME.tScale = dt > 0 ? sdt / dt : 1;
  acc += sdt;
  let n = 0;
  while (acc >= STEP && n < 8) { simStep(STEP); acc -= STEP; n++; }
  if (n >= 8) acc = 0;
  const evs = S.events.splice(0);
  if (S.net === 'host') hostTick(dt, evs);
  for (const e of evs) handleEvent(e);
  return sdt;
}
// con la pestaña oculta el navegador frena requestAnimationFrame:
// un worker mantiene vivo el partido del anfitrión para su amigo
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),16)'], { type: 'text/javascript' })));
  wk.onmessage = () => {
    const now = performance.now();
    if (now - lastRaf < 250) { lastWk = now; return; }
    const dt = Math.min(0.12, (now - lastWk) / 1000);
    lastWk = now;
    if (S.on && S.net === 'host') simAdvance(dt);
  };
} catch (e) { /* sin worker: solo funciona con la pestaña visible */ }
function frame(now) {
  requestAnimationFrame(frame);
  lastRaf = performance.now();
  const rawDt = (now - last) / 1000;
  const dt = Math.min(0.05, Math.max(0, rawDt));
  last = now;
  autoQuality(rawDt);
  if (S.on) {
    const ctx = uiCtx();
    updateAim(dt, ctx);
    meterTick(dt, ctx);
    const mv = moveInput();
    const inp = { mx: ctx === 'field' ? mv.x : 0, mz: ctx === 'field' ? -mv.y : 0 };
    if (S.net === 'client') {
      // invitado: no simula; recibe el estado del anfitrión y le manda sus controles
      clientTick(dt, inp);
      for (const e of S.events.splice(0)) handleEvent(e);
      renderGame(dt);
      updateHud(ctx);
    } else {
      if (S.me >= 0) S.inp[S.me] = inp;
      const sdt = simAdvance(dt);
      renderGame(sdt);
      if (GAME.mode !== 'menu') updateHud(ctx);
    }
  }
  if (previewChar) {
    const t = now / 1000;
    const cheer = performance.now() < (GAME.previewCheer || 0);
    previewChar.setGear(cheer ? 'field' : 'bat');
    previewChar.update(dt, { x: PREVIEW.x, y: 0, z: PREVIEW.z, ry: cheer ? 0 : Math.sin(t * 0.6) * 0.5, anim: cheer ? 'cheer' : 'stance', animT: cheer ? 3.4 - (GAME.previewCheer - performance.now()) / 1000 : t }, camera.position.x, camera.position.y, camera.position.z, { dust: false, headMax: 1.4 });
  }
  updateCamera(dt);
  updateParts(dt); updateConfetti(dt); updateShock(dt); updateVenue(dt, now / 1000);
  renderer.render(scene, camera);
}

// ---------- arranque ----------
if (IS_TOUCH) document.body.classList.add('touch');
startQuality();
syncPauseBtns();
startDemo();
showScreen('scrMenu');
{
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { showScreen('scrJoin'); $('#jCode').value = sala.toUpperCase(); setTimeout(() => clientJoin(sala), 300); }
}
requestAnimationFrame(frame);
window.__JP = { S, GAME, INPUT, NET, CL, act, baseTap, pushCmd, startGame, ff(sec) { for (let i = 0; i < sec * 60; i++) { simStep(STEP); for (const e of S.events.splice(0)) handleEvent(e); } } };
