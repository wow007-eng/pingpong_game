import { readFile, writeFile } from "node:fs/promises";

const statePath = "pong-live-state.json";
const commandPath = "pong-codex-command.json";
const runMs = process.env.PONG_CONTROLLER_MS ? Number(process.env.PONG_CONTROLLER_MS) : Infinity;
const intervalMs = Number(process.env.PONG_CONTROLLER_INTERVAL_MS || 50);
let running = true;

process.on("SIGINT", () => {
  running = false;
});

function reflect(y, min, max) {
  let target = y;
  while (target < min || target > max) {
    if (target < min) target = min + (min - target);
    if (target > max) target = max - (target - max);
  }
  return target;
}

function decide(state) {
  const center = state.aiPaddleY + state.aiPaddleHeight / 2;
  const framesToPaddle = state.ballVx > 0
    ? Math.max(3, Math.min(30, (state.aiPaddleX - state.ballX) / Math.max(0.1, state.ballVx)))
    : 7;
  const target = reflect(
    state.ballY + state.ballVy * framesToPaddle,
    state.ballRadius,
    state.boardHeight - state.ballRadius
  );
  const error = target - center;

  if (Math.abs(error) < 7) {
    return {
      move: "hold",
      intensity: 0,
      reason: `direct controller: center ${center.toFixed(1)} near target ${target.toFixed(1)}`
    };
  }

  return {
    move: error > 0 ? "down" : "up",
    intensity: Math.min(1, Math.max(0.35, Math.abs(error) / 65)),
    reason: `direct controller: target ${target.toFixed(1)}, center ${center.toFixed(1)}`
  };
}

const endAt = Date.now() + runMs;
while (running && Date.now() < endAt) {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    const command = {
      ...decide(state),
      createdAt: new Date().toISOString(),
      client: "codex-direct-controller"
    };
    await writeFile(commandPath, JSON.stringify(command, null, 2), "utf8");
  } catch {
    await writeFile(commandPath, JSON.stringify({
      move: "hold",
      intensity: 0,
      reason: "direct controller: waiting for live state",
      createdAt: new Date().toISOString(),
      client: "codex-direct-controller"
    }, null, 2), "utf8");
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
