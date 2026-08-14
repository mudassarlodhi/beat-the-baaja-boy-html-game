const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const VIRTUAL_WIDTH = 320;
const VIRTUAL_HEIGHT = 200;
const SLAPS_TO_WIN = 25;

canvas.width = VIRTUAL_WIDTH;
canvas.height = VIRTUAL_HEIGHT;
ctx.imageSmoothingEnabled = false;

const COLORS = {
  SKY: '#5c94fc',
  DARK_GREEN: '#004018',
  WHITE: '#FFFFFF',
  POLE: '#888888',
  CLOUD: '#FCFCFC',
  BUSH_GREEN: '#00A800',
  BOY_SKIN: '#FFCC99',
  BOY_SHIRT: '#D82800',
  BOY_ANGRY_SHIRT: '#A00000',
  BAJA_PLASTIC: '#FC9838'
};

const BOY_REACTION_TEXTS = ["Mujhe fark ni parhta!", "Ouch!!", "BAJA ZINDABAD!"];
const BIKE_REACTION_TEXTS = ["Dekhlonga tumhein!", "Mil mujhe kahin baahar!", "Theek hai, sorry!"];

let animationTime = 0;
let isMuted = false;

// ---------------- GAME STATE ----------------
let gameStarted = false;
let gameOver = false;
let gameStartTimeMs = null;
let finalTimeMs = null;
let bestTimeMs = loadBestTime();

function loadBestTime() {
  const stored = localStorage.getItem('bajaGameBestTimeMs');
  return stored ? parseFloat(stored) : null;
}

function saveBestTimeIfBetter(timeMs) {
  if (bestTimeMs === null || timeMs < bestTimeMs) {
    bestTimeMs = timeMs;
    localStorage.setItem('bajaGameBestTimeMs', String(timeMs));
    return true;
  }
  return false;
}

function formatSeconds(ms) {
  return (ms / 1000).toFixed(1) + 's';
}

// ---------------- AUDIO SYSTEM ----------------
let audioCtx = null;
let bajaOscillator = null;
let bajaGain = null;
let bgMusicInterval = null;
let welcomeMusicInterval = null;
let jetDroneOsc = null;
let jetDroneGain = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    bajaOscillator = audioCtx.createOscillator();
    bajaGain = audioCtx.createGain();

    bajaOscillator.type = 'sawtooth';
    bajaOscillator.frequency.value = 220;
    bajaGain.gain.value = 0;

    bajaOscillator.connect(bajaGain);
    bajaGain.connect(audioCtx.destination);
    bajaOscillator.start();

    startWelcomeMusic();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function startWelcomeMusic() {
  if (welcomeMusicInterval) return;
  
  const notes = [
    392.00, 392.00, 440.00, 493.88, 523.25, 493.88, 440.00, 392.00,
    349.23, 349.23, 392.00, 440.00, 392.00, 349.23, 329.63, 293.66,
    392.00, 440.00, 493.88, 523.25, 587.33, 523.25, 493.88, 440.00,
    493.88, 440.00, 392.00, 349.23, 392.00
  ];
  let step = 0;

  welcomeMusicInterval = setInterval(() => {
    if (isMuted || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(notes[step % notes.length], audioCtx.currentTime);
    gain.gain.setValueAtTime(0.018, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.28);
    step++;
  }, 280);
}

function stopWelcomeMusic() {
  if (welcomeMusicInterval) {
    clearInterval(welcomeMusicInterval);
    welcomeMusicInterval = null;
  }
}

function startChiptuneAnthem() {
  if (bgMusicInterval) return;

  const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
  const melody = [0, 2, 4, 4, 4, 5, 4, 2, 0, 2, 4, 2, 0, 0, 4, 4, 5, 7, 7, 5, 4, 2, 4, 5, 4];
  let step = 0;

  bgMusicInterval = setInterval(() => {
    if (isMuted || !audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(notes[melody[step % melody.length]], audioCtx.currentTime);

    gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);

    step++;
  }, 220);
}

const soundBtn = document.getElementById('sound-toggle');
soundBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  soundBtn.innerText = isMuted ? "🔇 OFF" : "🔊 ON";
  setBajaSound(!isMuted && !gameOver);
});

