// =========================================
// Rocket Escape - PRO Interactive Edition
// ✅ Rocket Blue/Red/White 🚀
// ✅ Zigzag meteors + slow rotation
// ✅ Missed stars: >7 => lose
// ✅ No lasers
// ✅ Big satellites + debris
// ✅ Mobile support
// ✅ NEW: tilt, combo, hit/boost flash, HUD reactions, vibration
// =========================================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// HUD
const scoreEl = document.getElementById("score");
const highEl = document.getElementById("highscore");
const livesEl = document.getElementById("lives");
const missedEl = document.getElementById("missedOrbs");

// UI
const overlay = document.getElementById("overlay");
const how = document.getElementById("how");
const toast = document.getElementById("toast");

// Buttons
const startBtn = document.getElementById("startBtn");
const howBtn = document.getElementById("howBtn");
const closeHow = document.getElementById("closeHow");
const restartBtn = document.getElementById("restartBtn");
const pauseBtn = document.getElementById("pauseBtn");

// Mobile
const touchPad = document.getElementById("touchPad");
const touchDot = document.getElementById("touchDot");
const boostBtn = document.getElementById("boostBtn");
const pauseBtnMobile = document.getElementById("pauseBtnMobile");

// -----------------------
// Helpers
// -----------------------
function rand(a, b) { return Math.random() * (b - a) + a; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 720);
}

function bump(el){
  if(!el) return;
  el.style.transform = "scale(1.12)";
  el.style.transition = "transform 120ms ease";
  setTimeout(() => { el.style.transform = "scale(1)"; }, 130);
}

function vibrate(ms=30){
  try{
    if(navigator.vibrate) navigator.vibrate(ms);
  }catch(e){}
}

function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr) {
  let tx = cx, ty = cy;
  if (cx < rx) tx = rx; else if (cx > rx + rw) tx = rx + rw;
  if (cy < ry) ty = ry; else if (cy > ry + rh) ty = ry + rh;
  const dx = cx - tx, dy = cy - ty;
  return dx * dx + dy * dy <= cr * cr;
}

// -----------------------
// Theme
// -----------------------
const METEOR_THEME = {
  glow: "rgba(255, 140, 60, 0.14)",
  outer: "rgba(80, 35, 18, 0.95)",
  mid: "rgba(140, 72, 40, 0.92)",
  core: "rgba(210, 150, 95, 0.92)",
  crater: "rgba(20, 10, 6, 0.50)"
};

// -----------------------
// State
// -----------------------
let running = false;
let paused = false;
let keys = {};

let score = 0;
let lives = 3;
let frame = 0;
let difficulty = 1;

let meteors = [];
let goldStars = [];
let blueStars = [];
let satellites = [];
let debris = [];
let particles = [];

let shake = 0;

// missed stars
let missed = 0;
const MAX_MISSED = 7;

// NEW interaction values
let combo = 1;
let comboTime = 0;              // counts down, if reaches 0 combo falls
let hitFlash = 0;               // red overlay
let boostFlash = 0;             // blue overlay
let uiPulseScore = 0;           // score bump animation timer

// rocket
const MAX_LIVES = 6;
const rocket = {
  x: 450, y: 420,
  w: 44, h: 70,
  vx: 0, boost: 0,
  tilt: 0 // NEW
};

// -----------------------
// Space Background
// -----------------------
let starLayers = [];

function initSpaceBackground() {
  starLayers = [
    { count: 110, speed: 0.35, sizeMin: 0.8, sizeMax: 1.8, alpha: 0.22 },
    { count: 70, speed: 0.70, sizeMin: 1.0, sizeMax: 2.4, alpha: 0.18 },
    { count: 35, speed: 1.30, sizeMin: 1.4, sizeMax: 3.2, alpha: 0.14 },
  ].map(layer => ({
    ...layer,
    stars: Array.from({ length: layer.count }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: rand(layer.sizeMin, layer.sizeMax),
      tw: rand(0.0, Math.PI * 2),
      tws: rand(0.01, 0.03),
    }))
  }));
}

function drawSpaceBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#050713");
  bg.addColorStop(0.5, "#070a18");
  bg.addColorStop(1, "#02040c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // nebula
  ctx.save();
  ctx.globalAlpha = 0.65;
  const n1 = ctx.createRadialGradient(canvas.width * 0.25, canvas.height * 0.30, 20, canvas.width * 0.25, canvas.height * 0.30, 420);
  n1.addColorStop(0, "rgba(155,107,255,0.18)");
  n1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = n1;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const n2 = ctx.createRadialGradient(canvas.width * 0.75, canvas.height * 0.55, 20, canvas.width * 0.75, canvas.height * 0.55, 560);
  n2.addColorStop(0, "rgba(53,242,255,0.12)");
  n2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = n2;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // stars
  for (const layer of starLayers) {
    for (const s of layer.stars) {
      s.tw += s.tws;
      const a = layer.alpha + Math.sin(s.tw) * 0.05;

      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      s.y += layer.speed * (0.7 + difficulty * 0.03);
      if (s.y > canvas.height + 5) {
        s.y = -5;
        s.x = Math.random() * canvas.width;
      }
    }
  }

  // vignette
  const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, 620);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// -----------------------
// Highscore API
// -----------------------
async function loadHighScore() {
  try {
    const res = await fetch("/api/highscore");
    const data = await res.json();
    highEl.textContent = data.highscore ?? 0;
  } catch (e) {
    highEl.textContent = "0";
  }
}
async function sendHighScore(newScore) {
  try {
    const res = await fetch("/api/highscore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: newScore })
    });
    const data = await res.json();
    highEl.textContent = data.highscore ?? 0;
  } catch (e) { }
}

// -----------------------
// WebAudio SFX
// -----------------------
let audioCtx = null;
let SFX_ON = true;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function now() { return audioCtx ? audioCtx.currentTime : 0; }

