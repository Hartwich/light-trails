import {
  createBaseRoundState,
  resolveRoundPhaseTimings,
  transitionRoundState,
  type ServerGame,
  type ServerGameContext
} from "@open-party-lab/game-core";
import { lightTrailsManifest } from "../manifest.js";
import { isArena, lightTrailsCopy, resolveArena } from "../catalogText.js";
import type {
  LightTrailsCollisionReason,
  LightTrailsHostPatch,
  LightTrailsInput,
  LightTrailsPlayerState,
  LightTrailsState
} from "../protocol.js";
import { containsPoint, evaluateCollisions, type MovementProposal } from "./collision.js";
import { getCollapseBounds, lightTrailsConfig as config, reactorObstacles } from "./lightTrailsConfig.js";
import type { LightTrailsRuntimePlayerState as Driver, LightTrailsRuntimeState as Runtime } from "./lightTrailsState.js";
import { collectPickups, placePickups } from "./pickups.js";
import { createTrailGridMetrics, pointToCellId, sampleTrailCellIds } from "./trailGrid.js";

const phaseTimings = resolveRoundPhaseTimings(lightTrailsManifest.phaseDurations);
const grid = createTrailGridMetrics(config);
const fullCircle = Math.PI * 2;

function hash(value: string): number {
  let seed = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    seed = Math.imul(seed ^ value.charCodeAt(index), 16_777_619);
  }
  return seed >>> 0;
}

function scheduleGap(player: Driver, elapsed: number): void {
  player.rngState = (Math.imul(player.rngState, 1_664_525) + 1_013_904_223) >>> 0;
  player.nextGapAtMs = elapsed + 800 + player.rngState % 650;
}

function createInitialState(context: ServerGameContext): Runtime {
  const arena = resolveArena(context.roomSettings.arena);
  const occupiedCells: Runtime["occupiedCells"] = {};
  const players: Runtime["players"] = {};
  context.players.forEach((player, index) => {
    const orbit = -Math.PI / 2 + index / context.players.length * fullCircle;
    const x = config.arenaWidth / 2 + Math.cos(orbit) * 148;
    const y = config.arenaHeight / 2 + Math.sin(orbit) * 148;
    const cell = pointToCellId(x, y, grid);
    const driver: Driver = {
      playerId: player.id, name: player.name, color: player.color, x, y,
      angleRad: (orbit + Math.PI / 2) % fullCircle,
      alive: true, turnInput: 0, leftPressed: false, rightPressed: false, pendingTurn: 0,
      trailCellIds: cell === null ? [] : [cell], trailSegments: [],
      nextGapAtMs: 0, gapUntilMs: 0, powerUntilMs: 0,
      rngState: hash(`${context.roomCode}:${context.roundNumber}:${player.id}`)
    };
    scheduleGap(driver, 0);
    if (cell !== null) occupiedCells[cell] = player.id;
    players[player.id] = driver;
  });

  const state: Runtime = {
    ...createBaseRoundState("round_intro", context.now, {
      durationMs: phaseTimings.roundIntroMs,
      message: lightTrailsCopy[context.language].intro
    }),
    arena,
    arenaWidth: config.arenaWidth, arenaHeight: config.arenaHeight,
    cellSize: config.gridCellSize, trailThickness: config.trailThickness,
    obstacles: arena === "reactor" ? reactorObstacles : [],
    inset: 0, pickups: [], nextPickupAtMs: 0, pickupSequence: 0,
    tick: 0, remainingMs: config.maxPlayingMs, finishAt: null,
    alivePlayerIds: Object.keys(players), playerCount: context.players.length, isDraw: false,
    players, occupiedCells
  };
  const withFirstPickup = placePickups(state, 0);
  return placePickups({ ...withFirstPickup, nextPickupAtMs: 0 }, 0);
}

function releaseSteering(player: Driver): Driver {
  return { ...player, leftPressed: false, rightPressed: false, turnInput: 0, pendingTurn: 0 };
}

function updatePlayerInput(state: Runtime, input: LightTrailsInput, context: ServerGameContext): Runtime {
  const player = state.players[input.playerId];
  if (!player?.alive || (input.direction !== "left" && input.direction !== "right") ||
      typeof input.active !== "boolean") {
    return state;
  }
  const field = input.direction === "left" ? "leftPressed" : "rightPressed";
  if (player[field] === input.active) return state;

  const direction = input.direction === "left" ? -1 : 1;
  const next = { ...player, [field]: input.active };
  // A quick press and release can arrive between two ticks. Preserve one turn sample.
  if (input.active) next.pendingTurn = direction;
  next.turnInput = next.leftPressed && next.rightPressed
    ? (input.active ? direction : player.turnInput)
    : next.leftPressed ? -1 : next.rightPressed ? 1 : 0;

  return { ...state, players: { ...state.players, [input.playerId]: next }, updatedAt: context.now };
}