function setBajaSound(active) {
  if (!bajaGain || !audioCtx) return;
  if (active && !isMuted && !gameOver) {
    bajaOscillator.frequency.value = 210 + Math.sin(animationTime * 0.3) * 30;
    bajaGain.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.05);
  } else {
    bajaGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
  }
}

function playSlapSound(pitchShift = 1) {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(400 * pitchShift, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80 * pitchShift, audioCtx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playJetPenaltySound() {
  if (!audioCtx || isMuted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.35);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.35);
}

function playJetFlyby() {
  if (!audioCtx || isMuted) return;
  const bufferSize = Math.floor(audioCtx.sampleRate * 0.6);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.6);
  filter.Q.value = 2;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
  noise.stop(audioCtx.currentTime + 0.6);
}

function setJetDrone(active) {
  if (!audioCtx) return;
  if (active && !isMuted && !gameOver) {
    if (!jetDroneOsc) {
      jetDroneOsc = audioCtx.createOscillator();
      jetDroneGain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      jetDroneOsc.type = 'sawtooth';
      jetDroneOsc.frequency.value = 90;
      jetDroneGain.gain.value = 0;
      filter.type = 'lowpass';
      filter.frequency.value = 350;
      jetDroneOsc.connect(filter);
      filter.connect(jetDroneGain);
      jetDroneGain.connect(audioCtx.destination);
      jetDroneOsc.start();
    }
    jetDroneGain.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.3);
  } else if (jetDroneGain) {
    jetDroneGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!audioCtx) return;
  if (document.hidden) {
    bajaGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.01);
    audioCtx.suspend();
  } else {
    audioCtx.resume();
  }
});