function env(g, t0, a = 0.008, d = 0.12) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(1.0, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function tone(type, f0, f1, dur, vol) {
  if (!SFX_ON || !audioCtx) return;
  const t0 = now();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  o.connect(g); g.connect(audioCtx.destination);
  env(g, t0, 0.008, dur);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(vol = 0.2, dur = 0.09) {
  if (!SFX_ON || !audioCtx) return;
  const t0 = now();
  const size = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) {
    const k = 1 - i / size;
    d[i] = (Math.random() * 2 - 1) * k;
  }
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const hp = audioCtx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 650;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
  src.start(t0); src.stop(t0 + dur);
}

const SFX = {
  click() { tone("triangle", 520, 740, 0.08, 0.16); },
  start() { tone("sine", 440, 880, 0.12, 0.22); },
  boost() { tone("sawtooth", 180, 520, 0.14, 0.20); },
  gold() { tone("triangle", 980, 1580, 0.10, 0.18); },
  blue() { tone("sine", 720, 1240, 0.12, 0.20); },
  miss() { tone("square", 220, 140, 0.12, 0.14); },
  hit() { noise(0.22, 0.10); tone("square", 180, 90, 0.14, 0.14); },
  gameOver() { tone("sawtooth", 420, 120, 0.35, 0.20); noise(0.14, 0.12); }
};

// -----------------------
// HUD helpers
// -----------------------
function updateMissHUD() {
  if (!missedEl) return;
  missedEl.textContent = `${missed}/${MAX_MISSED}`;
  if (missed >= 5) missedEl.style.color = "rgba(255,80,80,0.98)";
  else missedEl.style.color = "";
}

function updateComboHUD(){
  // small toast, gives pro feel without changing HTML
  // (optional) you can later add a combo HUD card
  if(combo >= 2){
    showToast(`COMBO x${combo}!`);
  }
}

// -----------------------
// Reset
// -----------------------
function resetGame() {
  score = 0;
  lives = 3;
  frame = 0;
  difficulty = 1;

  meteors = [];
  goldStars = [];
  blueStars = [];
  satellites = [];
  debris = [];
  particles = [];

  shake = 0;

  missed = 0;
  updateMissHUD();

  combo = 1;
  comboTime = 0;
  hitFlash = 0;
  boostFlash = 0;

  rocket.x = canvas.width / 2 - rocket.w / 2;
  rocket.y = canvas.height - 110;
  rocket.vx = 0;
  rocket.boost = 0;
  rocket.tilt = 0;

  scoreEl.textContent = score;
  livesEl.textContent = lives;
}

// -----------------------
// Speed variants
// -----------------------
function speedVariant() {
  const r = Math.random();
  if (r < 0.22) return "slow";
  if (r < 0.78) return "med";
  return "fast";
}
function applySpeedMultiplier(variant) {
  if (variant === "slow") return 0.55;
  if (variant === "fast") return 1.55;
  return 1.0;
}

// -----------------------
// Spawning
// -----------------------
function pickMeteorType(lvl) {
  const r = Math.random();
  const zig = Math.min(0.22 + lvl * 0.015, 0.40);
  const fast = Math.min(0.18 + lvl * 0.02, 0.55);
  const slow = 0.12;

  if (r < zig) return "zigzag";
  if (r < zig + fast) return "fast";
  if (r < zig + fast + slow) return "slow";
  return "normal";
}

function spawnMeteor(lvl) {
  const type = pickMeteorType(lvl);
  const variant = speedVariant();
  const mult = applySpeedMultiplier(variant);

  let rMin, rMax, vyMin, vyMax, vxScale;

  if (type === "slow") { rMin = 26; rMax = 44; vyMin = 3.8; vyMax = 5.8; vxScale = 0.55; }
  else if (type === "fast") { rMin = 10; rMax = 18; vyMin = 9.8; vyMax = 13.4; vxScale = 1.05; }
  else if (type === "zigzag") { rMin = 16; rMax = 28; vyMin = 6.8; vyMax = 9.8; vxScale = 1.25; }
  else { rMin = 14; rMax = 32; vyMin = 5.8; vyMax = 9.6; vxScale = 0.9; }

  meteors.push({
    type,
    variant,
    x: rand(20, canvas.width - 20),
    y: -90,
    r: rand(rMin, rMax),
    vy: (rand(vyMin, vyMax) + difficulty * 0.85) * mult,
    vx: (rand(-0.70, 0.70) * (difficulty * 0.40) * vxScale) *
      (variant === "slow" ? 0.7 : variant === "fast" ? 1.2 : 1.0),

    phase: rand(0, Math.PI * 2),
    zigStrength: rand(2.8, 4.2),
    zigSpeed: rand(0.08, 0.13),

    rot: rand(0, Math.PI * 2),
    rotv: rand(-0.005, 0.005)
  });
}

function spawnGoldStar() {
  goldStars.push({
    x: rand(30, canvas.width - 30),
    y: -40,
    r: 12,
    vy: rand(3.0, 4.6) + difficulty * 0.20,
    spin: rand(0, Math.PI * 2),
    spinv: rand(-0.05, 0.05)
  });
}

function spawnBlueStar() {
  blueStars.push({
    x: rand(30, canvas.width - 30),
    y: -60,
    r: 14,
    vy: rand(13.5, 17.0) + difficulty * 0.55,
    spin: rand(0, Math.PI * 2),
    spinv: rand(-0.10, 0.10)
  });
}

function spawnSatellite() {
  const dir = Math.random() < 0.5 ? -1 : 1;
  const y = rand(70, canvas.height * 0.55);
  const size = rand(40, 58);

  satellites.push({
    variant: speedVariant(),
    x: dir === -1 ? canvas.width + 110 : -110,
    y,
    w: size * 2.0,
    h: size * 1.15,
    vx: dir * -(2.4 + difficulty * 0.40),
    rot: rand(-0.5, 0.5),
    rotv: rand(-0.012, 0.012),
  });

  const s = satellites[satellites.length - 1];
  const mult = applySpeedMultiplier(s.variant);
  s.vx *= (mult * 0.85);
}

function spawnDebris() {
  const variant = speedVariant();
  const mult = applySpeedMultiplier(variant);
  const r = rand(16, 26);

  debris.push({
    variant,
    x: rand(20, canvas.width - 20),
    y: -50,
    r,
    vy: (rand(5.2, 8.8) + difficulty * 0.50) * mult,
    vx: rand(-1.5, 1.5) * (variant === "slow" ? 0.6 : variant === "fast" ? 1.25 : 1.0),
    rot: rand(0, Math.PI * 2),
    rotv: rand(-0.12, 0.12),
  });
}

// -----------------------
// FX
// -----------------------
function addParticles(x, y, n = 18, col = "rgba(255,255,255,0.60)") {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(1.1, 4.8);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(18, 54),
      max: 54,
      col
    });
  }
}

