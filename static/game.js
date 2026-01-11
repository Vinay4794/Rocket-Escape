// =====================
// Canvas Setup (Responsive)
// =====================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// stage container for responsive sizing (added in HTML: id="stageContainer")
const stage = document.getElementById("stageContainer");

// UI refs
const difficultyProgress = document.getElementById("difficultyProgress");
const tipText = document.getElementById("tipText");

// HUD
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const highScoreTopEl = document.getElementById("highScoreTop");

// Drawer UI
const diffFill = document.getElementById("diffFill");
const diffLabel = document.getElementById("diffLabel");
const lastScoreEl = document.getElementById("lastScore");
const bestStreakEl = document.getElementById("bestStreak");
const soundStateEl = document.getElementById("soundState");
const badge1 = document.getElementById("badge1");
const badge2 = document.getElementById("badge2");
const badge3 = document.getElementById("badge3");

// Buttons
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const soundBtn = document.getElementById("soundBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn"); // ✅ Fullscreen

// ✅ In-game ribbon box controls
const gameRibbonBox = document.getElementById("gameRibbonBox");
const grStart = document.getElementById("grStart");
const grRestart = document.getElementById("grRestart");
const grSound = document.getElementById("grSound");

// Overlay
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");

// Mode
const modeSelect = document.getElementById("modeSelect");

// Drawer Controls
const drawer = document.getElementById("drawer");
const drawerBtn = document.getElementById("drawerBtn");
const drawerClose = document.getElementById("drawerClose");

// ✅ Mobile controls (correct ids)
const mobUp = document.getElementById("btnUp");
const mobDown = document.getElementById("btnDown");
let hasStartedOnce = false; // ✅ Start button only for first time
function updateStartRestartUI() {
  if (!startBtn || !restartBtn) return;

  if (!hasStartedOnce) {
    startBtn.style.display = "inline-flex";
    restartBtn.style.display = "none";
  } else {
    startBtn.style.display = "none";
    restartBtn.style.display = "inline-flex";
  }
}

// =====================
// Utils
// =====================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rr = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));

let touchTargetY = null; // where finger wants rocket to go
let lastTouchY = null;

const TOUCH_SMOOTHING = 0.18; // lower = smoother (0.10–0.25 best)
const DEAD_ZONE = 6; // px ignore micro movements
const MAX_TOUCH_SPEED = 18; // px per frame cap speed

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}
function hideOverlay() {
  overlay.classList.add("hidden");
}

// ✅ In-game Ribbon show/hide
function showGameRibbonBox() {
  gameRibbonBox?.classList.remove("hidden");
}
function hideGameRibbonBox() {
  gameRibbonBox?.classList.add("hidden");
}

function updateBadges() {
  badge1?.classList.toggle("active", state.best >= 50);
  badge2?.classList.toggle("active", state.best >= 150);
  badge3?.classList.toggle("active", state.best >= 300);
}

// =====================
// Mode scaling
// =====================
const MODE = {
  easy: { speedBase: 6.4, speedMax: 12.5, spawnEvery: 78, spawnMin: 46, gapBase: 182, gapMin: 112, bossPenalty: 16 },
  medium: { speedBase: 7.2, speedMax: 15.5, spawnEvery: 68, spawnMin: 32, gapBase: 170, gapMin: 92, bossPenalty: 28 },
  hard: { speedBase: 8.0, speedMax: 18.0, spawnEvery: 62, spawnMin: 28, gapBase: 160, gapMin: 84, bossPenalty: 34 }
};

function currentMode() {
  return MODE[modeSelect.value] || MODE.medium;
}

// =====================
// State
// =====================
const state = {
  running: false,
  paused: false,
  over: false,
  score: 0,
  best: parseInt(localStorage.getItem("rocket_best") || "0", 10),
  frame: 0,

  speed: 7.2,
  speedMax: 15.5,
  spawnEvery: 68,
  spawnMin: 32,
  spawnTimer: 0,

  boss: {
    active: false,
    timer: 0,
    durationFrames: 120,
    cooldown: 0,
    lastTriggerScore: -999999 // ✅ prevents accidental multi-trigger
  },

  coinsCollected: 0
};

bestEl.textContent = state.best;
highScoreTopEl.textContent = state.best;

// streak
let streak = 0;
let bestStreak = parseInt(localStorage.getItem("rocket_best_streak") || "0", 10);

// Inputs
const keys = { up: false, down: false };

// Rocket
const rocket = {
  x: 150,
  y: 200,
  w: 42,
  h: 21,
  vy: 0,
  accel: 1.45,
  drag: 0.91
};

// ✅ Hitbox shrink (fair game feel)
const HITBOX_PAD_X = 10;
const HITBOX_PAD_Y = 6;

// World objects
let obstacles = [];
let particles = [];
let stars = [];
let coins = [];
let powerups = [];