function drawPixelText(text, centerX, y, options = {}) {
  const { font = '7px "Press Start 2P"', color = '#FFFFFF', padding = 4 } = options;
  ctx.font = font;
  const textWidth = ctx.measureText(text).width;
  let x = centerX - textWidth / 2;
  x = Math.max(padding, Math.min(x, VIRTUAL_WIDTH - textWidth - padding));

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(x - 3, y - 8, textWidth + 6, 11);

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// ---------------- GAME CHARACTERS & JET ----------------
let totalSlaps = 0;

const boy = {
  x: 20,
  y: VIRTUAL_HEIGHT - 40,
  groundY: VIRTUAL_HEIGHT - 40,
  width: 28,
  height: 24,
  speed: 0.8,
  direction: 1,
  isSlapped: false,
  slapTimer: 0,
  slapTextTimer: 0,
  isJumping: false,
  jumpVy: 0,
  angryTextTimer: 0,
  currentAngryText: ""
};

let bikeSpawnTimer = 0;
let nextBikeSide = 1;

const bike = {
  active: false,
  x: -60,
  y: VIRTUAL_HEIGHT - 44,
  width: 52,
  height: 28,
  baseSpeed: 0.9,
  speed: 0.9,
  direction: 1,
  isWheelie: true,
  isSlapped: false,
  introTextTimer: 0,
  reactionText: '',
  reactionTimer: 0
};

let jetSpawnTimer = 0;
const jet = {
  active: false,
  x: -60,
  y: 18,
  width: 50,
  height: 22,
  speed: 2.0,
  isHit: false,
  hitTextTimer: 0
};

const smokeParticles = [];
const flareParticles = [];

function spawnJet() {
  jet.active = true;
  jet.x = -60;
  jet.y = 15 + Math.random() * 15;
  jet.speed = 2.0;
  jet.isHit = false;
  jet.hitTextTimer = 0;
  playJetFlyby();
  setJetDrone(true);
}

function updateJetState() {
  if (!gameStarted || gameOver) return;

  jetSpawnTimer++;
  if (jetSpawnTimer >= 400) { 
    jetSpawnTimer = 0;
    if (!jet.active) spawnJet();
  }

  if (!jet.active) return;

  jet.x += jet.speed;

  if (animationTime % 2 === 0) {
    smokeParticles.push({
      x: jet.x,
      y: jet.y + 10,
      size: 4 + Math.random() * 3,
      color: '#FFFFFF',
      life: 45
    });
    smokeParticles.push({
      x: jet.x - 4,
      y: jet.y + 14,
      size: 4 + Math.random() * 3,
      color: '#00A800',
      life: 45
    });
  }

  if (jet.isHit && animationTime % 2 === 0) {
    flareParticles.push({
      x: jet.x + 10 + Math.random() * 15,
      y: jet.y + 16,
      vy: 1.5 + Math.random(),
      size: 3,
      life: 30
    });
  }

  if (jet.hitTextTimer > 0) jet.hitTextTimer--;
  if (jet.x > VIRTUAL_WIDTH + 60) {
    jet.active = false;
    setJetDrone(false);
  }
}

function slapJet() {
  if (!jet.active || jet.isHit || gameOver) return;

  playJetPenaltySound();
  setJetDrone(false);
  jet.isHit = true;
  jet.speed = 5.0;
  jet.hitTextTimer = 80;

  totalSlaps = Math.max(0, totalSlaps - 2);
}

function spawnBike() {
  bike.active = true;
  bike.direction = nextBikeSide;
  bike.isWheelie = true;
  bike.isSlapped = false;
  bike.speed = bike.baseSpeed;
  bike.introTextTimer = 90;
  bike.reactionTimer = 0;
  bike.x = (bike.direction === 1) ? -60 : VIRTUAL_WIDTH + 10;
  nextBikeSide *= -1;
}

function updateBikeState() {
  if (gameOver) return;

  bikeSpawnTimer++;
  if (bikeSpawnTimer >= 500) {
    bikeSpawnTimer = 0;
    if (!bike.active) spawnBike();
  }

  if (!bike.active) return;

  if (bike.introTextTimer > 0) bike.introTextTimer--;
  if (bike.reactionTimer > 0) bike.reactionTimer--;

  bike.x += bike.speed * bike.direction;

  if (bike.direction === 1 && bike.x > VIRTUAL_WIDTH + 60) bike.active = false;
  if (bike.direction === -1 && bike.x < -60) bike.active = false;
}

function slapBike() {
  if (!gameStarted || gameOver || bike.isSlapped) return;
  initAudio();
  playSlapSound(1.3);

  bike.isSlapped = true;
  bike.isWheelie = false;
  bike.speed = 3.2;
  bike.reactionText = BIKE_REACTION_TEXTS[Math.floor(Math.random() * BIKE_REACTION_TEXTS.length)];
  bike.reactionTimer = 120;
}

function updateBoyState() {
  if (gameOver) {
    setBajaSound(false);
    return;
  }
  if (!gameStarted) return;

  if (boy.isJumping) {
    boy.y += boy.jumpVy;
    boy.jumpVy += 0.4;
    boy.x += boy.direction * 3.5;

    if (boy.x < 10) boy.x = 10;
    if (boy.x > VIRTUAL_WIDTH - boy.width - 10) boy.x = VIRTUAL_WIDTH - boy.width - 10;

    if (boy.y >= boy.groundY) {
      boy.y = boy.groundY;
      boy.isJumping = false;
    }
    setBajaSound(true);
  } else if (boy.isSlapped) {
    boy.slapTimer--;
    setBajaSound(false);
    if (boy.slapTimer <= 0) boy.isSlapped = false;
  } else {
    boy.x += boy.speed * boy.direction;
    if (boy.x > VIRTUAL_WIDTH - boy.width - 10) boy.direction = -1;
    else if (boy.x < 10) boy.direction = 1;
    setBajaSound(true);
  }

  if (boy.slapTextTimer > 0) boy.slapTextTimer--;
  if (boy.angryTextTimer > 0) boy.angryTextTimer--;
}

function slapBoy() {
  if (!gameStarted || gameOver) return;
  initAudio();

  totalSlaps++;

  if (boy.isSlapped) {
    boy.isSlapped = false;
    boy.isJumping = true;
    boy.jumpVy = -6;
    boy.direction = (boy.x > VIRTUAL_WIDTH / 2) ? -1 : 1;

    boy.currentAngryText = BOY_REACTION_TEXTS[Math.floor(Math.random() * BOY_REACTION_TEXTS.length)];
    boy.angryTextTimer = 90;

    playSlapSound(1.5);
  } else {
    boy.isSlapped = true;
    boy.slapTimer = 65;
    boy.slapTextTimer = 40;
    playSlapSound(1);
  }

  if (totalSlaps >= SLAPS_TO_WIN) {
    triggerWin();
  }
}

function triggerWin() {
  gameOver = true;
  finalTimeMs = performance.now() - gameStartTimeMs;
  const isNewBest = saveBestTimeIfBetter(finalTimeMs);
  setBajaSound(false);
  showEndScreen(finalTimeMs, isNewBest);
}

// ---------------- DRAWING FUNCTIONS ----------------
function drawPixelCloud(startX, startY) {
  ctx.fillStyle = COLORS.CLOUD;
  ctx.fillRect(startX + 8, startY, 16, 8);
  ctx.fillRect(startX + 4, startY + 4, 24, 8);
  ctx.fillRect(startX, startY + 8, 32, 8);
}

function drawGround() {
  ctx.fillStyle = COLORS.BUSH_GREEN;
  ctx.fillRect(0, VIRTUAL_HEIGHT - 16, VIRTUAL_WIDTH, 16);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, VIRTUAL_HEIGHT - 16, VIRTUAL_WIDTH, 2);
}