// -----------------------
// Drawing
// -----------------------
function drawRocket() {
  const cx = rocket.x + rocket.w / 2;
  const cy = rocket.y + rocket.h / 2;

  // tilt reacts to speed
  const targetTilt = clamp(rocket.vx / 18, -1, 1) * 0.35;
  rocket.tilt += (targetTilt - rocket.tilt) * 0.20;

  // idle float
  const bob = Math.sin(frame * 0.09) * 2.2;

  // glow
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(80, 160, 255, ${0.08 + (rocket.boost>0?0.04:0)})`;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.rotate(rocket.tilt);

  // body capsule
  ctx.beginPath();
  ctx.moveTo(0, -rocket.h * 0.48);
  ctx.quadraticCurveTo(rocket.w * 0.55, -rocket.h * 0.18, rocket.w * 0.36, rocket.h * 0.20);
  ctx.quadraticCurveTo(rocket.w * 0.22, rocket.h * 0.45, 0, rocket.h * 0.48);
  ctx.quadraticCurveTo(-rocket.w * 0.22, rocket.h * 0.45, -rocket.w * 0.36, rocket.h * 0.20);
  ctx.quadraticCurveTo(-rocket.w * 0.55, -rocket.h * 0.18, 0, -rocket.h * 0.48);
  ctx.closePath();

  // white body
  const bodyGrad = ctx.createLinearGradient(-rocket.w / 2, 0, rocket.w / 2, 0);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.98)");
  bodyGrad.addColorStop(0.45, "rgba(245,250,255,0.90)");
  bodyGrad.addColorStop(1, "rgba(200,210,230,0.80)");
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  // blue stripe
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(-rocket.w * 0.24, -rocket.h * 0.05);
  ctx.quadraticCurveTo(0, rocket.h * 0.10, rocket.w * 0.24, rocket.h * 0.02);
  ctx.quadraticCurveTo(rocket.w * 0.10, rocket.h * 0.26, 0, rocket.h * 0.28);
  ctx.quadraticCurveTo(-rocket.w * 0.10, rocket.h * 0.26, -rocket.w * 0.24, -rocket.h * 0.05);
  ctx.closePath();

  const stripe = ctx.createLinearGradient(-rocket.w / 2, 0, rocket.w / 2, 0);
  stripe.addColorStop(0, "rgba(60, 140, 255, 0.65)");
  stripe.addColorStop(0.5, "rgba(0, 92, 230, 0.95)");
  stripe.addColorStop(1, "rgba(60, 140, 255, 0.65)");
  ctx.fillStyle = stripe;
  ctx.fill();
  ctx.restore();

  // nose red
  ctx.beginPath();
  ctx.moveTo(0, -rocket.h * 0.52);
  ctx.quadraticCurveTo(rocket.w * 0.22, -rocket.h * 0.42, rocket.w * 0.12, -rocket.h * 0.28);
  ctx.quadraticCurveTo(0, -rocket.h * 0.18, -rocket.w * 0.12, -rocket.h * 0.28);
  ctx.quadraticCurveTo(-rocket.w * 0.22, -rocket.h * 0.42, 0, -rocket.h * 0.52);
  ctx.closePath();

  const nose = ctx.createLinearGradient(0, -rocket.h * 0.52, 0, -rocket.h * 0.20);
  nose.addColorStop(0, "rgba(255, 60, 80, 0.98)");
  nose.addColorStop(1, "rgba(200, 0, 20, 0.82)");
  ctx.fillStyle = nose;
  ctx.fill();

  // fins red
  ctx.fillStyle = "rgba(235, 30, 60, 0.88)";
  ctx.beginPath();
  ctx.moveTo(-rocket.w * 0.28, rocket.h * 0.16);
  ctx.lineTo(-rocket.w * 0.60, rocket.h * 0.36);
  ctx.lineTo(-rocket.w * 0.18, rocket.h * 0.36);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(rocket.w * 0.28, rocket.h * 0.16);
  ctx.lineTo(rocket.w * 0.60, rocket.h * 0.36);
  ctx.lineTo(rocket.w * 0.18, rocket.h * 0.36);
  ctx.closePath();
  ctx.fill();

  // window
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, -rocket.h * 0.10, rocket.w * 0.18, 0, Math.PI * 2);
  const win = ctx.createRadialGradient(-2, -2, 2, 0, 0, rocket.w * 0.22);
  win.addColorStop(0, "rgba(255,255,255,0.85)");
  win.addColorStop(0.35, "rgba(60,190,255,0.65)");
  win.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = win;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // flame
  if (rocket.boost > 0) {
    const fx = rocket.x + rocket.w / 2;
    const fy = rocket.y + rocket.h * 0.98;

    ctx.save();
    ctx.globalAlpha = 0.92;

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx - 14, fy + rand(20, 32), fx, fy + rand(46, 74));
    ctx.quadraticCurveTo(fx + 14, fy + rand(20, 32), fx, fy);
    ctx.closePath();

    const flame = ctx.createLinearGradient(0, fy, 0, fy + 80);
    flame.addColorStop(0, "rgba(255,255,255,0.95)");
    flame.addColorStop(0.30, "rgba(180,225,255,0.95)");
    flame.addColorStop(0.58, "rgba(60, 140, 255, 0.65)");
    flame.addColorStop(1, "rgba(0,0,0,0.0)");
    ctx.fillStyle = flame;
    ctx.fill();

    ctx.restore();
  }
}

function drawMeteor(m) {
  const glowAlpha = m.variant === "fast" ? 0.20 : m.variant === "slow" ? 0.10 : 0.14;

  ctx.save();
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r + 18, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 140, 60, ${glowAlpha})`;
  ctx.fill();
  ctx.restore();

  if (m.variant === "fast") {
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + m.r * 1.2, m.r * 0.65, m.r * 1.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 140, 60, 0.18)";
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot);

  ctx.beginPath();
  ctx.arc(0, 0, m.r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-m.r * 0.35, -m.r * 0.35, 4, 0, 0, m.r);
  g.addColorStop(0, METEOR_THEME.core);
  g.addColorStop(0.55, METEOR_THEME.mid);
  g.addColorStop(1, METEOR_THEME.outer);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.arc(rand(-m.r * 0.55, m.r * 0.55), rand(-m.r * 0.55, m.r * 0.55), rand(0.7, 1.8), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
  }

  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 3; i++) {
    const cx = rand(-m.r * 0.30, m.r * 0.30);
    const cy = rand(-m.r * 0.30, m.r * 0.30);
    const cr = rand(m.r * 0.12, m.r * 0.22);

    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = METEOR_THEME.crater;
    ctx.fill();

    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(cx - cr * 0.25, cy - cr * 0.25, cr * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.fill();

    ctx.globalAlpha = 0.32;
  }

  ctx.restore();
}

