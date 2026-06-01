const TYPE_CHART = {
  Ember: { strong: "Bloom", weak: "Tide" },
  Tide: { strong: "Ember", weak: "Volt" },
  Bloom: { strong: "Stone", weak: "Ember" },
  Volt: { strong: "Tide", weak: "Stone" },
  Stone: { strong: "Volt", weak: "Bloom" }
};

const MOVES = {
  "glimmer-jab": {
    id: "glimmer-jab",
    name: "Glimmer Jab",
    type: "Bloom",
    kind: "quick",
    power: 18,
    energyCost: 0,
    energyGain: 12,
    description: "Quick strike. Restores 12 energy."
  },
  "vine-lash": {
    id: "vine-lash",
    name: "Vine Lash",
    type: "Bloom",
    kind: "heavy",
    power: 28,
    energyCost: 0,
    energyGain: 4,
    description: "Reliable heavy strike. May stun."
  },
  "prism-guard": {
    id: "prism-guard",
    name: "Prism Guard",
    type: "Bloom",
    kind: "guard",
    power: 0,
    energyCost: 0,
    energyGain: 10,
    description: "Gain shield and energy."
  },
  "bloom-burst": {
    id: "bloom-burst",
    name: "Bloom Burst",
    type: "Bloom",
    kind: "special",
    power: 42,
    energyCost: 28,
    energyGain: 0,
    description: "Heavy Bloom hit. May regenerate."
  },
  "spark-bite": {
    id: "spark-bite",
    name: "Spark Bite",
    type: "Ember",
    kind: "quick",
    power: 17,
    energyCost: 0,
    energyGain: 12,
    description: "Quick bite. Restores 12 energy."
  },
  "ember-claw": {
    id: "ember-claw",
    name: "Ember Claw",
    type: "Ember",
    kind: "heavy",
    power: 29,
    energyCost: 0,
    energyGain: 4,
    description: "Reliable heavy strike. May stun."
  },
  "coal-guard": {
    id: "coal-guard",
    name: "Coal Guard",
    type: "Ember",
    kind: "guard",
    power: 0,
    energyCost: 0,
    energyGain: 10,
    description: "Gain shield and energy."
  },
  "flare-surge": {
    id: "flare-surge",
    name: "Flare Surge",
    type: "Ember",
    kind: "special",
    power: 44,
    energyCost: 30,
    energyGain: 0,
    description: "Heavy Ember hit. May burn."
  }
};

const CREATURES = {
  player: {
    id: "player",
    name: "Lumora",
    type: "Bloom",
    maxHp: 120,
    hp: 120,
    maxEnergy: 70,
    energy: 32,
    attack: 24,
    defense: 15,
    speed: 18,
    moves: [MOVES["glimmer-jab"], MOVES["vine-lash"], MOVES["prism-guard"], MOVES["bloom-burst"]],
    statusEffects: []
  },
  codex: {
    id: "codex",
    name: "Cindrix",
    type: "Ember",
    maxHp: 116,
    hp: 116,
    maxEnergy: 72,
    energy: 34,
    attack: 25,
    defense: 14,
    speed: 16,
    moves: [MOVES["spark-bite"], MOVES["ember-claw"], MOVES["coal-guard"], MOVES["flare-surge"]],
    statusEffects: []
  }
};

let state = newBattle();

const $ = (id) => document.getElementById(id);

const elements = {
  battleLog: $("battleLog"),
  battleMode: $("battleMode"),
  bridgeStatus: $("bridgeStatus"),
  codexEnergyBar: $("codexEnergyBar"),
  codexHpBar: $("codexHpBar"),
  codexHpText: $("codexHpText"),
  codexMode: $("codexMode"),
  codexStats: $("codexStats"),
  codexStatuses: $("codexStatuses"),
  localBotBtn: $("localBotBtn"),
  moveButtons: $("moveButtons"),
  playerEnergyBar: $("playerEnergyBar"),
  playerFloat: $("playerFloat"),
  playerHpBar: $("playerHpBar"),
  playerHpText: $("playerHpText"),
  playerStats: $("playerStats"),
  playerStatuses: $("playerStatuses"),
  requestCodexBtn: $("requestCodexBtn"),
  restartBtn: $("restartBtn"),
  selectedAction: $("selectedAction"),
  codexFloat: $("codexFloat"),
  turnNumber: $("turnNumber")
};

