# Codex Monster Battle

Codex Monster Battle is a small turn-based browser creature battle game with original creatures, original moves, generated pixel-style art, and a JSON bridge for MCP control.

## Run the Game

```bash
cd monster
npm run start
```

Open `http://localhost:4173`.

The browser game writes and reads these local files:

- `battle-live-state.json`
- `battle-codex-action.json`
- `mcp-connection.log`

## Start the MCP Server

In a second terminal:

```bash
cd monster
npm run mcp
```

The server name is `codex-monster-battle`. It exposes two tools:

- `battle_get_state`
- `battle_set_action`

## MCP Turn Flow

1. In the browser, choose one of Lumora's four moves.
2. The game applies Lumora's move and writes `battle-live-state.json`.
3. The game enters `Waiting for Codex...`.
4. Codex calls `battle_get_state`.
5. Codex chooses one available Cindrix move and calls `battle_set_action`.
6. In the browser, click `Request Codex Move`.
7. The game validates and applies the action, then starts the next turn.

Example Codex action:

```json
{
  "turn": 4,
  "action": "move",
  "moveId": "ember-claw",
  "reason": "Player is low HP, so use a reliable attack."
}
```

Valid Codex move IDs are:

- `spark-bite`
- `ember-claw`
- `coal-guard`
- `flare-surge`

The game rejects invalid actions in the battle log. Rejections include early actions while the browser is not waiting for Codex, wrong turn numbers, unknown move IDs, missing reasons, and moves that cost more energy than Cindrix currently has. If Cindrix is stunned, it skips its action.

## Why Turn-Based Works Better for MCP

MCP calls are request/response tool interactions, not realtime controller input. This design gives Codex a stable state snapshot, lets it reason once per turn, and avoids timing pressure. The browser can wait seconds or minutes for an action without breaking the battle.

## Local Bot Testing

Use `Local Bot Move (testing only)` when you want to test the game without an MCP client. It uses the selected behavior mode:

- `cautious`: guards when Cindrix is low on HP
- `aggressive`: prefers high-damage moves
- `tactical`: balances energy, finishing blows, and special attacks
- `random`: picks any legal move

This button is deliberately labeled as testing-only so it is not confused with a real Codex MCP action.

## Files

- `index.html`: game UI
- `styles.css`: light fantasy pixel UI styling
- `game.js`: battle rules, state rendering, validation, bridge fetches
- `server.js`: static server plus JSON bridge endpoints
- `mcp-server.js`: MCP stdio server named `codex-monster-battle`
- `assets/codex-monster-battle-sheet.png`: generated original pixel-style art