function drawStar(x, y, outerR, innerR, rotation, color, glow) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, outerR + 18, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 === 0) ? outerR : innerR;
    const a = i * Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();

  const g = ctx.createLinearGradient(-outerR, -outerR, outerR, outerR);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.45, color);
  g.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function drawSatellite(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);

  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.beginPath();
  ctx.roundRect(-s.w * 0.22, -s.h * 0.18, s.w * 0.44, s.h * 0.36, 12);
  ctx.fill();

  ctx.fillStyle = "rgba(53,242,255,0.35)";
  ctx.beginPath();
  ctx.roundRect(-s.w * 0.75, -s.h * 0.28, s.w * 0.40, s.h * 0.56, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(s.w * 0.35, -s.h * 0.28, s.w * 0.40, s.h * 0.56, 12);
  ctx.fill();

  ctx.restore();
}

function drawDebris(d) {
  const a = d.variant === "fast" ? 0.75 : d.variant === "slow" ? 0.40 : 0.55;

  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);

  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.roundRect(-d.r, -d.r * 0.6, d.r * 2.1, d.r * 1.2, 8);
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rand(1.2, 2.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// overlays for interaction feedback
function drawScreenOverlays(){
  if(boostFlash > 0){
    ctx.save();
    ctx.globalAlpha = boostFlash / 22;
    ctx.fillStyle = "rgba(60, 140, 255, 0.22)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    boostFlash--;
  }

  if(hitFlash > 0){
    ctx.save();
    ctx.globalAlpha = hitFlash / 22;
    ctx.fillStyle = "rgba(255, 30, 60, 0.22)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    hitFlash--;
  }

  // combo vignette
  if(combo >= 2){
    const a = Math.min(0.12, combo * 0.03);
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 120, canvas.width/2, canvas.height/2, 650);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(60,140,255,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
  }
}

// -----------------------
// Update
// -----------------------
function update() {
  if (!running || paused) return;

  frame++;

  const lvl = 1 + Math.floor(frame / 280);
  difficulty = 1 + lvl * 0.70;

  // combo decay
  if(comboTime > 0) comboTime--;
  if(comboTime === 0 && combo > 1) combo = 1;

  // movement
  if (keys["ArrowLeft"]) rocket.vx -= 1.85;
  if (keys["ArrowRight"]) rocket.vx += 1.85;

  if (keys["Space"] && rocket.boost <= 0) {
    rocket.boost = 18;
    boostFlash = 18; // NEW
    addParticles(rocket.x + rocket.w / 2, rocket.y + rocket.h, 22, "rgba(180,225,255,0.40)");
    SFX.boost();
  }
  if (rocket.boost > 0) {
    rocket.boost--;
    rocket.vx *= 1.05;
  }

  rocket.vx *= 0.88;
  rocket.vx = clamp(rocket.vx, -18, 18);

  rocket.x += rocket.vx;
  rocket.x = clamp(rocket.x, 10, canvas.width - rocket.w - 10);

  // spawns
  const meteorRate = Math.max(6, 22 - lvl * 2);
  if (frame % meteorRate === 0) spawnMeteor(lvl);

  if (frame % 170 === 0) spawnGoldStar();

  const blueRate = Math.max(420, 720 - lvl * 60);
  if (lvl >= 2 && frame % blueRate === 0) spawnBlueStar();

  const satRate = Math.max(260, 560 - lvl * 40);
  if (frame % satRate === 0) spawnSatellite();

  if (lvl >= 3 && frame % Math.max(12, 26 - lvl) === 0) {
    if (Math.random() < 0.55) spawnDebris();
  }

  // meteors
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.y += m.vy;

    if (m.type === "zigzag") {
      m.phase += m.zigSpeed;
      m.x += Math.sin(m.phase) * m.zigStrength;
    } else {
      m.x += m.vx;
    }

    m.x = clamp(m.x, 10, canvas.width - 10);
    m.rot += m.rotv;

    if (m.y > canvas.height + 140) {
      meteors.splice(i, 1);
      if (frame % 22 === 0) score += 1;
    } else {
      const hit = rectCircleCollide(rocket.x, rocket.y, rocket.w, rocket.h, m.x, m.y, m.r);
      if (hit) {
        meteors.splice(i, 1);
        shake = 18;
        hitFlash = 18; // NEW
        vibrate(60);

        addParticles(m.x, m.y, 30, "rgba(255,80,80,0.55)");
        lives--;
        livesEl.textContent = lives;
        bump(livesEl);

        combo = 1;
        comboTime = 0;

        SFX.hit();
        showToast("Meteor hit! -1 life");
        if (lives <= 0) { gameOver("Destroyed!"); return; }
      }
    }
  }

  // gold stars
  for (let i = goldStars.length - 1; i >= 0; i--) {
    const s = goldStars[i];
    s.y += s.vy;
    s.spin += s.spinv;

    if (s.y > canvas.height + 80) {
      goldStars.splice(i, 1);

      missed++;
      updateMissHUD();
      bump(missedEl);

      // combo reset on miss (more interactive)
      combo = 1;
      comboTime = 0;

      SFX.miss();
      if (missed > MAX_MISSED) {
        gameOver("Too many stars missed!");
        return;
      } else {
        showToast(`Missed star (${missed}/${MAX_MISSED})`);
      }
    } else {
      const got = rectCircleCollide(rocket.x, rocket.y, rocket.w, rocket.h, s.x, s.y, s.r);
      if (got) {
        goldStars.splice(i, 1);

        // combo logic
        comboTime = 180; // keep combo active for 3 sec
        combo = Math.min(6, combo + 1);

        const gained = Math.floor(25 * combo);
        score += gained;

        addParticles(s.x, s.y, 20, "rgba(255, 209, 102, 0.55)");
        boostFlash = Math.min(22, boostFlash + 6);

        SFX.gold();
        vibrate(25);

        scoreEl.textContent = score;
        bump(scoreEl);

        showToast(`+${gained} ⭐ x${combo}`);
      }
    }
  }

  // blue stars (+1 life)
  for (let i = blueStars.length - 1; i >= 0; i--) {
    const b = blueStars[i];
    b.y += b.vy;
    b.spin += b.spinv;

    if (b.y > canvas.height + 120) {
      blueStars.splice(i, 1);
    } else {
      const got = rectCircleCollide(rocket.x, rocket.y, rocket.w, rocket.h, b.x, b.y, b.r);
      if (got) {
        blueStars.splice(i, 1);
        if (lives < MAX_LIVES) {
          lives++;
          livesEl.textContent = lives;
          bump(livesEl);
          showToast("+1 LIFE 🔷");
        } else {
          showToast("Life Full!");
        }
        addParticles(b.x, b.y, 22, "rgba(53,242,255,0.65)");
        SFX.blue();
        vibrate(30);
      }
    }
  }

  // satellites
  for (let i = satellites.length - 1; i >= 0; i--) {
    const s = satellites[i];
    s.x += s.vx;
    s.rot += s.rotv;

    if (s.x < -180 || s.x > canvas.width + 180) {
      satellites.splice(i, 1);
      continue;
    }

    const cr = Math.max(s.w, s.h) * 0.36;
    const hit = rectCircleCollide(rocket.x, rocket.y, rocket.w, rocket.h, s.x, s.y, cr);
    if (hit) {
      satellites.splice(i, 1);
      shake = 20;
      hitFlash = 18;
      vibrate(70);

      addParticles(s.x, s.y, 36, "rgba(53,242,255,0.55)");
      lives--;
      livesEl.textContent = lives;
      bump(livesEl);

      combo = 1;
      comboTime = 0;

      SFX.hit();
      showToast("Satellite crash! -1 life");
      if (lives <= 0) { gameOver("Crashed!"); return; }
    }
  }

  // debris
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.y += d.vy;
    d.x += d.vx;
    d.rot += d.rotv;

    if (d.x < 10 || d.x > canvas.width - 10) d.vx *= -1;

    if (d.y > canvas.height + 100) {
      debris.splice(i, 1);
    } else {
      const hit = rectCircleCollide(rocket.x, rocket.y, rocket.w, rocket.h, d.x, d.y, d.r);
      if (hit) {
        debris.splice(i, 1);
        shake = 16;
        hitFlash = 18;
        vibrate(60);

        addParticles(d.x, d.y, 24, "rgba(255,255,255,0.60)");
        lives--;
        livesEl.textContent = lives;
        bump(livesEl);

        combo = 1;
        comboTime = 0;

        SFX.hit();
        showToast("Debris hit! -1 life");
        if (lives <= 0) { gameOver("Destroyed!"); return; }
      }
    }
  }

  // score tick (slow)
  if (frame % 14 === 0) score += 1;
  scoreEl.textContent = score;

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life--;
    p.x += p.vx;
    p.y += p.vy;
    p.vy *= 0.985;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// -----------------------