function newBattle() {
  return {
    turn: 1,
    battleMode: "player-choice",
    selectedPlayerAction: null,
    codexBehaviorMode: "tactical",
    winner: null,
    recentEvents: ["A bright clearing opens. Lumora faces Cindrix."],
    creatures: {
      player: cloneCreature(CREATURES.player),
      codex: cloneCreature(CREATURES.codex)
    }
  };
}

function cloneCreature(creature) {
  return {
    ...creature,
    moves: creature.moves.map((move) => ({ ...move })),
    statusEffects: []
  };
}

function compactState() {
  return {
    turn: state.turn,
    battleMode: state.battleMode,
    codexBehaviorMode: state.codexBehaviorMode,
    selectedPlayerAction: state.selectedPlayerAction,
    winner: state.winner,
    creatures: {
      player: publicCreature(state.creatures.player),
      codex: publicCreature(state.creatures.codex)
    },
    availableCodexMoves: state.creatures.codex.moves.filter((move) => canAfford(state.creatures.codex, move)).map(publicMove),
    recentEvents: state.recentEvents.slice(-12)
  };
}

function publicCreature(creature) {
  return {
    id: creature.id,
    name: creature.name,
    type: creature.type,
    hp: creature.hp,
    maxHp: creature.maxHp,
    energy: creature.energy,
    maxEnergy: creature.maxEnergy,
    attack: creature.attack,
    defense: creature.defense,
    speed: creature.speed,
    statusEffects: creature.statusEffects.map((effect) => ({ ...effect })),
    moves: creature.moves.map(publicMove)
  };
}

function publicMove(move) {
  return {
    id: move.id,
    name: move.name,
    type: move.type,
    kind: move.kind,
    power: move.power,
    energyCost: move.energyCost,
    energyGain: move.energyGain,
    description: move.description
  };
}

function addEvent(message) {
  state.recentEvents.push(message);
  state.recentEvents = state.recentEvents.slice(-30);
}

function percent(value, max) {
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
}

function render() {
  const player = state.creatures.player;
  const codex = state.creatures.codex;

  elements.turnNumber.textContent = `Turn ${state.turn}`;
  elements.battleMode.textContent = modeLabel();
  elements.playerHpText.textContent = `${player.hp} / ${player.maxHp} HP`;
  elements.codexHpText.textContent = `${codex.hp} / ${codex.maxHp} HP`;
  elements.playerHpBar.style.width = percent(player.hp, player.maxHp);
  elements.codexHpBar.style.width = percent(codex.hp, codex.maxHp);
  elements.playerEnergyBar.style.width = percent(player.energy, player.maxEnergy);
  elements.codexEnergyBar.style.width = percent(codex.energy, codex.maxEnergy);
  elements.playerStats.innerHTML = statsHtml(player);
  elements.codexStats.innerHTML = statsHtml(codex);
  elements.playerStatuses.innerHTML = statusHtml(player);
  elements.codexStatuses.innerHTML = statusHtml(codex);
  elements.selectedAction.textContent = state.selectedPlayerAction
    ? `Selected action: ${state.selectedPlayerAction.name}`
    : "Selected action: none";
  elements.battleLog.innerHTML = state.recentEvents
    .slice()
    .reverse()
    .map((event) => `<li>${escapeHtml(event)}</li>`)
    .join("");

  const waiting = state.battleMode === "waiting-codex";
  const playerChoosing = state.battleMode === "player-choice";
  elements.requestCodexBtn.disabled = !waiting;
  elements.localBotBtn.disabled = !waiting;

  for (const button of elements.moveButtons.querySelectorAll("button")) {
    const move = player.moves.find((item) => item.id === button.dataset.moveId);
    button.disabled = !playerChoosing || !canAfford(player, move);
  }
}