// Active powerups
const active = { shield: 0, slow: 0, nitro: 0, magnet: 0 };

// Logical stage size (CSS pixels)
let W = 0;
let H = 0;

function clampRocketIntoView() {
  rocket.y = clamp(rocket.y, rocket.h / 2, H - rocket.h / 2);
}

// =====================
// Responsive Canvas Resize
// =====================
function resizeCanvasToStage() {
  if (!stage) return;

  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // logical (CSS pixel size)
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);

  // physical size
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);

  // draw in CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // keep rocket in view
  clampRocketIntoView();

  // regen stars for new size
  initStars();
}

window.addEventListener("resize", resizeCanvasToStage);
window.addEventListener("orientationchange", resizeCanvasToStage);
resizeCanvasToStage();

// =====================
// Fullscreen Support ✅ (Pro Mobile Version)
// =====================
function setFullscreenClass(on) {
  document.body.classList.toggle("fullscreen-game", on);
}

// optional helper (shows status text)
function showStatusToast(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  setTimeout(() => {
    if (!state.over) statusEl.textContent = state.paused ? "Paused" : (state.running ? "Running" : "Ready");
  }, 1500);
}

async function lockLandscapeIfPossible() {
  // Works on supported mobile browsers only
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock("landscape");
      return true;
    }
  } catch (e) {
    // ignore (browser may block it)
  }
  return false;
}

async function unlockOrientationIfPossible() {
  try {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  } catch (e) {}
}

async function toggleFullscreen() {
  try {
    // ENTER fullscreen
    if (!document.fullscreenElement) {
      // Must be triggered by user gesture (button click)
      await stage.requestFullscreen();

      setFullscreenClass(true);

      // try lock landscape
      const locked = await lockLandscapeIfPossible();
      if (locked) showStatusToast("Landscape Mode 🔁");
      else showStatusToast("Fullscreen Enabled");

      // sharp resize
      setTimeout(() => resizeCanvasToStage(), 80);
      return;
    }

    // EXIT fullscreen
    await document.exitFullscreen();
    setFullscreenClass(false);

    await unlockOrientationIfPossible();

    setTimeout(() => resizeCanvasToStage(), 80);
  } catch (err) {
    console.log("Fullscreen error:", err);
    showStatusToast("Fullscreen Blocked");
  }
}

fullscreenBtn?.addEventListener("click", toggleFullscreen);

document.addEventListener("fullscreenchange", () => {
  const isFS = !!document.fullscreenElement;
  setFullscreenClass(isFS);

  // resize when browser changes fullscreen state
  setTimeout(() => resizeCanvasToStage(), 80);

  // if user exits fullscreen using gesture/back button
  if (!isFS) unlockOrientationIfPossible();
});

// =====================
// Drawer
// =====================
function openDrawer() {
  drawer.classList.remove("hidden");
}
function closeDrawer() {
  drawer.classList.add("hidden");
}

drawerBtn.onclick = () => (drawer.classList.contains("hidden") ? openDrawer() : closeDrawer());
drawerClose.onclick = closeDrawer;

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !drawer.classList.contains("hidden")) closeDrawer();
});

// =====================
// Audio
// =====================
let audioOn = true;
let audioCtx = null;
let musicTimer = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function beep(freq, duration = 0.06, type = "sine", gain = 0.04) {
  if (!audioOn) return;
  ensureAudio();
  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);

  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(g);
  g.connect(audioCtx.destination);

  osc.start(t);
  osc.stop(t + duration);
}