// Render
// -----------------------
function render() {
  drawSpaceBackground();

  ctx.save();
  if (shake > 0) {
    shake--;
    ctx.translate(rand(-shake, shake) * 0.45, rand(-shake, shake) * 0.45);
  }

  for (const s of goldStars) {
    drawStar(s.x, s.y, s.r, s.r * 0.52, s.spin, "rgba(255, 209, 102, 0.95)", "rgba(255, 209, 102, 0.16)");
  }
  for (const b of blueStars) {
    drawStar(b.x, b.y, b.r, b.r * 0.52, b.spin, "rgba(53,242,255,0.95)", "rgba(53,242,255,0.18)");
  }

  for (const d of debris) drawDebris(d);
  for (const s of satellites) drawSatellite(s);
  for (const m of meteors) drawMeteor(m);

  drawParticles();
  drawRocket();

  ctx.restore();

  // overlays (hit/boost/combo)
  drawScreenOverlays();

  // pause overlay text
  if(paused){
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "900 30px Inter, system-ui";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width/2, canvas.height/2);
    ctx.font = "600 14px Inter, system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText("Press P or Pause Button", canvas.width/2, canvas.height/2 + 28);
    ctx.restore();
  }
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// -----------------------
// Flow
// -----------------------
function startGame() {
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => { });

  resetGame();
  running = true;
  paused = false;

  overlay.classList.add("hidden");
  how.classList.add("hidden");

  SFX.start();
  showToast("SPACE RUN!");
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  showToast(paused ? "Paused" : "Resume");
}

