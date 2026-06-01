const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const playerScoreEl = document.querySelector("#playerScore");
const aiScoreEl = document.querySelector("#aiScore");
const gameStatusEl = document.querySelector("#gameStatus");
const modeBadgeEl = document.querySelector("#modeBadge");
const powerStatusEl = document.querySelector("#powerStatus");
const playerPowerStatusEl = document.querySelector("#playerPowerStatus");
const aiPowerStatusEl = document.querySelector("#aiPowerStatus");
const serveButton = document.querySelector("#serveButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const modeButtons = [...document.querySelectorAll(".mode")];
const mapButtons = [...document.querySelectorAll(".map")];

const modes = {
  easy: { label: "Easy", aiSpeed: 4.4, error: 56, reaction: 0.055, ballSpeed: 6.5 },
  medium: { label: "Medium", aiSpeed: 6.2, error: 28, reaction: 0.085, ballSpeed: 7.4 },
  hard: { label: "Hard", aiSpeed: 8.5, error: 9, reaction: 0.13, ballSpeed: 8.2 }
};

const powerTypes = [
  { id: "mega-paddle", label: "Mega Paddle", color: "#8ef5b0" },
  { id: "slow-field", label: "Slow Field", color: "#42d9ff" },
  { id: "power-shot", label: "Power Shot", color: "#ffd166" }
];

const maps = {
  lagoon: {
    label: "Lagoon",
    image: "assets/map-lagoon.png",
    background: ["#f7fdff", "#e8f8ff", "#effcff"],
    grid: "rgba(26, 167, 216, 0.09)",
    border: "rgba(26, 167, 216, 0.36)",
    inner: "rgba(62, 212, 137, 0.32)",
    center: "rgba(22, 32, 51, 0.18)",
    player: "#3ed489",
    ai: "#ef5a6f",
    ball: "#162033",
    trail: "#1aa7d8",
    accent: "#1aa7d8",
    pattern: "waves"
  },
  blossom: {
    label: "Blossom",
    image: "assets/map-blossom.png",
    background: ["#fff9fd", "#ffeef7", "#f4fbff"],
    grid: "rgba(240, 110, 169, 0.09)",
    border: "rgba(240, 110, 169, 0.34)",
    inner: "rgba(128, 184, 255, 0.28)",
    center: "rgba(83, 48, 74, 0.18)",
    player: "#37c58c",
    ai: "#f06ea9",
    ball: "#43283b",
    trail: "#f06ea9",
    accent: "#f06ea9",
    pattern: "petals"
  },
  sunset: {
    label: "Sunset",
    image: "assets/map-sunset.png",
    background: ["#fffaf0", "#fff0d5", "#ffe9ef"],
    grid: "rgba(244, 165, 36, 0.11)",
    border: "rgba(244, 165, 36, 0.38)",
    inner: "rgba(239, 90, 111, 0.24)",
    center: "rgba(90, 57, 23, 0.2)",
    player: "#23b58f",
    ai: "#ef6a5a",
    ball: "#382512",
    trail: "#f4a524",
    accent: "#f4a524",
    pattern: "sun"
  },
  mint: {
    label: "Mint",
    image: "assets/map-mint.png",
    background: ["#fbfff9", "#eafff3", "#eff8ff"],
    grid: "rgba(62, 212, 137, 0.1)",
    border: "rgba(62, 212, 137, 0.38)",
    inner: "rgba(26, 167, 216, 0.26)",
    center: "rgba(20, 76, 57, 0.18)",
    player: "#20bf72",
    ai: "#1aa7d8",
    ball: "#143b2d",
    trail: "#3ed489",
    accent: "#20bf72",
    pattern: "leaves"
  }
};

const mapImages = Object.fromEntries(
  Object.entries(maps).map(([id, map]) => {
    const image = new Image();
    image.src = map.image;
    return [id, image];
  })
);

const state = {
  mode: "medium",
  map: "lagoon",
  running: false,
  paused: false,
  playerScore: 0,
  aiScore: 0,
  keys: new Set(),
  player: { x: 32, y: 220, w: 14, h: 100, vy: 0 },
  ai: { x: 914, y: 220, w: 14, h: 100, targetY: 270 },
  ball: { x: 480, y: 270, r: 9, vx: 0, vy: 0, trail: [] },
  aiDecision: { velocity: 0, move: "hold", source: "waiting-for-codex" },
  aiRequestPending: false,
  lastAiRequestAt: 0,
  powerUp: null,
  activePowers: { player: null, ai: null },
  nextPowerAt: 0
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(text) {
  gameStatusEl.textContent = text;
}

function setPowerStatus(text) {
  powerStatusEl.textContent = text;
}

function setOwnerPowerStatus(owner, text) {
  (owner === "player" ? playerPowerStatusEl : aiPowerStatusEl).textContent = text;
}

function aiPayload() {
  return {
    mode: state.mode,
    boardHeight: canvas.height,
    ballX: state.ball.x,
    ballY: state.ball.y,
    ballVx: state.ball.vx,
    ballVy: state.ball.vy,
    ballRadius: state.ball.r,
    aiPaddleX: state.ai.x,
    aiPaddleY: state.ai.y,
    aiPaddleHeight: state.ai.h,
    tick: performance.now()
  };
}

function resetPositions(direction = Math.random() > 0.5 ? 1 : -1) {
  clearPower(false, true);
  state.player.y = canvas.height / 2 - state.player.h / 2;
  state.player.h = 100;
  state.ai.h = 100;
  state.ai.y = canvas.height / 2 - state.ai.h / 2;
  state.ai.targetY = canvas.height / 2;
  state.ball.x = canvas.width / 2;
  state.ball.y = canvas.height / 2;
  state.ball.trail = [];
  const settings = modes[state.mode];
  const angle = (Math.random() * 0.7 - 0.35);
  state.ball.vx = Math.cos(angle) * settings.ballSpeed * direction;
  state.ball.vy = Math.sin(angle) * settings.ballSpeed;
  scheduleNextPower();
}

function serve(direction) {
  state.running = true;
  state.paused = false;
  resetPositions(direction);
  setStatus("Rally live");
  pauseButton.textContent = "Pause";
}

function resetGame() {
  state.playerScore = 0;
  state.aiScore = 0;
  state.running = false;
  state.paused = false;
  playerScoreEl.textContent = "0";
  aiScoreEl.textContent = "0";
  resetPositions(1);
  state.ball.vx = 0;
  state.ball.vy = 0;
  clearPower(false, true);
  setStatus("Press Space to serve");
  setPowerStatus("No pickup");
  setOwnerPowerStatus("player", "None");
  setOwnerPowerStatus("ai", "None");
  pauseButton.textContent = "Pause";
}

function setMode(mode) {
  state.mode = mode;
  modeBadgeEl.textContent = modes[mode].label;
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  if (!state.running) resetGame();
}

function setMap(map) {
  if (!maps[map]) return;
  state.map = map;
  mapButtons.forEach((button) => button.classList.toggle("active", button.dataset.map === map));
  setStatus(`${maps[map].label} arena selected`);
}

function updatePlayer() {
  const speed = 8.2;
  const up = state.keys.has("ArrowUp") || state.keys.has("KeyW");
  const down = state.keys.has("ArrowDown") || state.keys.has("KeyS");
  state.player.vy = (down ? speed : 0) - (up ? speed : 0);
  state.player.y = clamp(state.player.y + state.player.vy, 0, canvas.height - state.player.h);
}

function updateAi() {
  requestServerAiMove();
  if (state.aiDecision.source === "codex-mcp-command") {
    state.ai.y = clamp(state.ai.y + state.aiDecision.velocity, 0, canvas.height - state.ai.h);
  }
}

function scheduleNextPower() {
  state.nextPowerAt = performance.now() + 3500 + Math.random() * 3500;
}

function maybeSpawnPower() {
  if (!state.running || state.powerUp || performance.now() < state.nextPowerAt) return;
  const type = powerTypes[Math.floor(Math.random() * powerTypes.length)];
  const owner = Math.random() > 0.5 ? "player" : "ai";
  state.powerUp = {
    ...type,
    owner,
    x: owner === "player" ? state.player.x + state.player.w + 10 : state.ai.x - 10,
    y: 70 + Math.random() * (canvas.height - 140),
    r: 15,
    bornAt: performance.now()
  };
  setPowerStatus(`${owner === "player" ? "Your" : "Codex"} ${type.label}`);
}

function clearPower(schedule = true, clearActive = false) {
  state.powerUp = null;
  if (clearActive) {
    state.activePowers.player = null;
    state.activePowers.ai = null;
    state.player.h = 100;
    state.ai.h = 100;
    setPowerStatus("No pickup");
    setOwnerPowerStatus("player", "None");
    setOwnerPowerStatus("ai", "None");
  }
  if (schedule) scheduleNextPower();
}

function collectPowerFor(owner, paddle) {
  if (!state.powerUp) return;
  const power = state.powerUp;
  const closestX = clamp(power.x, paddle.x, paddle.x + paddle.w);
  const closestY = clamp(power.y, paddle.y, paddle.y + paddle.h);
  const distance = Math.hypot(power.x - closestX, power.y - closestY);
  if (distance > power.r) return;

  applyPower(power, owner);
  logGameEvent("power_collected", power.id, owner);
  clearPower();
}

function collectPower() {
  collectPowerFor("player", state.player);
  collectPowerFor("ai", state.ai);
}

function applyPower(power, owner) {
  const paddle = owner === "player" ? state.player : state.ai;
  state.activePowers[owner] = { id: power.id, label: power.label, endsAt: performance.now() + 7500 };
  setOwnerPowerStatus(owner, power.id === "power-shot" ? `${power.label} armed` : `${power.label} active`);

  if (power.id === "mega-paddle") {
    paddle.h = 152;
    paddle.y = clamp(paddle.y, 0, canvas.height - paddle.h);
  }

  if (power.id === "slow-field") {
    state.ball.vx *= 0.72;
    state.ball.vy *= 0.72;
  }

  if (power.id === "power-shot") {
    setStatus(`${owner === "player" ? "Your" : "Codex"} power shot armed`);
  }
}

function updatePower() {
  maybeSpawnPower();
  collectPower();

  ["player", "ai"].forEach((owner) => {
    const activePower = state.activePowers[owner];
    if (!activePower || performance.now() < activePower.endsAt) return;
    const paddle = owner === "player" ? state.player : state.ai;
    if (activePower.id === "mega-paddle") {
      paddle.h = 100;
      paddle.y = clamp(paddle.y, 0, canvas.height - paddle.h);
    }
    state.activePowers[owner] = null;
    setOwnerPowerStatus(owner, "None");
  });

  if (!state.powerUp) setPowerStatus("No pickup");
}

function consumePowerShot(owner) {
  const activePower = state.activePowers[owner];
  if (activePower?.id !== "power-shot") return false;
  state.activePowers[owner] = null;
  setOwnerPowerStatus(owner, "None");
  return true;
}

function applyPowerShot(owner, isPlayer) {
  if (!consumePowerShot(owner)) return;
  const ball = state.ball;
  const direction = isPlayer ? 1 : -1;
  ball.vx = Math.max(12.5, Math.abs(ball.vx) * 1.45) * direction;
  ball.vy *= 1.22;
  setStatus(`${owner === "player" ? "You fired" : "Codex fired"} a power shot`);
}

function logGameEvent(type, power, owner = null) {
  fetch("/api/game-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, power, owner, mode: state.mode })
  }).catch(() => {});
}

function requestServerAiMove() {
  const now = performance.now();
  if (state.aiRequestPending || now - state.lastAiRequestAt < 80) return;

  state.aiRequestPending = true;
  state.lastAiRequestAt = now;

  fetch("/api/pong-move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aiPayload())
  })
    .then((response) => {
      if (!response.ok) throw new Error(`AI bridge returned ${response.status}`);
      return response.json();
    })
    .then((decision) => {
      state.aiDecision = {
        velocity: Number(decision.velocity) || 0,
        move: decision.move || "hold",
        source: decision.source || "waiting-for-codex"
      };
    })
    .catch(() => {
      state.aiDecision = { velocity: 0, move: "hold", source: "waiting-for-codex" };
    })
    .finally(() => {
      state.aiRequestPending = false;
    });
}