function startMusic() {
  if (!audioOn || musicTimer) return;

  let step = 0;
  const seq = [392, 440, 392, 330, 392, 523, 392, 330];

  musicTimer = setInterval(() => {
    if (!state.running || state.paused || state.over) return;
    beep(seq[step % seq.length], 0.05, "triangle", 0.02);
    step++;
  }, 240);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

// =====================
// Difficulty + boss
// =====================
function difficultyLevel() {
  return clamp(Math.floor(state.score / 140), 0, 10);
}

function bossGapPenalty() {
  const m = currentMode();
  return state.boss.active ? m.bossPenalty : 0;
}

// =====================
// Speed with powerups
// =====================
function effectiveSpeed() {
  let sp = state.speed;
  if (active.slow > 0) sp *= 0.7;
  if (active.nitro > 0) sp *= 1.25;
  return sp;
}

// =====================
// Background
// =====================
function initStars() {
  stars = [];
  for (let i = 0; i < 140; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 2 + 0.4,
      layer: rint(1, 3)
    });
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, W, H);

  for (const s of stars) {
    const v = (1 + state.speed * 0.085) * (0.25 * s.layer);
    s.x -= v;

    if (s.x < -10) {
      s.x = W + 10;
      s.y = Math.random() * H;
    }

    ctx.globalAlpha = 0.45 + s.layer * 0.15;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (state.boss.active) {
    ctx.save();
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = "rgba(255,60,120,1)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// =====================
// Particles
// =====================
function spawnParticles() {
  particles.push({
    x: rocket.x - rocket.w / 2 - rr(4, 10),
    y: rocket.y + rr(-6, 6),
    vx: -rr(2, 5) - state.speed * 0.25,
    vy: rr(-0.8, 0.8),
    life: rr(16, 24),
    size: rr(2, 5)
  });
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    p.size *= 0.98;
  }
  particles = particles.filter((p) => p.life > 0 && p.size > 0.5);
}

function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / 24, 0, 1);
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,180,60,0.9)";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// =====================
// Rocket Draw
// =====================
function drawRocket() {
  const tilt = clamp(rocket.vy * 0.09, -0.75, 0.75);

  ctx.save();
  ctx.translate(rocket.x, rocket.y);
  ctx.rotate(tilt);

  // Core glow
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.shadowBlur = 30;
  ctx.shadowColor = "rgba(35,210,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(0, 0, rocket.w * 0.65, rocket.h * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(35,210,255,0.10)";
  ctx.fill();
  ctx.restore();

  // Shield effect
  if (active.shield > 0) {
    ctx.save();
    const pulse = 0.65 + Math.sin(state.frame * 0.22) * 0.25;
    ctx.globalAlpha = 0.7;

    ctx.shadowBlur = 30;
    ctx.shadowColor = "rgba(35,210,255,0.75)";
    ctx.beginPath();
    ctx.arc(0, 0, 28 + pulse * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(35,210,255,${pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  // Body gradient
  const bodyGrad = ctx.createLinearGradient(-rocket.w / 2, 0, rocket.w / 2, 0);
  bodyGrad.addColorStop(0, "rgba(255,255,255,0.98)");
  bodyGrad.addColorStop(0.6, "rgba(200,225,255,0.92)");
  bodyGrad.addColorStop(1, "rgba(120,200,255,0.85)");

  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(65,120,255,0.35)";
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(-rocket.w / 2, -rocket.h / 2, rocket.w, rocket.h, 10);
  ctx.fill();

  // Window
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.ellipse(rocket.w * 0.08, -1, rocket.w * 0.18, rocket.h * 0.32, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(10,20,40,0.78)";
  ctx.fill();

  // Window highlight
  ctx.beginPath();
  ctx.ellipse(rocket.w * 0.12, -3, rocket.w * 0.08, rocket.h * 0.16, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fill();

  // Nose cone
  const noseGrad = ctx.createLinearGradient(rocket.w / 2, 0, rocket.w / 2 + 20, 0);
  noseGrad.addColorStop(0, "rgba(255,80,140,0.95)");
  noseGrad.addColorStop(1, "rgba(255,210,90,0.95)");

  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(rocket.w / 2, -rocket.h / 2);
  ctx.lineTo(rocket.w / 2 + 18, 0);
  ctx.lineTo(rocket.w / 2, rocket.h / 2);
  ctx.closePath();
  ctx.fill();

  // Tail fin
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(65,120,255,0.85)";
  ctx.beginPath();
  ctx.moveTo(-rocket.w / 2 + 4, -rocket.h / 2);
  ctx.lineTo(-rocket.w / 2 - 12, -rocket.h / 2 + 6);
  ctx.lineTo(-rocket.w / 2 + 4, -rocket.h / 2 + 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// =====================
// Obstacles
// =====================
function spawnObstacle() {
  const m = currentMode();
  const level = difficultyLevel();

  const baseGap = clamp(m.gapBase - level * 10, m.gapMin, m.gapBase);
  const gap = clamp(baseGap - bossGapPenalty(), 120, 300);

  const topH = Math.floor(rr(52, H - gap - 52));
  const bottomY = topH + gap;

  const midChance = clamp(0.18 + level * 0.07, 0, 0.9);
  const twoMidChance = clamp(level >= 5 ? 0.18 + (level - 5) * 0.08 : 0, 0, 0.65);
  const spinnerChance = clamp(level >= 4 ? 0.16 + (level - 4) * 0.08 : 0.0, 0, 0.6);

  const mids = [];
  const makeMid = () => {
    const midH = clamp(34 + level * 7, 34, 96);
    const midY = rr(topH + 16, bottomY - midH - 16);
    return { y: midY, h: midH, vy: rr(1.0, 2.0) + level * 0.16, dir: Math.random() < 0.5 ? -1 : 1 };
  };

  if (Math.random() < midChance) mids.push(makeMid());

  if (mids.length > 0 && Math.random() < twoMidChance) {
    let tries = 0;
    let second = makeMid();
    while (tries < 12) {
      const ok = mids.every((x) => Math.abs(x.y + x.h / 2 - (second.y + second.h / 2)) > 40);
      if (ok) break;
      second = makeMid();
      tries++;
    }
    mids.push(second);
  }

  let spinner = null;
  if (Math.random() < spinnerChance) {
    const radius = clamp(18 + level * 2, 18, 34);
    spinner = {
      cx: W + 80 + 38,
      cy: rr(topH + radius + 18, bottomY - radius - 18),
      r: radius,
      angle: rr(0, Math.PI * 2),
      angSpeed: rr(0.085, 0.15) + level * 0.01
    };
  }

  obstacles.push({
    x: W + 80,
    w: 76,
    topH,
    bottomY,
    seed: rr(0, Math.PI * 2),
    passed: false,
    mids,
    spinner
  });

  spawnCoinOrPowerup(topH, bottomY);
}

function updateObstacles() {
  const sp = effectiveSpeed();

  for (const o of obstacles) {
    o.x -= sp;

    const float = Math.sin(state.frame * 0.03 + o.seed) * 1.1;
    o.topH += float * 0.05;
    o.bottomY += float * 0.05;

    if (o.mids?.length) {
      for (const mid of o.mids) {
        mid.y += mid.vy * mid.dir;

        const topLimit = o.topH + 18;
        const bottomLimit = o.bottomY - mid.h - 18;

        if (mid.y < topLimit) {
          mid.y = topLimit;
          mid.dir *= -1;
        } else if (mid.y > bottomLimit) {
          mid.y = bottomLimit;
          mid.dir *= -1;
        }
      }
    }

    if (o.spinner) {
      o.spinner.cx = o.x + o.w / 2;
      o.spinner.angle += o.spinner.angSpeed;
    }
  }

  obstacles = obstacles.filter((o) => o.x + o.w > -140);
}

function drawObstacle(o) {
  const glow = 0.35 + Math.sin(state.frame * 0.05 + o.seed) * 0.2;

  const g = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
  g.addColorStop(0, `rgba(35,210,200,${0.2 + glow})`);
  g.addColorStop(1, `rgba(65,120,255,${0.2 + glow})`);

  // walls
  ctx.fillStyle = g;
  ctx.fillRect(o.x, 0, o.w, o.topH);
  ctx.fillRect(o.x, o.bottomY, o.w, H - o.bottomY);

  ctx.save();
  ctx.shadowBlur = 40;
  ctx.shadowColor = state.boss.active ? "rgba(255,70,140,0.55)" : "rgba(60,255,140,0.6)";

  ctx.strokeStyle = state.boss.active ? "rgba(255,255,255,0.25)" : "rgba(60,255,140,0.28)";
  ctx.lineWidth = 1.3;
  ctx.strokeRect(o.x, 0, o.w, o.topH);
  ctx.strokeRect(o.x, o.bottomY, o.w, H - o.bottomY);
  ctx.restore();

  // mids
  if (o.mids?.length) {
    for (const mid of o.mids) {
      const mg = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
      mg.addColorStop(0, "rgba(255,120,40,0.55)");
      mg.addColorStop(1, "rgba(255,70,170,0.35)");

      ctx.save();
      ctx.shadowBlur = 26;
      ctx.shadowColor = "rgba(255,120,50,0.45)";
      ctx.fillStyle = mg;
      ctx.fillRect(o.x + 6, mid.y, o.w - 12, mid.h);

      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let yy = mid.y; yy < mid.y + mid.h; yy += 14) {
        ctx.fillRect(o.x + 10, yy, o.w - 20, 4);
      }
      ctx.restore();
    }
  }

  // spinner
  if (o.spinner) {
    const sp = o.spinner;

    ctx.save();
    ctx.translate(sp.cx, sp.cy);
    ctx.rotate(sp.angle);

    ctx.shadowBlur = 22;
    ctx.shadowColor = "rgba(255,70,160,0.55)";

    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.roundRect(sp.r * 0.15, -6, sp.r * 1.05, 12, 8);
      ctx.fillStyle = "rgba(255,120,220,0.85)";
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, sp.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fill();

    ctx.restore();
  }
}

// =====================
// Coins + Powerups
// =====================
function spawnCoinOrPowerup(gapTop, gapBottom) {
  const level = difficultyLevel();

  const coinChance = clamp(0.55 - level * 0.02, 0.25, 0.55);
  const powerChance = clamp(0.1 + level * 0.01, 0.1, 0.22);

  const x = W + 90;
  const y = rr(gapTop + 30, gapBottom - 30);

  if (Math.random() < powerChance) {
    const types = ["shield", "slow", "nitro", "magnet"];
    const type = types[rint(0, types.length - 1)];
    powerups.push({ type, x, y, r: 14, pulse: rr(0, Math.PI * 2) });
    return;
  }

  if (Math.random() < coinChance) {
    const n = Math.random() < 0.35 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      coins.push({
        x: x + i * 32,
        y: y + rr(-18, 18),
        r: 10,
        spin: rr(0, Math.PI * 2)
      });
    }
  }
}

function updateCoinsAndPowerups() {
  const sp = effectiveSpeed();

  for (const c of coins) {
    c.x -= sp;
    c.spin += 0.15;

    if (active.magnet > 0) {
      const dx = rocket.x - c.x;
      const dy = rocket.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 220 * 220) {
        c.x += dx * 0.03;
        c.y += dy * 0.03;
      }
    }
  }
  coins = coins.filter((c) => c.x > -40);

  for (const p of powerups) {
    p.x -= sp;
    p.pulse += 0.08;

    if (active.magnet > 0) {
      const dx = rocket.x - p.x;
      const dy = rocket.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 230 * 230) {
        p.x += dx * 0.02;
        p.y += dy * 0.02;
      }
    }
  }
  powerups = powerups.filter((p) => p.x > -60);
}

function drawCoinsAndPowerups() {
  for (const c of coins) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.spin);

    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(255,210,60,0.55)";

    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,210,60,0.95)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, c.r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fill();

    ctx.restore();
  }

  for (const p of powerups) {
    const pulse = 0.7 + Math.sin(p.pulse) * 0.25;

    ctx.save();
    ctx.translate(p.x, p.y);

    let col = "rgba(35,210,255,0.65)";
    let txt = "S";
    if (p.type === "shield") {
      col = "rgba(35,210,255,0.75)";
      txt = "🛡";
    }
    if (p.type === "slow") {
      col = "rgba(120,200,255,0.75)";
      txt = "🐢";
    }
    if (p.type === "nitro") {
      col = "rgba(255,120,50,0.75)";
      txt = "⚡";
    }
    if (p.type === "magnet") {
      col = "rgba(255,70,210,0.65)";
      txt = "🧲";
    }

    ctx.shadowBlur = 20;
    ctx.shadowColor = col;

    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + pulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();

    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(txt, 0, 1);

    ctx.restore();
  }
}

function applyPowerup(type) {
  if (type === "shield") active.shield = 360;
  if (type === "slow") active.slow = 240;
  if (type === "nitro") active.nitro = 200;
  if (type === "magnet") active.magnet = 360;

  const nameMap = {
    shield: "Shield Activated!",
    slow: "Slow Motion!",
    nitro: "Nitro Boost!",
    magnet: "Magnet ON!"
  };
  statusEl.textContent = nameMap[type] || "Powerup!";
  beep(980, 0.06, "triangle", 0.055);
  setTimeout(() => beep(1320, 0.06, "sine", 0.04), 60);
}

function updateActivePowerups() {
  if (active.shield > 0) active.shield--;
  if (active.slow > 0) active.slow--;
  if (active.nitro > 0) active.nitro--;
  if (active.magnet > 0) active.magnet--;
}

// =====================
// Collision + collectibles
// =====================
function rocketRect() {
  const halfW = rocket.w / 2;
  const halfH = rocket.h / 2;

  return {
    l: rocket.x - halfW + HITBOX_PAD_X,
    r: rocket.x + halfW - HITBOX_PAD_X,
    t: rocket.y - halfH + HITBOX_PAD_Y,
    b: rocket.y + halfH - HITBOX_PAD_Y
  };
}

function checkHit() {
  const R = rocketRect();

  if (R.t < 0 || R.b > H) return true;

  for (const o of obstacles) {
    const inX = R.r > o.x && R.l < o.x + o.w;
    if (!inX) continue;

    if (R.t < o.topH || R.b > o.bottomY) return true;

    if (o.mids?.length) {
      for (const mid of o.mids) {
        const midLeft = o.x + 6;
        const midRight = o.x + o.w - 6;
        const midTop = mid.y;
        const midBottom = mid.y + mid.h;

        if (R.r > midLeft && R.l < midRight && R.b > midTop && R.t < midBottom) return true;
      }
    }

    if (o.spinner) {
      const sp = o.spinner;
      const cx = sp.cx;
      const cy = sp.cy;
      const rad = sp.r * 0.95;

      const closestX = clamp(cx, R.l, R.r);
      const closestY = clamp(cy, R.t, R.b);
      const dx = cx - closestX;
      const dy = cy - closestY;
      if (dx * dx + dy * dy <= rad * rad) return true;
    }
  }

  return false;
}

function checkCollectibles() {
  const R = rocketRect();

  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const cx = clamp(c.x, R.l, R.r);
    const cy = clamp(c.y, R.t, R.b);
    const dx = c.x - cx;
    const dy = c.y - cy;

    if (dx * dx + dy * dy <= c.r * c.r) {
      coins.splice(i, 1);
      state.coinsCollected++;
      state.score += active.nitro > 0 ? 8 : 5;
      beep(1200, 0.04, "sine", 0.03);
    }
  }

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const cx = clamp(p.x, R.l, R.r);
    const cy = clamp(p.y, R.t, R.b);
    const dx = p.x - cx;
    const dy = p.y - cy;

    if (dx * dx + dy * dy <= (p.r + 2) * (p.r + 2)) {
      powerups.splice(i, 1);
      applyPowerup(p.type);
    }
  }
}

