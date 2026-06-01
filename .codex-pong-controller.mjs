import { spawn } from "node:child_process";

const runMs = Number(process.env.PONG_CONTROLLER_MS || 300000);
const intervalMs = Number(process.env.PONG_CONTROLLER_INTERVAL_MS || 70);

const child = spawn(process.execPath, ["mcp-server.js"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"]
});

child.stderr.on("data", () => {});

let buffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`timeout ${method}`));
    }, 2000);
  });
}

function readOne() {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd < 0) return null;
  const header = buffer.slice(0, headerEnd).toString("utf8");
  const match = header.match(/Content-Length:\s*(\d+)/i);
  if (!match) throw new Error("bad header");
  const start = headerEnd + 4;
  const end = start + Number(match[1]);
  if (buffer.length < end) return null;
  const message = JSON.parse(buffer.slice(start, end).toString("utf8"));
  buffer = buffer.slice(end);
  return message;
}

child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  let message;
  while ((message = readOne())) {
    const waiter = pending.get(message.id);
    if (!waiter) continue;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
  }
});

function parseTool(result) {
  return JSON.parse(result?.content?.[0]?.text || "{}");
}

function reflectedTarget(y, min, max) {
  let target = y;
  while (target < min || target > max) {
    if (target < min) target = min + (min - target);
    if (target > max) target = max - (target - max);
  }
  return target;
}

function chooseMove(payload) {
  const state = payload.state;
  if (!state) return { move: "hold", intensity: 0, reason: "No live state yet" };

  const center = state.aiPaddleY + state.aiPaddleHeight / 2;
  const framesToPaddle = state.ballVx > 0
    ? Math.max(4, Math.min(28, (state.aiPaddleX - state.ballX) / Math.max(0.1, state.ballVx)))
    : 8;
  const target = reflectedTarget(
    state.ballY + state.ballVy * framesToPaddle,
    state.ballRadius,
    state.boardHeight - state.ballRadius
  );
  const error = target - center;

  if (Math.abs(error) < 8) {
    return {
      move: "hold",
      intensity: 0,
      reason: `center ${center.toFixed(1)} near target ${target.toFixed(1)}`
    };
  }

  return {
    move: error > 0 ? "down" : "up",
    intensity: Math.min(1, Math.max(0.35, Math.abs(error) / 70)),
    reason: `target ${target.toFixed(1)}, center ${center.toFixed(1)}, ball ${state.ballX.toFixed(1)},${state.ballY.toFixed(1)}`
  };
}

try {
  await send("initialize", {
    protocolVersion: "2024-11-05",
    clientInfo: { name: "codex-background-paddle", version: "1.0.0" },
    capabilities: {}
  });
  await send("tools/list");

  const endAt = Date.now() + runMs;
  while (Date.now() < endAt) {
    const state = parseTool(await send("tools/call", { name: "pong_get_state", arguments: {} }));
    const move = chooseMove(state);
    await send("tools/call", { name: "pong_set_move", arguments: move });
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
} finally {
  child.kill("SIGINT");
}
