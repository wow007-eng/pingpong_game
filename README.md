# Codex PingPong

A browser Pong game where you play against a Codex-controlled paddle. The game includes keyboard, mouse, and touch controls, three difficulty modes, and power-ups that can be collected by either player.

## Requirements

- Node.js
- npm

There are no third-party package dependencies.

## Run the Game

From this folder, start the local server:

```bash
npm run start
```

Open the game in your browser:

```text
http://localhost:4173
```

Click **Serve** or press `Space` to start a rally.

## Controls

- Move up: `W` or `ArrowUp`
- Move down: `S` or `ArrowDown`
- Serve: `Space`
- Mouse or touch: drag inside the arena
- Pause or reset: use the buttons in the control panel

## Difficulty

Use the **Easy**, **Medium**, and **Hard** buttons to change the match speed and challenge.

## Power-Ups

Power-ups appear during live rallies. Both you and Codex can collect side pickups.

- **Mega Paddle**: temporarily makes the collecting paddle taller.
- **Slow Field**: slows the ball.
- **Power Shot**: arms the collecting side; the next paddle hit fires a faster shot.

The HUD shows:

- **Your power**
- **Arena pickup**
- **Codex power**

## Run the Codex Paddle Controller

The Codex paddle only moves when fresh commands are written. To manually start and stop the opponent controller, open a second terminal in this folder and run:

```bash
npm run controller
```

Stop it anytime with `Ctrl+C`.

You can also run it for a fixed time. For example, on PowerShell:

```powershell
$env:PONG_CONTROLLER_MS=60000; npm run controller
```

That runs the controller for 60 seconds.

## Optional MCP Server

This project also includes a small MCP server for Codex-compatible clients:

```bash
npm run mcp
```

It exposes two tools:

- `pong_get_state`: reads the latest live game state.
- `pong_set_move`: commands the Codex paddle to move `up`, `down`, or `hold`.

Example MCP config:

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

## Logs and State Files

The game writes local runtime files while it is running:

- `pong-live-state.json`: latest game state from the browser.
- `pong-codex-command.json`: latest Codex paddle command.
- `mcp-connection.log`: server, MCP, and gameplay bridge logs.

If the Codex paddle stops moving, start or restart the controller:

```bash
npm run controller
```