// =====================
// Boss Event
// =====================
function updateBossEvent() {
  if (state.boss.cooldown > 0) state.boss.cooldown--;

  const shouldTrigger =
    state.score > 0 &&
    state.score % 500 === 0 &&
    state.score !== state.boss.lastTriggerScore;

  if (!state.boss.active && state.boss.cooldown <= 0 && shouldTrigger) {
    state.boss.active = true;
    state.boss.timer = state.boss.durationFrames;
    state.boss.cooldown = 520;
    state.boss.lastTriggerScore = state.score;

    statusEl.textContent = "BOSS MODE!";
    beep(880, 0.12, "sawtooth", 0.06);
    setTimeout(() => beep(660, 0.12, "triangle", 0.05), 80);
  }

  if (state.boss.active) {
    state.boss.timer--;
    if (state.boss.timer <= 0) {
      state.boss.active = false;
      statusEl.textContent = "Running";
      beep(520, 0.07, "triangle", 0.045);
    }
  }
}

// =====================
// Difficulty UI
// =====================
function updateDifficultyUI() {
  const pct = Math.min(100, 10 + Math.floor(state.score / 10));
  if (diffFill) diffFill.style.width = pct + "%";
  if (difficultyProgress) difficultyProgress.style.width = pct + "%";

  if (modeSelect.value === "easy") diffLabel.textContent = "Easy";
  else if (modeSelect.value === "hard") diffLabel.textContent = "Hard";
  else diffLabel.textContent = "Medium";
}