function generateEmblemTexture(width, height) {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const oCtx = offscreen.getContext('2d');
  oCtx.imageSmoothingEnabled = false;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = height * 0.28;

  oCtx.fillStyle = COLORS.WHITE;
  oCtx.beginPath();
  oCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  oCtx.fill();

  oCtx.fillStyle = COLORS.DARK_GREEN;
  oCtx.beginPath();
  oCtx.arc(centerX + (radius * 0.35), centerY - (radius * 0.35), radius * 0.85, 0, Math.PI * 2);
  oCtx.fill();

  oCtx.fillStyle = COLORS.WHITE;
  drawStar(oCtx, centerX + (radius * 0.45), centerY - (radius * 0.45), 5, radius * 0.4, radius * 0.18);
  return offscreen;
}

function drawStar(context, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx, y = cy;
  const step = Math.PI / spikes;

  context.beginPath();
  context.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    context.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    context.lineTo(x, y);
    rot += step;
  }
  context.lineTo(cx, cy - outerRadius);
  context.closePath();
  context.fill();
}

const emblemCanvas = generateEmblemTexture(120, 80);

const POLE_TOP_Y = 15;
const FLAG_RAISED_Y = 25;
const FLAG_LOWERED_Y = 92;

function drawWavingFlag(time, riseProgress) {
  const flagX = 50;
  const flagY = FLAG_LOWERED_Y - (FLAG_LOWERED_Y - FLAG_RAISED_Y) * riseProgress;
  const flagWidth = 230, flagHeight = 90;
  const whiteWidth = Math.floor(flagWidth * 0.25);
  const greenWidth = flagWidth - whiteWidth;

  ctx.fillStyle = COLORS.POLE;
  ctx.fillRect(flagX - 6, POLE_TOP_Y, 6, VIRTUAL_HEIGHT - POLE_TOP_Y - 4);
  ctx.fillStyle = '#F8D800';
  ctx.fillRect(flagX - 8, POLE_TOP_Y - 4, 10, 4);

  const sliceWidth = 2;
  for (let x = 0; x < flagWidth; x += sliceWidth) {
    const waveOffset = Math.sin((x * 0.05) - (time * 0.08)) * (3 + (x * 0.03));
    const currentY = flagY + waveOffset;

    if (x < whiteWidth) {
      ctx.fillStyle = COLORS.WHITE;
      ctx.fillRect(flagX + x, currentY, sliceWidth, flagHeight);
    } else {
      ctx.fillStyle = COLORS.DARK_GREEN;
      ctx.fillRect(flagX + x, currentY, sliceWidth, flagHeight);

      const greenX = x - whiteWidth;
      const emblemSliceX = Math.floor((greenX / greenWidth) * emblemCanvas.width);

      ctx.drawImage(
        emblemCanvas,
        emblemSliceX, 0, sliceWidth, emblemCanvas.height,
        flagX + x, currentY + (flagHeight * 0.1), sliceWidth, flagHeight * 0.8
      );
    }

    if (Math.cos((x * 0.05) - (time * 0.08)) > 0.6) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(flagX + x, currentY, sliceWidth, flagHeight);
    }
  }
}

