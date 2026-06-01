import { readFile, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const statePath = join(root, "battle-live-state.json");
const actionPath = join(root, "battle-codex-action.json");
const logPath = join(root, "mcp-connection.log");

function log(message) {
  return appendFile(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8").catch(() => {});
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function getAvailableMoves(state) {
  return state?.availableCodexMoves || state?.creatures?.codex?.moves || [];
}

function validateAction(state, action) {
  if (!state) return "No live battle state is available. Open the browser game first.";
  if (!action || typeof action !== "object") return "Action must be an object.";
  if (state.battleMode !== "waiting-codex") return `Battle mode is "${state.battleMode}", not "waiting-codex".`;
  if (action.turn !== state.turn) return `Turn mismatch. Expected ${state.turn}, got ${action.turn}.`;
  if (action.action !== "move") return 'Action must be "move".';
  if (typeof action.reason !== "string" || action.reason.trim().length === 0) return "Reason is required.";
  const codex = state.creatures?.codex;
  if (!codex) return "Codex creature state is missing.";
  if ((codex.statusEffects || []).some((effect) => effect.id === "stunned")) return "Codex is stunned and will skip its action.";
  const allMoves = state.creatures?.codex?.moves || getAvailableMoves(state);
  const move = allMoves.find((item) => item.id === action.moveId);
  if (!move) return `Unknown moveId "${action.moveId}".`;
  if ((move.energyCost || 0) > codex.energy) return `${move.name} costs ${move.energyCost} energy, but Cindrix has ${codex.energy}.`;
  return null;
}

const tools = [
  {
    name: "battle_get_state",
    description: "Returns the current Codex Monster Battle turn, creature state, available Codex moves, recent events, and battle mode.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "battle_set_action",
    description: "Writes Codex's selected move for the current turn to battle-codex-action.json.",
    inputSchema: {
      type: "object",
      required: ["turn", "action", "moveId", "reason"],
      properties: {
        turn: { type: "number" },
        action: { type: "string", enum: ["move"] },
        moveId: { type: "string" },
        reason: { type: "string" }
      },
      additionalProperties: false
    }
  }
];

async function callTool(name, args) {
  if (name === "battle_get_state") {
    const state = await readJson(statePath, null);
    await log(`battle_get_state turn=${state?.turn ?? "none"} mode=${state?.battleMode ?? "none"}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(state || { error: "No live battle state yet. Start the game in a browser." }, null, 2)
        }
      ]
    };
  }

  if (name === "battle_set_action") {
    const state = await readJson(statePath, null);
    const invalid = validateAction(state, args);
    const action = {
      turn: args?.turn,
      action: args?.action,
      moveId: args?.moveId,
      reason: args?.reason,
      receivedAt: new Date().toISOString(),
      validAtWrite: !invalid,
      validationMessage: invalid || "accepted"
    };
    await writeFile(actionPath, `${JSON.stringify(action, null, 2)}\n`, "utf8");
    await log(`battle_set_action turn=${action.turn} move=${action.moveId} valid=${action.validAtWrite} ${action.validationMessage}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: !invalid, action }, null, 2)
        }
      ],
      isError: Boolean(invalid)
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

function respond(id, result, error) {
  const message = error
    ? { jsonrpc: "2.0", id, error: { code: -32000, message: error.message || String(error) } }
    : { jsonrpc: "2.0", id, result };
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (!message || !message.method) return;
  if (message.method === "initialize") {
    respond(message.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "codex-monster-battle", version: "1.0.0" }
    });
    return;
  }
  if (message.method === "tools/list") {
    respond(message.id, { tools });
    return;
  }
  if (message.method === "tools/call") {
    try {
      respond(message.id, await callTool(message.params?.name, message.params?.arguments || {}));
    } catch (error) {
      respond(message.id, null, error);
    }
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      handle(JSON.parse(line));
    } catch (error) {
      log(`bad json-rpc message: ${error.message}`);
    }
  }
});

await log("codex-monster-battle MCP server started");