function prepareDrivers(state: Runtime, context: ServerGameContext, elapsed: number): Runtime["players"] {
  const connected = new Set(context.players.filter((player) => player.connected).map((player) => player.id));
  return Object.fromEntries(Object.entries(state.players).map(([id, previous]) => {
    if (!previous.alive) return [id, previous];
    const player = connected.has(id) ? { ...previous } : releaseSteering(previous);
    if (elapsed >= player.nextGapAtMs) {
      player.gapUntilMs = elapsed + config.gapLengthMs;
      scheduleGap(player, player.gapUntilMs);
    }
    return [id, player];
  }));
}

function moveDrivers(state: Runtime, seconds: number, context: ServerGameContext, elapsed: number): void {
  const drivers = Object.values(state.players).filter((player) => player.alive);
  const inset = state.inset;
  const bounds = { x: inset, y: inset, width: state.arenaWidth - 2 * inset, height: state.arenaHeight - 2 * inset };
  // Keep each step shorter than a grid cell, including at boosted speed.
  const substeps = Math.max(1, Math.ceil(seconds * config.moveSpeed * config.boostMultiplier / (grid.cellSize * 0.75)));
  const stepSeconds = seconds / substeps;
  for (let step = 0; step < substeps; step++) {
    const proposals: MovementProposal[] = [];
    const crashes: Record<string, LightTrailsCollisionReason> = {};
    for (const player of drivers) {
      if (!player.alive) continue;
      const turn = player.turnInput || player.pendingTurn;
      const angle = (player.angleRad + turn * config.turnSpeedRadPerSecond * stepSeconds + fullCircle) % fullCircle;
      const powered = elapsed < player.powerUntilMs;
      const distance = config.moveSpeed * stepSeconds * (powered && player.power === "boost" ? config.boostMultiplier : 1);
      const x = player.x + Math.cos(angle) * distance;
      const y = player.y + Math.sin(angle) * distance;
      if (!containsPoint(bounds, player.x, player.y) || !containsPoint(bounds, x, y)) {
        crashes[player.playerId] = inset > 0 ? "collapse" : "wall";
        continue;
      }
      if (state.obstacles.some((rect) => containsPoint(rect, x, y))) {
        crashes[player.playerId] = "reactor";
        continue;
      }
      const current = pointToCellId(player.x, player.y, grid);
      const phased = powered && player.power === "phase";
      const phaseJustEnded = step === 0 && player.power === "phase" && !powered;
      const path = sampleTrailCellIds(player.x, player.y, x, y, grid)
        .filter((cell) => cell !== current || phaseJustEnded);
      proposals.push({
        playerId: player.playerId, x: player.x, y: player.y,
        nextX: x, nextY: y, nextAngleRad: angle, pathCellIds: path, phased
      });
    }

    Object.assign(crashes, evaluateCollisions(proposals, state.occupiedCells).byPlayerId);
    for (const [id, reason] of Object.entries(crashes)) {
      const player = state.players[id];
      Object.assign(player, releaseSteering(player), { alive: false, eliminatedAt: context.now, collisionReason: reason });
    }

    for (const proposal of proposals) {
      const player = state.players[proposal.playerId];
      if (!player.alive) continue;
      if (!proposal.phased && elapsed >= player.gapUntilMs) {
        player.trailSegments.push({ x1: player.x, y1: player.y, x2: proposal.nextX, y2: proposal.nextY });
        for (const cell of proposal.pathCellIds) {
          if (state.occupiedCells[cell] !== undefined) continue;
          state.occupiedCells[cell] = player.playerId;
          player.trailCellIds.push(cell);
        }
      }
      player.x = proposal.nextX;
      player.y = proposal.nextY;
      player.angleRad = proposal.nextAngleRad;
    }
    if (state.playerCount > 1 && drivers.filter((player) => player.alive).length <= 1) break;
  }
  for (const driver of drivers) {
    driver.pendingTurn = 0;
    if (elapsed >= driver.powerUntilMs) driver.power = undefined;
  }
}

function simulateTick(previous: Runtime, deltaMs: number, context: ServerGameContext): Runtime {
  const remainingMs = Math.max(0, (previous.finishAt ?? context.now) - context.now);
  const elapsed = config.maxPlayingMs - remainingMs;
  let state: Runtime = {
    ...previous,
    ...(previous.arena === "collapse" ? getCollapseBounds(elapsed) : {}),
    tick: previous.tick + 1, updatedAt: context.now,
    players: prepareDrivers(previous, context, elapsed)
  };
  moveDrivers(state, Math.max(0, deltaMs) / 1000, context, elapsed);
  state = placePickups(collectPickups(state, elapsed), elapsed);

  const alive = Object.values(state.players).filter((player) => player.alive);
  const timedOut = remainingMs === 0;
  const solo = state.playerCount === 1;
  const winner = alive.length === 1 && (!solo || timedOut) ? alive[0] : undefined;
  const isDraw = alive.length === 0 || (timedOut && !winner);
  const words = lightTrailsCopy[context.language];
  return {
    ...state, remainingMs, alivePlayerIds: alive.map((player) => player.playerId),
    winnerPlayerId: winner?.playerId, winnerName: winner?.name, isDraw,
    message: winner ? (solo ? words.solo : words.won(winner.name))
      : alive.length === 0 ? (solo ? words.out : words.draw)
      : timedOut ? words.time : undefined
  };
}

