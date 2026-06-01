import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const stdin = process.stdin;
const stdout = process.stdout;
const logPath = join(process.cwd(), "mcp-connection.log");
const statePath = join(process.cwd(), "pong-live-state.json");
const commandPath = join(process.cwd(), "pong-codex-command.json");
const mcpServerName = "codex-pingpong";
let mcpClientName = "unknown-mcp-client";

let buffer = Buffer.alloc(0);

function log(message, details) {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  const line = `[${new Date().toISOString()}] ${message}${suffix}\n`;
  process.stderr.write(line);
  appendFileSync(logPath, line, "utf8");
}

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  stdout.write(body);
}

function readMessage() {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) return null;
  const header = buffer.slice(0, headerEnd).toString("utf8");
  const match = header.match(/Content-Length:\s*(\d+)/i);
  if (!match) {
    buffer = Buffer.alloc(0);
    return null;
  }
  const length = Number(match[1]);
  const start = headerEnd + 4;
  const end = start + length;
  if (buffer.length < end) return null;
  const json = buffer.slice(start, end).toString("utf8");
  buffer = buffer.slice(end);
  return JSON.parse(json);
}

function tool(name, description, inputSchema) {
  return { name, description, inputSchema };
}

function textContent(value) {
  return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }];
}

const tools = [
  tool("pong_get_state", "Read the latest live Pong state so Codex can decide how to move the right paddle.", {
    type: "object",
    properties: {}
  }),
  tool("pong_set_move", "Move the Codex paddle. Codex must call this repeatedly during play; no JavaScript bot will choose moves.", {
    type: "object",
    properties: {
      move: { type: "string", enum: ["up", "down", "hold"] },
      intensity: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: "string" }
    },
    required: ["move", "intensity"]
  })
];

function readLatestState() {
  if (!existsSync(statePath)) {
    return {
      status: "no-live-state",
      instruction: "Start the browser game and press Serve, then call pong_get_state again."
    };
  }
  return {
    status: "live-state",
    state: JSON.parse(readFileSync(statePath, "utf8")),
    allowedMoves: ["up", "down", "hold"],
    instruction: "Decide the paddle movement yourself, then call pong_set_move with move and intensity."
  };
}

function writeMoveCommand(args) {
  const command = {
    move: args.move === "up" || args.move === "down" ? args.move : "hold",
    intensity: Math.max(0, Math.min(1, Number(args.intensity) || 0)),
    reason: args.reason || "",
    createdAt: new Date().toISOString(),
    client: mcpClientName
  };
  writeFileSync(commandPath, JSON.stringify(command, null, 2), "utf8");
  log("codex supplied paddle command", {
    client: mcpClientName,
    server: mcpServerName,
    tool: "pong_set_move",
    move: command.move,
    intensity: command.intensity,
    reason: command.reason
  });
  return {
    accepted: true,
    command,
    instruction: "Call pong_get_state and pong_set_move again quickly to keep controlling the paddle."
  };
}

function handle(request) {
  log("mcp client using server", {
    client: mcpClientName,
    server: mcpServerName,
    method: request.method,
    id: request.id ?? null
  });

  if (request.method === "initialize") {
    mcpClientName = request.params?.clientInfo?.name || "unknown-mcp-client";
    log("mcp client connected", { client: mcpClientName, server: mcpServerName });
    send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "codex-pingpong-mcp", version: "1.0.0" }
      }
    });
    return;
  }

  if (request.method === "tools/list") {
    log("mcp client requested tool list", { client: mcpClientName, server: mcpServerName, tools: tools.map((item) => item.name) });
    send({ jsonrpc: "2.0", id: request.id, result: { tools } });
    return;
  }

  if (request.method === "tools/call") {
    const { name, arguments: args = {} } = request.params || {};
    log("mcp client called tool", { client: mcpClientName, server: mcpServerName, tool: name, mode: args.mode ?? null });
    if (name === "pong_get_state") {
      send({ jsonrpc: "2.0", id: request.id, result: { content: textContent(readLatestState()) } });
      return;
    }
    if (name === "pong_set_move") {
      send({ jsonrpc: "2.0", id: request.id, result: { content: textContent(writeMoveCommand(args)) } });
      return;
    }
    log("unknown tool requested", { name });
    send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: `Unknown tool: ${name}` } });
    return;
  }

  if (request.id !== undefined) {
    log("unknown method requested", { method: request.method });
    send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: `Unknown method: ${request.method}` } });
  }
}

stdin.on("data", (chunk) => {
  try {
    buffer = Buffer.concat([buffer, chunk]);
    let message = readMessage();
    while (message) {
      handle(message);
      message = readMessage();
    }
  } catch (error) {
    log("mcp server error", { message: error.message });
  }
});

process.on("exit", () => log("pingpong mcp server stopped"));
process.on("SIGINT", () => {
  log("pingpong mcp server interrupted");
  process.exit(0);
});

log("pingpong mcp server started", { server: mcpServerName, logPath });
stdin.resume();