function collidePaddle(paddle, isPlayer) {
  const ball = state.ball;
  const withinX = isPlayer
    ? ball.x - ball.r <= paddle.x + paddle.w && ball.x > paddle.x
    : ball.x + ball.r >= paddle.x && ball.x < paddle.x + paddle.w;
  const withinY = ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h;

  if (!withinX || !withinY) return;

  const hit = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
  const speed = Math.min(13, Math.hypot(ball.vx, ball.vy) + 0.42);
  const angle = hit * 0.86;
  ball.vx = Math.cos(angle) * speed * (isPlayer ? 1 : -1);
  ball.vy = Math.sin(angle) * speed;
  applyPowerShot(isPlayer ? "player" : "ai", isPlayer);
  ball.x = isPlayer ? paddle.x + paddle.w + ball.r : paddle.x - ball.r;
}

function updateBall() {
  const ball = state.ball;
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.y - ball.r <= 0 || ball.y + ball.r >= canvas.height) {
    ball.vy *= -1;
    ball.y = clamp(ball.y, ball.r, canvas.height - ball.r);
  }

  collidePaddle(state.player, true);
  collidePaddle(state.ai, false);

  ball.trail.unshift({ x: ball.x, y: ball.y });
  ball.trail = ball.trail.slice(0, 8);

  if (ball.x < -40) {
    state.aiScore += 1;
    aiScoreEl.textContent = String(state.aiScore);
    state.running = false;
    setStatus("Codex scored. Serve again");
    clearPower(false, true);
  }

  if (ball.x > canvas.width + 40) {
    state.playerScore += 1;
    playerScoreEl.textContent = String(state.playerScore);
    state.running = false;
    setStatus("You scored. Serve again");
    clearPower(false, true);
  }
}