// tips
const tips = [
  "Tip: Collect 🛡 Shield before spinners appear.",
  "Tip: 🧲 Magnet pulls coins and powerups closer.",
  "Tip: ⚡ Nitro gives extra score for coins + pass.",
  "Tip: 🐢 Slow Motion helps during boss mode.",
  "Tip: Use small movements, not long holds."
];

let tipIndex = 0;
function rotateTips() {
  if (!tipText) return;
  tipIndex = (tipIndex + 1) % tips.length;
  tipText.animate([{ opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }], { duration: 520 });
  tipText.textContent = tips[tipIndex];
}
setInterval(rotateTips, 3500);

// =====================
// In-canvas mini HUD
// =====================
function drawInGameHUD() {
  const pad = 14;
  const x = pad;
  const y = pad;

  const chips = [
    { t: "Score", v: String(state.score) },
    { t: "High", v: String(state.best) },
    { t: "Coins", v: String(state.coinsCollected) }
  ];

  const activeList = [];
  if (active.shield > 0) activeList.push("🛡");
  if (active.slow > 0) activeList.push("🐢");
  if (active.nitro > 0) activeList.push("⚡");
  if (active.magnet > 0) activeList.push("🧲");

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.font = "bold 13px system-ui";

  let cx = x;
  for (const c of chips) {
    const text = `${c.t}: ${c.v}`;
    const w = Math.max(86, ctx.measureText(text).width + 24);
    const h = 28;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.roundRect(cx, y, w, h, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(text, cx + 12, y + 19);

    cx += w + 10;
  }

  if (activeList.length) {
    const text = `Power: ${activeList.join(" ")}`;
    const w = ctx.measureText(text).width + 24;
    const h = 28;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";

    ctx.beginPath();
    ctx.roundRect(x, y + 36, w, h, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(text, x + 12, y + 55);
  }

  ctx.restore();
}

// =====================
// Mobile Buttons (hold)
// =====================
let upHeld = false;
let downHeld = false;

function bindHold(btn, setter) {
  if (!btn) return;

  btn.addEventListener(
    "touchstart",
    (e) => {
      setter(true);
      e.preventDefault();
    },
    { passive: false }
  );
  btn.addEventListener(
    "touchend",
    (e) => {
      setter(false);
      e.preventDefault();
    },
    { passive: false }
  );
  btn.addEventListener(
    "touchcancel",
    (e) => {
      setter(false);
      e.preventDefault();
    },
    { passive: false }
  );

  // desktop mouse support
  btn.addEventListener("mousedown", () => setter(true));
  btn.addEventListener("mouseup", () => setter(false));
  btn.addEventListener("mouseleave", () => setter(false));
}

bindHold(mobUp, (v) => (upHeld = v));
bindHold(mobDown, (v) => (downHeld = v));

// ✅ prevent canvas swipe from triggering while pressing mobile buttons
[mobUp, mobDown].forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: false });
  btn.addEventListener("touchmove", (e) => e.stopPropagation(), { passive: false });
  btn.addEventListener("touchend", (e) => e.stopPropagation(), { passive: false });
});