function drawJetParticles() {
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    const p = smokeParticles[i];
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    p.life--;
    if (p.life <= 0) smokeParticles.splice(i, 1);
  }

  for (let i = flareParticles.length - 1; i >= 0; i--) {
    const f = flareParticles[i];
    ctx.fillStyle = (Math.random() > 0.3) ? '#FFD700' : '#FF4500';
    ctx.fillRect(f.x, f.y, f.size, f.size);
    f.y += f.vy;
    f.life--;
    if (f.life <= 0) flareParticles.splice(i, 1);
  }
}

function drawJet() {
  if (!jet.active) return;

  const jx = Math.floor(jet.x);
  const jy = Math.floor(jet.y);

  // Afterburner flame
  ctx.fillStyle = (animationTime % 4 < 2) ? '#FF6600' : '#FFCC00';
  ctx.fillRect(jx - 8, jy + 8, 8, 4);
  ctx.fillStyle = '#FF3300';
  ctx.fillRect(jx - 6, jy + 9, 4, 2);

  // Fuselage
  ctx.fillStyle = '#90A4AE';
  ctx.fillRect(jx, jy + 6, 42, 8);
  
  // Nose cone
  ctx.fillStyle = '#78909C';
  ctx.fillRect(jx + 42, jy + 7, 6, 6);
  ctx.fillStyle = '#546E7A';
  ctx.fillRect(jx + 48, jy + 8, 2, 4);

  // Cockpit
  ctx.fillStyle = '#263238';
  ctx.fillRect(jx + 26, jy + 3, 12, 4);
  ctx.fillStyle = '#4FC3F7';
  ctx.fillRect(jx + 28, jy + 4, 6, 1);

  // Top wing
  ctx.fillStyle = '#78909C';
  ctx.fillRect(jx + 14, jy, 14, 6);
  ctx.fillRect(jx + 18, jy - 2, 6, 2);

  // Bottom wing
  ctx.fillRect(jx + 14, jy + 14, 14, 6);
  ctx.fillRect(jx + 18, jy + 20, 6, 2);

  // Tail
  ctx.fillRect(jx, jy + 2, 8, 4);
  ctx.fillRect(jx, jy + 14, 8, 4);
  ctx.fillRect(jx - 2, jy + 4, 4, 2);
  ctx.fillRect(jx - 2, jy + 14, 4, 2);

  // PAF Roundel
  ctx.fillStyle = '#00A800';
  ctx.fillRect(jx + 20, jy + 8, 5, 5);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(jx + 21, jy + 9, 2, 3);

  if (jet.hitTextTimer > 0) {
    drawPixelText('-2 SLAPS!', jx + 22, jy - 10, { color: '#FF3333', font: '8px "Press Start 2P"' });
  }
}

