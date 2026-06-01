import { createServer } from "node:http";
import { appendFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const logPath = join(root, "mcp-connection.log");
const statePath = join(root, "pong-live-state.json");
const commandPath = join(root, "pong-codex-command.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function log(message, details) {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  const line = `[${new Date().toISOString()}] ${message}${suffix}\n`;
  console.log(line.trimEnd());
  appendFileSync(logPath, line, "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function commandToVelocity(command) {
  const move = command.move === "up" || command.move === "down" ? command.move : "hold";
  const intensity = Math.max(0, Math.min(1, Number(command.intensity) || 0));
  if (move === "hold" || intensity === 0) return 0;
  return (move === "down" ? 1 : -1) * (2 + intensity * 8);
}

async function handleAiMove(req, res) {
  const body = await readBody(req);
  const state = JSON.parse(body || "{}");
  const snapshot = { ...state, updatedAt: new Date().toISOString() };
  await writeFile(statePath, JSON.stringify(snapshot, null, 2), "utf8");

  const command = await readJson(commandPath, null);
  const commandAge = command?.createdAt ? Date.now() - Date.parse(command.createdAt) : Infinity;
  const isFreshCommand = Number.isFinite(commandAge) && commandAge < 900;
  const decision = {
    mode: state.mode || "medium",
    move: isFreshCommand ? command.move : "hold",
    velocity: isFreshCommand ? commandToVelocity(command) : 0,
    source: isFreshCommand ? "codex-mcp-command" : "waiting-for-codex",
    commandAgeMs: Number.isFinite(commandAge) ? commandAge : null
  };

  if (isFreshCommand) {
    log("gameplay used codex mcp command", {
      server: "codex-pingpong",
      tool: "pong_set_move",
      move: decision.move,
      velocity: Number(decision.velocity.toFixed(3)),
      commandAgeMs: commandAge
    });
  } else {
    log("gameplay waiting for codex mcp command", {
      server: "codex-pingpong",
      neededTool: "pong_set_move"
    });
  }

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(decision));
}

async function handleGameEvent(req, res) {
  const body = await readBody(req);
  const event = JSON.parse(body || "{}");
  log("game event", {
    type: event.type || "unknown",
    power: event.power || null,
    mode: event.mode || null
  });
  res.writeHead(204, { "Cache-Control": "no-store" });
  res.end();
}

function resolvePath(url) {
  const requested = decodeURIComponent(new URL(url, `http://localhost:${port}`).pathname);
  const relative = requested === "/" ? "index.html" : requested.slice(1);
  const safePath = normalize(relative).replace(/^(\.\.[/\\])+/, "");
  return join(root, safePath);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    if (url.pathname === "/api/pong-move" && req.method === "POST") {
      await handleAiMove(req, res);
      return;
    }
    if (url.pathname === "/api/game-event" && req.method === "POST") {
      await handleGameEvent(req, res);
      return;
    }

    const filePath = resolvePath(req.url || "/");
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, () => {
  log("codex pingpong http bridge started", { url: `http://localhost:${port}` });
});