function publicState(state: Runtime, playerId?: string, includeTrails = true): LightTrailsState {
  const { players, arena, arenaWidth, arenaHeight, cellSize, trailThickness, obstacles, inset, nextInset,
    pickups, playerCount, remainingMs, tick, alivePlayerIds, winnerPlayerId, winnerName, isDraw, finishAt } = state;
  const elapsed = config.maxPlayingMs - remainingMs;
  const drivers = playerId ? (players[playerId] ? [players[playerId]] : []) : Object.values(players);
  const publicPlayers: Record<string, LightTrailsPlayerState> = Object.fromEntries(drivers.map((p) => [
    p.playerId, {
      playerId: p.playerId, name: p.name, color: p.color, x: p.x, y: p.y, angleRad: p.angleRad,
      alive: p.alive, turnInput: p.turnInput,
      trailCellIds: [], trailLength: includeTrails ? p.trailSegments.length : 0,
      trailSegments: includeTrails ? p.trailSegments : [],
      gap: !p.alive ? undefined : elapsed < p.gapUntilMs ? "open"
        : elapsed >= p.nextGapAtMs - config.gapWarningMs ? "warning" : undefined,
      power: p.alive ? p.power : undefined, eliminatedAt: p.eliminatedAt, collisionReason: p.collisionReason
    }
  ]));
  return {
    arena, arenaWidth, arenaHeight, cellSize, trailThickness,
    obstacles: includeTrails ? obstacles : [], inset, nextInset, pickups: includeTrails ? pickups : [],
    playerCount, remainingMs, tick, alivePlayerIds, winnerPlayerId, winnerName, isDraw, finishAt, players: publicPlayers
  };
}

export const serverGame: ServerGame<Runtime, LightTrailsInput, LightTrailsState> = {
  manifest: lightTrailsManifest,
  createInitialState,
  handleHostAction(state, action) {
    if ((state && state.phase !== "finished") || !action || typeof action !== "object") return null;
    const { type, arena } = action as { type?: unknown; arena?: unknown };
    return type === "configure-lobby" && isArena(arena) ? { roomSettings: { arena } } : null;
  },
  startRound(state, context) {
    return transitionRoundState(
      { ...state, finishAt: context.now + config.maxPlayingMs, message: undefined },
      "playing", context.now, { startedAt: context.now }
    );
  },
  onPause(state) {
    return { ...state, players: Object.fromEntries(Object.entries(state.players).map(([id, player]) =>
      [id, releaseSteering(player)])) };
  },
  handleInput(state, input, context) {
    return state.phase === "playing" && (input.type === "light-trails:turn" || input.type === "turn")
      ? updatePlayerInput(state, input, context)
      : state;
  },
  tick(state, deltaMs, context) {
    return state.phase === "playing" ? simulateTick(state, deltaMs, context) : state;
  },
  isRoundFinished(state) {
    return state.phase === "locked" || state.isDraw || Boolean(state.winnerPlayerId) || state.playerCount === 0;
  },
  buildScore(state) {
    return state.winnerPlayerId ? [{ playerId: state.winnerPlayerId, delta: 1, reason: "Light Trails" }] : [];
  },
  toPublicState(state, context) {
    return {
      ...publicState(state),
      countdownMs: state.phase === "countdown" && state.phaseEndsAt !== null
        ? Math.max(0, state.phaseEndsAt - context.now) : undefined
    };
  },
  toControllerState(state) {
    return publicState(state, undefined, false);
  },
  toControllerStateForPlayer(state, _context, id) {
    return publicState(state, id, false);
  },
  buildHostPatch(state, previous) {
    if (!previous || state.tick <= previous.tick) return null;
    const { players, tick, pickups, inset, nextInset, remainingMs, alivePlayerIds, winnerPlayerId, winnerName, isDraw } = state;
    const patch: LightTrailsHostPatch = {
      tick, pickups, inset, nextInset, remainingMs, alivePlayerIds, winnerPlayerId, winnerName, isDraw,
      fromTick: previous.tick,
      players: Object.fromEntries(Object.values(players).map((player) => {
        // Runtime buffers are append-only. The sent count is captured by value with each snapshot.
        const trailStart = previous.players[player.playerId]?.trailLength ?? 0;
        const { trailSegments, trailCellIds: _cells, trailLength, ...driver } = player;
        return [player.playerId, { ...driver, trailStart, trailSegments: trailSegments.slice(trailStart, trailLength) }];
      }))
    };
    return patch;
  }
};