function drawBajaBoy() {
  const bx = Math.floor(boy.x);
  const by = Math.floor(boy.y);
  const w = boy.width;
  const h = boy.height;

  const legOffset = (!boy.isSlapped && Math.floor(animationTime / 8) % 2 === 0) ? 2 : 0;

  ctx.fillStyle = '#683800';
  ctx.fillRect(bx + 2, by + h - 4 + legOffset, 8, 4);
  ctx.fillRect(bx + w - 10, by + h - 4 - legOffset, 8, 4);

  ctx.fillStyle = (boy.angryTextTimer > 0) ? COLORS.BOY_ANGRY_SHIRT : COLORS.BOY_SHIRT;
  ctx.fillRect(bx + 4, by + 8, w - 8, h - 8);
  ctx.fillRect(bx + 2, by + 12, w - 4, h - 14);

  ctx.fillStyle = COLORS.BOY_SKIN;
  ctx.fillRect(bx + 4, by, w - 8, 12);
  ctx.fillRect(bx + 2, by + 2, w - 4, 8);

  if (gameOver) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx + 6, by + 4, 2, 2);
    ctx.fillRect(bx + w - 8, by + 4, 2, 2);

    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(bx + w, by, 2, 12);
    ctx.fillStyle = COLORS.DARK_GREEN;
    ctx.fillRect(bx + w + 2, by, 8, 6);
  } else if (boy.isSlapped) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx + 6, by + 4, 3, 1);
    ctx.fillRect(bx + 7, by + 3, 1, 3);
    ctx.fillRect(bx + w - 9, by + 4, 3, 1);
    ctx.fillRect(bx + w - 8, by + 3, 1, 3);
    ctx.fillRect(bx + (w / 2) - 2, by + 8, 4, 3);
  } else {
    ctx.fillStyle = '#000000';
    const eyeX = (boy.direction === 1) ? bx + w - 10 : bx + 6;
    ctx.fillRect(eyeX, by + 3, 3, 4);

    const hornX = (boy.direction === 1) ? bx + w - 2 : bx - 10;
    ctx.fillStyle = COLORS.BAJA_PLASTIC;
    ctx.fillRect(hornX, by + 5, 10, 4);
    ctx.fillRect((boy.direction === 1) ? hornX + 7 : hornX - 3, by + 3, 4, 8);

    if (Math.floor(animationTime / 4) % 2 === 0) {
      ctx.fillStyle = '#F8D800';
      ctx.fillRect((boy.direction === 1) ? hornX + 12 : hornX - 7, by + 2, 2, 2);
      ctx.fillRect(((boy.direction === 1) ? hornX + 12 : hornX - 7) + (boy.direction * 3), by + 7, 2, 2);
      ctx.fillRect((boy.direction === 1) ? hornX + 12 : hornX - 7, by + 10, 2, 2);
    }
  }

  const textCenterX = bx + w / 2;
  if (boy.angryTextTimer > 0) {
    drawPixelText(boy.currentAngryText, textCenterX, by - 10, { color: '#FF6B6B' });
  } else if (boy.slapTextTimer > 0) {
    drawPixelText("SLAP!", textCenterX, by - 10, { color: '#F8D800' });
  }
}

