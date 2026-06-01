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

const state = {
  mode: "medium",
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const courtGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  courtGradient.addColorStop(0, "#f7fdff");
  courtGradient.addColorStop(0.48, "#eaf8ff");
  courtGradient.addColorStop(1, "#fff7e8");
  ctx.fillStyle = courtGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(26, 167, 216, 0.08)";
  for (let x = 48; x < canvas.width; x += 96) {
    ctx.fillRect(x, 18, 1, canvas.height - 36);
  }
  for (let y = 54; y < canvas.height; y += 72) {
    ctx.fillRect(18, y, canvas.width - 36, 1);
  }

  ctx.strokeStyle = "rgba(26, 167, 216, 0.34)";
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.strokeStyle = "rgba(62, 212, 137, 0.32)";
  ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

  ctx.setLineDash([16, 18]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 26);
  ctx.lineTo(canvas.width / 2, canvas.height - 26);
  ctx.strokeStyle = "rgba(22, 32, 51, 0.18)";
  ctx.stroke();
  ctx.setLineDash([]);
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
  const ball = state.ball;
  ball.trail.forEach((point, index) => {
    ctx.globalAlpha = (ball.trail.length - index) / ball.trail.length * 0.28;
    ctx.beginPath();
    ctx.arc(point.x, point.y, ball.r + index * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = "#42d9ff";
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#162033";
  ctx.shadowColor = "#42d9ff";
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
  drawPaddle(state.player, "#8ef5b0", "player");
  drawPaddle(state.ai, "#ff6b78", "ai");
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

resetGame();
tick();