// ✅✅ REALLY SMOOTH BUTTON MOVEMENT (NEW)
// This removes sensitivity & sudden movement.
let btnVel = 0;                 // current smooth velocity from buttons
const BTN_MAX_SPEED = 3.6;      // ✅ slow speed (lower = slower)
const BTN_ACCEL = 0.16;         // ✅ super smooth acceleration
const BTN_FRICTION = 0.88;      // ✅ smooth stop when released

function applyMobileMovement() {
  // if swipe is active, ignore button vel so it doesn't fight
  // (you can remove this if you want both simultaneously)
  if (touchTargetY !== null) {
    btnVel *= BTN_FRICTION;
    return;
  }

  let target = 0;
  if (upHeld) target = -BTN_MAX_SPEED;
  if (downHeld) target = BTN_MAX_SPEED;

  // smooth accelerate towards target
  btnVel += (target - btnVel) * BTN_ACCEL;

  // if no button pressed, smoothly slow down
  if (!upHeld && !downHeld) {
    btnVel *= BTN_FRICTION;
    if (Math.abs(btnVel) < 0.02) btnVel = 0;
  }

  rocket.y += btnVel;
  clampRocketIntoView();
}

// =====================
// Touch Swipe Controls (mobile smooth)
// =====================
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touchY = e.touches[0].clientY - rect.top;

    touchTargetY = touchY;
    lastTouchY = touchY;
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touchY = e.touches[0].clientY - rect.top;

    if (lastTouchY !== null && Math.abs(touchY - lastTouchY) < DEAD_ZONE) return;

    touchTargetY = touchY;
    lastTouchY = touchY;
  },
  { passive: false }
);