function drawMasairBike() {
  if (!bike.active) return;

  const bx = Math.floor(bike.x);
  const by = Math.floor(bike.y);
  const textCenterX = bx + bike.width / 2;

  if (bike.introTextTimer > 0 && !bike.isSlapped) {
    drawPixelText('MASAIR IS HERE', textCenterX, by - 20, { font: '8px "Press Start 2P"', color: '#F8D800' });
  } else if (bike.reactionTimer > 0) {
    drawPixelText(bike.reactionText, textCenterX, by - 20, { font: '7px "Press Start 2P"', color: '#00FF66' });
  }

  ctx.save();
  const isFacingRight = (bike.direction === 1);

  ctx.translate(bx + (bike.width / 2), by + bike.height);

  if (!isFacingRight) {
    ctx.scale(-1, 1);
  }

  if (bike.isWheelie) {
    ctx.rotate(-25 * Math.PI / 180);
  }

  ctx.translate(-bike.width / 2, -bike.height);

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(8, 20, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(8, 20, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(44, 20, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(44, 20, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#222222';
  ctx.fillRect(8, 16, 32, 4);
  ctx.fillRect(18, 14, 12, 8);
  ctx.fillStyle = '#DDDDDD';
  ctx.fillRect(10, 20, 24, 3);

  ctx.fillStyle = '#E52521';
  ctx.fillRect(20, 8, 16, 7);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(23, 10, 10, 2);

  ctx.fillStyle = '#111111';
  ctx.fillRect(8, 8, 12, 5);
  ctx.fillStyle = '#888888';
  ctx.fillRect(36, 2, 3, 16);
  ctx.fillRect(34, 0, 8, 3);

  ctx.fillStyle = '#003366';
  ctx.fillRect(10, 10, 10, 9);
  ctx.fillStyle = '#00A800';
  ctx.fillRect(12, 0, 10, 11);

  ctx.fillStyle = COLORS.BOY_SKIN;
  ctx.fillRect(18, 3, 14, 3);

  ctx.fillRect(12, -8, 8, 8);
  ctx.fillStyle = '#000000';
  ctx.fillRect(17, -6, 2, 3);

  ctx.restore();
}

function drawHUD() {
  ctx.font = '7px "Press Start 2P"';
  
  const slapStr = `SLAPS: ${totalSlaps}/${SLAPS_TO_WIN}`;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(4, 4, ctx.measureText(slapStr).width + 6, 12);
  ctx.fillStyle = '#F8D800';
  ctx.fillText(slapStr, 7, 13);

  if (gameStarted && !gameOver) {
    const elapsedMs = performance.now() - gameStartTimeMs;
    const timeStr = `TIME: ${formatSeconds(elapsedMs)}`;
    const bestStr = bestTimeMs ? ` BEST: ${formatSeconds(bestTimeMs)}` : '';
    const rightHUDText = timeStr + bestStr;
    const textW = ctx.measureText(rightHUDText).width;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(VIRTUAL_WIDTH - textW - 10, 4, textW + 6, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(rightHUDText, VIRTUAL_WIDTH - textW - 7, 13);
  }
}

// ---------------- INPUT HANDLING ----------------
function getVirtualCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (VIRTUAL_WIDTH / rect.width),
    y: (clientY - rect.top) * (VIRTUAL_HEIGHT / rect.height)
  };
}

function isOverBoy(vx, vy) {
  const hitMargin = 8;
  return (
    vx >= boy.x - hitMargin &&
    vx <= boy.x + boy.width + hitMargin &&
    vy >= boy.y - hitMargin &&
    vy <= boy.y + boy.height + hitMargin
  );
}

function isOverBike(vx, vy) {
  if (!bike.active) return false;
  const hitMargin = 10;
  return (
    vx >= bike.x - hitMargin &&
    vx <= bike.x + bike.width + hitMargin &&
    vy >= bike.y - hitMargin &&
    vy <= bike.y + bike.height + hitMargin
  );
}

function isOverJet(vx, vy) {
  if (!jet.active) return false;
  const hitMargin = 10;
  return (
    vx >= jet.x - hitMargin &&
    vx <= jet.x + jet.width + hitMargin &&
    vy >= jet.y - hitMargin &&
    vy <= jet.y + jet.height + hitMargin
  );
}

canvas.addEventListener('mousemove', (e) => {
  const pos = getVirtualCoords(e.clientX, e.clientY);
  if (isOverBoy(pos.x, pos.y) || isOverBike(pos.x, pos.y) || isOverJet(pos.x, pos.y)) canvas.classList.add('hover-boy');
  else canvas.classList.remove('hover-boy');
});

function handleInteraction(clientX, clientY) {
  if (!gameStarted || gameOver) return;
  const pos = getVirtualCoords(clientX, clientY);

  if (isOverJet(pos.x, pos.y)) {
    slapJet();
  } else if (isOverBike(pos.x, pos.y)) {
    slapBike();
  } else if (isOverBoy(pos.x, pos.y)) {
    slapBoy();
  }
}

canvas.addEventListener('mousedown', (e) => handleInteraction(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  handleInteraction(touch.clientX, touch.clientY);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') slapBoy();
});

// ---------------- SCREEN FLOW ----------------
const welcomeScreen = document.getElementById('welcome-screen');
const endScreen = document.getElementById('end-screen');
const startBtn = document.getElementById('start-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const welcomeBestEl = document.getElementById('welcome-best');
const endTimeEl = document.getElementById('end-time');
const endSlapsEl = document.getElementById('end-slaps');
const endBestEl = document.getElementById('end-best');
const endTitleEl = document.getElementById('end-title');

if (bestTimeMs !== null) {
  welcomeBestEl.textContent = `Your Best: ${formatSeconds(bestTimeMs)}`;
}

welcomeScreen.addEventListener('click', () => initAudio(), { once: true });

function showEndScreen(timeMs, isNewBest) {
  endTitleEl.textContent = isNewBest ? 'NEW BEST TIME!' : 'INDEPENDENCE SAVED!';
  endTimeEl.textContent = `Your Time: ${formatSeconds(timeMs)}`;
  endSlapsEl.textContent = `Slaps Landed: ${totalSlaps}`;
  endBestEl.textContent = `Best Time: ${formatSeconds(bestTimeMs)}`;
  endScreen.classList.remove('hidden');
}

function startGame() {
  gameStarted = true;
  gameStartTimeMs = performance.now();
  initAudio();
  stopWelcomeMusic();
  if (!bgMusicInterval) startChiptuneAnthem();
  welcomeScreen.classList.add('hidden');
}

function resetGame() {
  totalSlaps = 0;
  gameOver = false;
  finalTimeMs = null;

  boy.x = 20;
  boy.y = boy.groundY;
  boy.direction = 1;
  boy.isSlapped = false;
  boy.slapTimer = 0;
  boy.isJumping = false;
  boy.jumpVy = 0;
  boy.slapTextTimer = 0;
  boy.angryTextTimer = 0;

  bike.active = false;
  bike.isWheelie = true;
  bike.isSlapped = false;
  bike.speed = bike.baseSpeed;
  bike.introTextTimer = 0;
  bike.reactionTimer = 0;
  bikeSpawnTimer = 0;

  jet.active = false;
  jetSpawnTimer = 0;
  
  smokeParticles.length = 0;
  flareParticles.length = 0;

  gameStartTimeMs = performance.now();
  endScreen.classList.add('hidden');
  
  stopWelcomeMusic();
  if (!bgMusicInterval) startChiptuneAnthem();
}

startBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', resetGame);

// Main Loop
function renderFrame() {
  animationTime++;
  updateBoyState();
  updateBikeState();
  updateJetState();

  ctx.fillStyle = COLORS.SKY;
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  drawPixelCloud(20, 18);
  drawPixelCloud(160, 12);
  drawPixelCloud(260, 25);

  drawJetParticles();
  drawJet();

  drawGround();
  const riseProgress = Math.min(totalSlaps / SLAPS_TO_WIN, 1);
  drawWavingFlag(animationTime, riseProgress);
  drawBajaBoy();
  drawMasairBike();
  drawHUD();

  requestAnimationFrame(renderFrame);
}

renderFrame();