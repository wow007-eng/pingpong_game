# Codex PingPong

A self-contained Pong game where the player faces a Codex-inspired AI paddle. The game has Easy, Medium, and Hard modes, keyboard and pointer controls, and a small MCP server that Codex-compatible clients can attach to.

## Play

Open `index.html` directly in a browser, or run the local server:

```bash
npm start
```

Then visit `http://localhost:4173`.

During live play, the browser sends the latest game state to the Node server through `POST /api/pong-move`. The server writes that state to `pong-live-state.json` and only moves the Codex paddle when Codex has sent a fresh command through the MCP tool `pong_set_move`. If Codex does not send a command, the paddle holds still.

Controls:

- `W` / `S` or `ArrowUp` / `ArrowDown` to move.
- Mouse or touch drag on the arena also controls your paddle.
- `Space` serves the ball.
- Collect glowing power-ups with your paddle. `Mega Paddle` widens your paddle, `Slow Field` slows the ball, and `Power Shot` speeds up the rally.

## MCP Server

Run the local MCP server:

```bash
npm run mcp
```

The server speaks MCP over stdio and exposes:

- `pong_get_state`: reads the latest live game state for Codex.
- `pong_set_move`: lets Codex explicitly command `up`, `down`, or `hold`.

Connection logs are written to `mcp-connection.log`. The MCP server logs the actual MCP client name when it is provided. The game bridge identifies itself as `pingpong-game-bridge`; the Codex app may show a different client name depending on how it initializes MCP.

Live browser gameplay also writes to the same log. When Codex controls the paddle, you should see `mcp client called tool` for `pong_set_move`, then `gameplay used codex mcp command`. If Codex has not sent a fresh move, you should see `gameplay waiting for codex mcp command`. When the player collects a power-up, you should see `game event` with `type` set to `power_collected`.

Example Codex MCP config entry:

```json
{
  "mcpServers": {
    "codex-pingpong": {
      "command": "node",
      "args": ["D:/Documents/Game by Codex/mcp-server.js"]
    }
  }
}
```

The browser game does not move the Codex paddle with local AI, and the MCP server does not calculate bot moves. The paddle moves only from explicit Codex commands sent through `pong_set_move`.