canvas.addEventListener("touchend", () => {
  touchTargetY = null;
  lastTouchY = null;
});


// ❌ REMOVED: Desktop pointer fallback that was controlling half screen
// (this caused upper half = up, lower half = down)


// =====================
// Update loop
// =====================
function update() {
  if (!state.running || state.paused || state.over) return;

  state.frame++;

  updateBossEvent();
  updateActivePowerups();

  // rocket physics
  if (keys.up) rocket.vy -= rocket.accel;
  if (keys.down) rocket.vy += rocket.accel;

  rocket.vy *= rocket.drag;
  rocket.y += rocket.vy;

  // ✅ smooth swipe target movement
  if (touchTargetY !== null) {
    const desiredY = touchTargetY - rocket.h / 2;
    let diff = desiredY - rocket.y;

    diff = Math.max(-MAX_TOUCH_SPEED, Math.min(MAX_TOUCH_SPEED, diff));
    rocket.y += diff * TOUCH_SMOOTHING;
  }

  // ✅ super smooth button movement
  applyMobileMovement();

  rocket.y = clamp(rocket.y, -40, H + 40);

  spawnParticles();
  updateParticles();

  // spawn obstacles
  state.spawnTimer++;
  if (state.spawnTimer > state.spawnEvery) {
    state.spawnTimer = 0;
    spawnObstacle();

    // scaling
    state.spawnEvery = clamp(state.spawnEvery - 0.78, state.spawnMin, 999);

    const m = currentMode();
    if (state.speed < m.speedBase) state.speed = m.speedBase;
    state.speed = clamp(state.speed + 0.065, m.speedBase, m.speedMax);

    beep(660, 0.03, "sine", 0.015);
  }

  updateObstacles();
  updateCoinsAndPowerups();

  // scoring: pass obstacle
  for (const o of obstacles) {
    if (!o.passed && o.x + o.w < rocket.x) {
      o.passed = true;
      state.score += state.boss.active ? 18 : 14;
      if (active.nitro > 0) state.score += 4;
      beep(900, 0.05, "triangle", 0.03);
    }
  }

  // time score
  if (state.frame % 12 === 0) state.score += 1;

  // collectibles
  checkCollectibles();

  // update UI
  scoreEl.textContent = state.score;
  updateDifficultyUI();

  // hit detection
  if (checkHit()) {
    if (active.shield > 0) {
      active.shield = 0;
      beep(300, 0.08, "sine", 0.06);
      setTimeout(() => beep(220, 0.08, "triangle", 0.05), 70);
      statusEl.textContent = "Shield Saved You!";
      return;
    }

    state.over = true;
    state.running = false;
    statusEl.textContent = "Game Over";
    stopMusic();

    beep(140, 0.2, "sawtooth", 0.08);
    setTimeout(() => beep(90, 0.22, "triangle", 0.06), 40);

    lastScoreEl.textContent = state.score;

    if (state.score >= 160) streak += 1;
    else streak = 0;

    bestStreak = Math.max(bestStreak, streak);
    localStorage.setItem("rocket_best_streak", String(bestStreak));
    bestStreakEl.textContent = bestStreak;

    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("rocket_best", String(state.best));
      bestEl.textContent = state.best;
      highScoreTopEl.textContent = state.best;
      updateBadges();
    }

    showOverlay(
      "💥 Game Over",
      `Score: ${state.score} • Coins: ${state.coinsCollected}\nPress Enter / Restart`
    );

    showGameRibbonBox();
  }
}