function modeLabel() {
  if (state.winner === "player") return "Lumora wins";
  if (state.winner === "codex") return "Cindrix wins";
  if (state.battleMode === "waiting-codex") return "Waiting for Codex...";
  if (state.battleMode === "game-over") return "Battle ended";
  return "Player choosing";
}

function statsHtml(creature) {
  return `
    <span>EN ${creature.energy}/${creature.maxEnergy}</span>
    <span>SPD ${creature.speed}</span>
    <span>ATK ${creature.attack}</span>
    <span>DEF ${creature.defense}</span>
  `;
}

function statusHtml(creature) {
  if (creature.statusEffects.length === 0) return "<span>clear</span>";
  return creature.statusEffects
    .map((effect) => `<span>${escapeHtml(effect.label)} ${effect.turns ? effect.turns : ""}</span>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createMoveButtons() {
  elements.moveButtons.innerHTML = state.creatures.player.moves
    .map((move) => {
      const cost = move.energyCost ? `${move.energyCost} EN` : `+${move.energyGain} EN`;
      return `
        <button class="move-button" data-move-id="${move.id}">
          <strong>${move.name}</strong>
          <small>${move.kind.toUpperCase()} | ${move.type} | ${cost}</small>
          <small>${move.description}</small>
        </button>
      `;
    })
    .join("");

  for (const button of elements.moveButtons.querySelectorAll("button")) {
    button.addEventListener("click", () => choosePlayerMove(button.dataset.moveId));
  }
}

function canAfford(creature, move) {
  return creature.energy >= (move?.energyCost || 0);
}

async function choosePlayerMove(moveId) {
  if (state.battleMode !== "player-choice") return;
  const player = state.creatures.player;
  const codex = state.creatures.codex;
  const move = player.moves.find((item) => item.id === moveId);
  if (!move || !canAfford(player, move)) return;

  state.selectedPlayerAction = { turn: state.turn, moveId: move.id, name: move.name };
  applyStartOfActorTurn(player);
  applyMove(player, codex, move);

  if (finishIfGameOver()) {
    await writeLiveState();
    render();
    return;
  }

  if (hasStatus(codex, "stunned")) {
    removeStatus(codex, "stunned");
    addEvent("Cindrix is stunned and skips the Codex action.");
    beginNextTurn();
  } else {
    state.battleMode = "waiting-codex";
    addEvent("Live state written. Waiting for Codex to choose a move through MCP.");
  }

  await writeLiveState();
  render();
}

function applyStartOfActorTurn(actor) {
  if (hasStatus(actor, "burn")) {
    const burn = getStatus(actor, "burn");
    const damage = 6;
    actor.hp = Math.max(0, actor.hp - damage);
    burn.turns -= 1;
    floatFor(actor.id, `-${damage}`);
    addEvent(`${actor.name} takes ${damage} burn damage.`);
    if (burn.turns <= 0) removeStatus(actor, "burn");
  }

  if (hasStatus(actor, "regeneration")) {
    const regen = getStatus(actor, "regeneration");
    const healed = Math.min(8, actor.maxHp - actor.hp);
    actor.hp += healed;
    regen.turns -= 1;
    addEvent(`${actor.name} regenerates ${healed} HP.`);
    if (regen.turns <= 0) removeStatus(actor, "regeneration");
  }
}

function applyMove(actor, target, move) {
  actor.energy = clamp(actor.energy - move.energyCost + move.energyGain, 0, actor.maxEnergy);

  if (move.kind === "guard") {
    addOrRefreshStatus(actor, {
      id: "shield",
      label: "shield",
      turns: 1,
      value: 0.45
    });
    addEvent(`${actor.name} uses ${move.name}, raising a shield.`);
    return;
  }

  const affinity = typeMultiplier(move.type, target.type);
  const shield = getStatus(target, "shield");
  const shieldMultiplier = shield ? 1 - shield.value : 1;
  const raw = move.power + actor.attack - Math.floor(target.defense * 0.65);
  const damage = Math.max(4, Math.round(raw * affinity * shieldMultiplier));
  target.hp = Math.max(0, target.hp - damage);
  if (shield) removeStatus(target, "shield");

  const affinityText = affinity > 1 ? " It's type-favored." : affinity < 1 ? " It is resisted." : "";
  const shieldText = shield ? " The shield softens the blow." : "";
  addEvent(`${actor.name} uses ${move.name} for ${damage} damage.${affinityText}${shieldText}`);
  floatFor(target.id, `-${damage}`);

  if (move.id === "bloom-burst" && Math.random() < 0.45) {
    addOrRefreshStatus(actor, { id: "regeneration", label: "regen", turns: 3 });
    addEvent("Lumora's petals glow with regeneration.");
  }

  if (move.id === "flare-surge" && Math.random() < 0.45) {
    addOrRefreshStatus(target, { id: "burn", label: "burn", turns: 3 });
    addEvent("Cindrix leaves a lingering burn.");
  }

  if (move.kind === "heavy" && Math.random() < 0.2) {
    addOrRefreshStatus(target, { id: "stunned", label: "stunned", turns: 1 });
  }
}

function typeMultiplier(attackingType, defendingType) {
  const chart = TYPE_CHART[attackingType];
  if (!chart) return 1;
  if (chart.strong === defendingType) return 1.25;
  if (chart.weak === defendingType) return 0.8;
  return 1;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addOrRefreshStatus(creature, effect) {
  const existing = getStatus(creature, effect.id);
  if (existing) Object.assign(existing, effect);
  else creature.statusEffects.push({ ...effect });
}

function getStatus(creature, id) {
  return creature.statusEffects.find((effect) => effect.id === id);
}

function hasStatus(creature, id) {
  return Boolean(getStatus(creature, id));
}

function removeStatus(creature, id) {
  creature.statusEffects = creature.statusEffects.filter((effect) => effect.id !== id);
}

function finishIfGameOver() {
  const player = state.creatures.player;
  const codex = state.creatures.codex;
  if (player.hp <= 0 || codex.hp <= 0) {
    state.winner = player.hp > codex.hp ? "player" : "codex";
    state.battleMode = "game-over";
    addEvent(state.winner === "player" ? "Lumora wins the battle." : "Cindrix wins the battle.");
    return true;
  }
  return false;
}

function beginNextTurn() {
  state.turn += 1;
  state.selectedPlayerAction = null;
  state.battleMode = "player-choice";
  addEvent(`Turn ${state.turn} begins.`);
}

async function requestCodexMove() {
  if (state.battleMode !== "waiting-codex") return;
  const action = await readCodexAction();
  if (!action) {
    addEvent("No Codex action is available yet. Keep waiting or use Local Bot Move for testing.");
    render();
    return;
  }

  const invalid = validateCodexAction(action);
  if (invalid) {
    addEvent(`Rejected Codex action: ${invalid}`);
    await logBridge(`browser rejected codex action: ${invalid}`);
    render();
    return;
  }

  const codex = state.creatures.codex;
  const player = state.creatures.player;
  const move = codex.moves.find((item) => item.id === action.moveId);
  addEvent(`Codex chose ${move.name}: ${action.reason}`);
  applyStartOfActorTurn(codex);
  if (!finishIfGameOver()) {
    applyMove(codex, player, move);
    if (!finishIfGameOver()) beginNextTurn();
  }
  await clearCodexAction();
  await writeLiveState();
  render();
}

function validateCodexAction(action) {
  const codex = state.creatures.codex;
  if (state.battleMode !== "waiting-codex") return "battle is not waiting for Codex";
  if (action.turn !== state.turn) return `turn mismatch, expected ${state.turn} but got ${action.turn}`;
  if (action.action !== "move") return 'action must be "move"';
  if (typeof action.reason !== "string" || action.reason.trim().length === 0) return "reason is required";
  if (hasStatus(codex, "stunned")) return "Codex is stunned and should skip";
  const move = codex.moves.find((item) => item.id === action.moveId);
  if (!move) return `moveId "${action.moveId}" is not available`;
  if (!canAfford(codex, move)) return `${move.name} costs ${move.energyCost} energy, but Cindrix has ${codex.energy}`;
  return null;
}

function chooseLocalBotAction() {
  if (state.battleMode !== "waiting-codex") return;
  const action = pickBotAction();
  addEvent(`Local test bot selected ${action.moveId}.`);
  void simulateCodexAction(action);
}

async function simulateCodexAction(action) {
  await fetch("battle-codex-action.json", { cache: "no-store" }).catch(() => null);
  const invalid = validateCodexAction(action);
  if (invalid) {
    addEvent(`Local bot produced invalid action: ${invalid}`);
    render();
    return;
  }
  await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: `local bot action ${action.moveId}` })
  }).catch(() => null);
  const codex = state.creatures.codex;
  const player = state.creatures.player;
  const move = codex.moves.find((item) => item.id === action.moveId);
  addEvent(`Local Bot chose ${move.name}: ${action.reason}`);
  applyStartOfActorTurn(codex);
  if (!finishIfGameOver()) {
    applyMove(codex, player, move);
    if (!finishIfGameOver()) beginNextTurn();
  }
  await writeLiveState();
  render();
}

function pickBotAction() {
  const mode = state.codexBehaviorMode;
  const codex = state.creatures.codex;
  const player = state.creatures.player;
  const affordable = codex.moves.filter((move) => canAfford(codex, move));
  const moveById = (id) => affordable.find((move) => move.id === id);

  let move = affordable[0];
  let reason = "A simple legal move keeps the turn moving.";

  if (mode === "random") {
    move = affordable[Math.floor(Math.random() * affordable.length)];
    reason = "Random testing mode picked a legal move.";
  } else if (mode === "aggressive") {
    move = moveById("flare-surge") || moveById("ember-claw") || affordable[0];
    reason = "Aggressive mode prefers the highest pressure move.";
  } else if (mode === "cautious") {
    move = codex.hp < codex.maxHp * 0.35 ? moveById("coal-guard") || affordable[0] : moveById("ember-claw") || affordable[0];
    reason = "Cautious mode protects Cindrix when HP is low.";
  } else {
    if (player.hp <= 38 && moveById("ember-claw")) {
      move = moveById("ember-claw");
      reason = "Tactical mode sees Lumora is low and chooses reliable damage.";
    } else if (codex.energy >= 30 && moveById("flare-surge")) {
      move = moveById("flare-surge");
      reason = "Tactical mode has enough energy for a special strike.";
    } else {
      move = moveById("spark-bite") || affordable[0];
      reason = "Tactical mode builds energy for a later special.";
    }
  }

  return {
    turn: state.turn,
    action: "move",
    moveId: move.id,
    reason
  };
}

async function readCodexAction() {
  try {
    const response = await fetch("/api/action", { cache: "no-store" });
    return await response.json();
  } catch {
    addEvent("Could not read battle-codex-action.json through the local server.");
    return null;
  }
}

async function writeLiveState() {
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compactState())
    });
    elements.bridgeStatus.textContent = "Live state saved";
  } catch {
    elements.bridgeStatus.textContent = "Server bridge unavailable";
  }
}

async function clearCodexAction() {
  await fetch("/api/action", { method: "DELETE" }).catch(() => null);
}

async function logBridge(message) {
  await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  }).catch(() => null);
}

function floatFor(targetId, text) {
  const element = targetId === "player" ? elements.playerFloat : elements.codexFloat;
  element.textContent = text;
  element.classList.remove("show");
  window.requestAnimationFrame(() => {
    element.classList.add("show");
    window.setTimeout(() => element.classList.remove("show"), 600);
  });
}

async function restart() {
  state = newBattle();
  state.codexBehaviorMode = elements.codexMode.value;
  await clearCodexAction();
  await writeLiveState();
  createMoveButtons();
  render();
}

elements.requestCodexBtn.addEventListener("click", requestCodexMove);
elements.localBotBtn.addEventListener("click", chooseLocalBotAction);
elements.restartBtn.addEventListener("click", restart);
elements.codexMode.addEventListener("change", async () => {
  state.codexBehaviorMode = elements.codexMode.value;
  addEvent(`Codex behavior mode set to ${state.codexBehaviorMode}.`);
  await writeLiveState();
  render();
});

createMoveButtons();
await writeLiveState();
render();