function gameOver(reason = "Game Over!") {
  running = false;
  paused = false;

  overlay.classList.remove("hidden");
  startBtn.textContent = "Play Again";

  SFX.gameOver();
  showToast(reason);
  sendHighScore(score);
}

// -----------------------
// Inputs
// -----------------------
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyP") togglePause();
});
window.addEventListener("keyup", (e) => keys[e.code] = false);

// pointer drag
let drag = false;
canvas.addEventListener("pointerdown", () => drag = true);
canvas.addEventListener("pointerup", () => drag = false);
canvas.addEventListener("pointerleave", () => drag = false);
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  rocket.x = clamp(x - rocket.w / 2, 10, canvas.width - rocket.w - 10);
});

// mobile joystick
let padActive = false;
let padCenterX = 0;

function setDot(dx, dy) {
  const max = 36;
  const x = clamp(dx, -max, max);
  const y = clamp(dy, -max, max);
  if (touchDot) {
    touchDot.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }
  return { x, y };
}

if (touchPad) {
  touchPad.addEventListener("pointerdown", (e) => {
    padActive = true;
    const r = touchPad.getBoundingClientRect();
    padCenterX = r.left + r.width / 2;
    touchPad.setPointerCapture(e.pointerId);
  });

  touchPad.addEventListener("pointermove", (e) => {
    if (!padActive) return;
    const dx = e.clientX - padCenterX;
    const v = setDot(dx, 0);
    rocket.vx += (v.x / 36) * 1.60;
  });

  touchPad.addEventListener("pointerup", () => {
    padActive = false;
    setDot(0, 0);
  });
}

// mobile boost
if (boostBtn) {
  boostBtn.addEventListener("click", () => {
    if (!running || paused) return;
    if (rocket.boost <= 0) {
      rocket.boost = 18;
      boostFlash = 18;
      addParticles(rocket.x + rocket.w / 2, rocket.y + rocket.h, 22, "rgba(180,225,255,0.40)");
      SFX.boost();
      showToast("BOOST!");
      vibrate(35);
    }
  });
}
if (pauseBtnMobile) pauseBtnMobile.addEventListener("click", togglePause);

// buttons
startBtn.addEventListener("click", () => { SFX.click(); startGame(); });
restartBtn.addEventListener("click", () => { SFX.click(); startGame(); });
pauseBtn.addEventListener("click", () => { SFX.click(); togglePause(); });

howBtn.addEventListener("click", () => {
  SFX.click();
  overlay.classList.add("hidden");
  how.classList.remove("hidden");
});
closeHow.addEventListener("click", () => {
  SFX.click();
  how.classList.add("hidden");
  overlay.classList.remove("hidden");
});

// init
loadHighScore();
updateMissHUD();
initSpaceBackground();
loop();
window.addEventListener("resize", () => initSpaceBackground());
