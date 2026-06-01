import { createServer } from "node:http";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);

const files = {
  state: join(root, "battle-live-state.json"),
  action: join(root, "battle-codex-action.json"),
  log: join(root, "mcp-connection.log")
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp"
};

await mkdir(root, { recursive: true });

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function appendBridgeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await appendFile(files.log, line, "utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  try {
    if (url.pathname === "/api/state") {
      if (req.method === "GET") {
        send(res, 200, JSON.stringify(await readJson(files.state, null)));
        return;
      }
      if (req.method === "POST") {
        const json = JSON.parse(await readBody(req));
        await writeFile(files.state, `${JSON.stringify(json, null, 2)}\n`, "utf8");
        await appendBridgeLog(`browser wrote live state for turn ${json.turn ?? "unknown"}`);
        send(res, 200, JSON.stringify({ ok: true }));
        return;
      }
    }

    if (url.pathname === "/api/action") {
      if (req.method === "GET") {
        send(res, 200, JSON.stringify(await readJson(files.action, null)));
        return;
      }
      if (req.method === "DELETE") {
        await writeFile(files.action, "null\n", "utf8");
        await appendBridgeLog("browser cleared codex action");
        send(res, 200, JSON.stringify({ ok: true }));
        return;
      }
    }

    if (url.pathname === "/api/log" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      await appendBridgeLog(String(body.message || "browser event"));
      send(res, 200, JSON.stringify({ ok: true }));
      return;
    }

    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const filePath = normalize(join(root, requested));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    send(res, 200, await readFile(filePath), mime[extname(filePath)] || "application/octet-stream");
  } catch (error) {
    await appendBridgeLog(`server error: ${error.message}`);
    send(res, 500, JSON.stringify({ error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Codex Monster Battle running at http://localhost:${port}`);
});