// =====================
// Render loop
// =====================
function render() {
  drawBackground();

  for (const o of obstacles) drawObstacle(o);
  drawCoinsAndPowerups();
  drawParticles();
  drawRocket();

  // vignette
  ctx.globalAlpha = 0.45;
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, "rgba(0,0,0,0.35)");
  v.addColorStop(0.3, "rgba(0,0,0,0)");
  v.addColorStop(0.7, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // boss warning
  if (state.boss.active) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.font = "bold 18px system-ui";
    ctx.fillStyle = "rgba(255,120,180,0.95)";
    ctx.fillText("BOSS MODE: GAP SHRINK!", 18, 32);
    ctx.restore();
  }

  drawInGameHUD();
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// =====================
// Start / Reset
// =====================
function startGame() {
  ensureAudio();
  audioCtx?.resume?.();
  hasStartedOnce = true;
  updateStartRestartUI();


  state.running = true;
  state.paused = false;
  state.over = false;

  statusEl.textContent = "Running";
  hideOverlay();
  hideGameRibbonBox();

  beep(520, 0.07, "triangle", 0.06);
  startMusic();
}

function resetGame() {
  const m = currentMode();

  state.running = false;
  state.paused = false;
  state.over = false;

  state.score = 0;
  state.coinsCollected = 0;
  state.frame = 0;

  state.speed = m.speedBase;
  state.speedMax = m.speedMax;
  state.spawnEvery = m.spawnEvery;
  state.spawnMin = m.spawnMin;
  state.spawnTimer = 0;

  state.boss.active = false;
  state.boss.timer = 0;
  state.boss.cooldown = 180;
  state.boss.lastTriggerScore = -999999;

  active.shield = 0;
  active.slow = 0;
  active.nitro = 0;
  active.magnet = 0;

  rocket.y = H / 2;
  rocket.vy = 0;

  obstacles = [];
  particles = [];
  coins = [];
  powerups = [];

  scoreEl.textContent = "0";
  bestEl.textContent = state.best;
  highScoreTopEl.textContent = state.best;
  statusEl.textContent = "Ready";

  lastScoreEl.textContent = "0";
  bestStreakEl.textContent = bestStreak;
  soundStateEl.textContent = audioOn ? "ON" : "OFF";
  updateStartRestartUI();

  updateBadges();
  updateDifficultyUI();

  initStars();
  showGameRibbonBox();
  showOverlay("Rocket Escape", "Press Start / Enter to play.");
}

// =====================
// Controls
// =====================
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();

  if (e.key === "ArrowUp" || k === "w") keys.up = true;
  if (e.key === "ArrowDown" || k === "s") keys.down = true;

  if ((e.key === "Enter" || e.key === " ") && !state.running && !state.over) startGame();

  if (e.key === "Enter" && state.over) {
    resetGame();
    startGame();
  }

  if (e.key === "Escape" && !state.over) {
    if (!state.running && !state.paused) return;
    state.paused = !state.paused;
    statusEl.textContent = state.paused ? "Paused" : "Running";

    if (state.paused) showOverlay("⏸ Paused", "Press Esc again to continue.");
    else hideOverlay();

    beep(state.paused ? 220 : 330, 0.07, "sine", 0.05);
  }

  if (k === "r") {
    resetGame();
    startGame();
  }
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (e.key === "ArrowUp" || k === "w") keys.up = false;
  if (e.key === "ArrowDown" || k === "s") keys.down = false;
});

// Buttons
startBtn.onclick = () => {
  if (!state.running) startGame();
};

pauseBtn.onclick = () => {
  if (state.over) return;
  if (!state.running && !state.paused) return;

  state.paused = !state.paused;
  statusEl.textContent = state.paused ? "Paused" : "Running";

  if (state.paused) showOverlay("⏸ Paused", "Press Pause again to continue.");
  else hideOverlay();

  beep(state.paused ? 220 : 330, 0.07, "sine", 0.05);
};

restartBtn.onclick = () => {
  resetGame();
  startGame();
};

soundBtn.onclick = () => {
  audioOn = !audioOn;
  soundStateEl.textContent = audioOn ? "ON" : "OFF";
  if (!audioOn) stopMusic();
  else startMusic();
};

// ✅ In-game ribbon box buttons mapped to existing buttons
// ✅ In-game ribbon box buttons mapped (Start only once)
if (grStart) {
  grStart.onclick = () => {
    if (hasStartedOnce) return; // ✅ Start only first time
    startGame();
  };
}

if (grRestart) {
  grRestart.onclick = () => {
    resetGame();
    startGame();
  };
}

if (grSound) grSound.onclick = () => soundBtn.click();

if (grSound) grSound.onclick = () => soundBtn.click();

// Mode change
modeSelect.addEventListener("change", () => {
  resetGame();
});

// =====================
// Boot
// =====================
resetGame();
updateStartRestartUI();
loop();