function drawCourt() {
  const map = maps[state.map];
  const mapImage = mapImages[state.map];
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (mapImage?.complete && mapImage.naturalWidth > 0) {
    ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const courtGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    courtGradient.addColorStop(0, map.background[0]);
    courtGradient.addColorStop(0.48, map.background[1]);
    courtGradient.addColorStop(1, map.background[2]);
    ctx.fillStyle = courtGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawMapPattern(map);
  }

  ctx.fillStyle = map.grid;
  for (let x = 48; x < canvas.width; x += 96) {
    ctx.fillRect(x, 18, 1, canvas.height - 36);
  }
  for (let y = 54; y < canvas.height; y += 72) {
    ctx.fillRect(18, y, canvas.width - 36, 1);
  }

  ctx.strokeStyle = map.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.strokeStyle = map.inner;
  ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

  ctx.setLineDash([16, 18]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 26);
  ctx.lineTo(canvas.width / 2, canvas.height - 26);
  ctx.strokeStyle = map.center;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMapPattern(map) {
  ctx.save();
  ctx.globalAlpha = 0.56;
  ctx.strokeStyle = map.accent;
  ctx.fillStyle = map.accent;

  if (map.pattern === "waves") {
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 3;
    for (let y = 78; y < canvas.height; y += 82) {
      ctx.beginPath();
      for (let x = 30; x < canvas.width - 30; x += 24) {
        const waveY = y + Math.sin(x / 34) * 8;
        x === 30 ? ctx.moveTo(x, waveY) : ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }
  }

  if (map.pattern === "petals") {
    ctx.globalAlpha = 0.13;
    for (let x = 90; x < canvas.width; x += 150) {
      for (let y = 82; y < canvas.height; y += 116) {
        ctx.beginPath();
        ctx.ellipse(x, y, 18, 8, Math.PI / 4, 0, Math.PI * 2);
        ctx.ellipse(x, y, 18, 8, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (map.pattern === "sun") {
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 2;
    for (let r = 58; r < 520; r += 52) {
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (map.pattern === "leaves") {
    ctx.globalAlpha = 0.13;
    for (let x = 78; x < canvas.width; x += 135) {
      for (let y = 76; y < canvas.height; y += 105) {
        ctx.beginPath();
        ctx.ellipse(x, y, 24, 9, -Math.PI / 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 24, y + 16, 20, 8, Math.PI / 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function drawPaddle(paddle, color, owner) {
  const activePower = state.activePowers[owner];
  if (activePower) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12 + Math.sin(performance.now() / 130) * 0.04;
    ctx.beginPath();
    ctx.roundRect(paddle.x - 7, paddle.y - 9, paddle.w + 14, paddle.h + 18, 11);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.fillRect(paddle.x + 3, paddle.y + 8, 2, paddle.h - 16);
  ctx.shadowBlur = 0;
}

function drawBall() {
  const map = maps[state.map];
  const ball = state.ball;
  ball.trail.forEach((point, index) => {
    ctx.globalAlpha = (ball.trail.length - index) / ball.trail.length * 0.28;
    ctx.beginPath();
    ctx.arc(point.x, point.y, ball.r + index * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = map.trail;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = map.ball;
  ctx.shadowColor = map.trail;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPowerUp() {
  if (!state.powerUp) return;
  const pulse = Math.sin((performance.now() - state.powerUp.bornAt) / 140) * 3;
  const ownerColor = state.powerUp.owner === "player" ? "#8ef5b0" : "#ff6b78";

  ctx.strokeStyle = ownerColor;
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(state.powerUp.owner === "player" ? 42 : canvas.width - 42, state.powerUp.y);
  ctx.lineTo(state.powerUp.x, state.powerUp.y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(state.powerUp.x, state.powerUp.y, state.powerUp.r + pulse, 0, Math.PI * 2);
  ctx.fillStyle = state.powerUp.color;
  ctx.shadowColor = state.powerUp.color;
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#04111d";
  ctx.font = "900 14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.powerUp.id === "power-shot" ? "P" : state.powerUp.id === "slow-field" ? "S" : "M", state.powerUp.x, state.powerUp.y + 1);
}

function tick() {
  if (state.running && !state.paused) {
    updatePlayer();
    updateAi();
    updatePower();
    updateBall();
  }

  drawCourt();
  drawPaddle(state.player, maps[state.map].player, "player");
  drawPaddle(state.ai, maps[state.map].ai, "ai");
  drawPowerUp();
  drawBall();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  state.keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    if (!state.running) serve(Math.random() > 0.5 ? 1 : -1);
  }
});

window.addEventListener("keyup", (event) => state.keys.delete(event.code));

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const y = (event.clientY - rect.top) / rect.height * canvas.height;
  state.player.y = clamp(y - state.player.h / 2, 0, canvas.height - state.player.h);
});

serveButton.addEventListener("click", () => serve(Math.random() > 0.5 ? 1 : -1));
pauseButton.addEventListener("click", () => {
  if (!state.running) return;
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  setStatus(state.paused ? "Paused" : "Rally live");
});
resetButton.addEventListener("click", resetGame);
modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
mapButtons.forEach((button) => button.addEventListener("click", () => setMap(button.dataset.map)));

resetGame();
tick();
