import assert from "node:assert/strict";
import test from "node:test";
import { serverGame } from "../dist/server/index.js";
import { applyLightTrailsHostPatch } from "../dist/host/hostPatch.js";
import { createLightTrailsInput } from "../dist/controller/lightTrailsBindings.js";
import { getCollapseBounds, lightTrailsConfig as config } from "../dist/server/lightTrailsConfig.js";
import { pointToCellId, createTrailGridMetrics } from "../dist/server/trailGrid.js";

const grid = createTrailGridMetrics(config);
const player = (id) => ({ id, name: id, color: "#68d8ff", score: 0, isReady: true, connected: true });

function round(arena = "reactor", ids = ["ada"]) {
  const context = {
    roomCode: "TEST", roundNumber: 1, players: ids.map(player), now: 1000, deltaMs: 16,
    language: "de", theme: "light", selectedGame: serverGame.manifest, previousRound: null,
    roomSettings: { arena }
  };
  const state = serverGame.startRound(serverGame.createInitialState(context), context);
  return {
    state, context,
    tick: (previous, elapsed = 16) => serverGame.tick(previous, 16, { ...context, now: context.now + elapsed }),
    turn: (previous, direction, active) => serverGame.handleInput(previous, {
      ...createLightTrailsInput("ada", direction, active), sentAt: context.now
    }, context)
  };
}

test("an entire steering tap between ticks turns once; pause and disconnect clear held controls", () => {
  const game = round("classic");
  const pressed = game.turn(game.state, "right", true);
  const released = game.turn(pressed, "right", false);
  const first = game.tick(released);
  assert.ok(first.players.ada.angleRad > 0);
  assert.equal(game.tick(first, 32).players.ada.angleRad, first.players.ada.angleRad);
  assert.equal(game.tick(serverGame.onPause(pressed, game.context)).players.ada.angleRad, 0);
  game.context.players[0].connected = false;
  assert.equal(game.tick(pressed).players.ada.angleRad, 0);
});

test("switching thumbs keeps the latest held direction and release falls back to the other", () => {
  const game = round();
  const left = game.turn(game.state, "left", true);
  const both = game.turn(left, "right", true);
  assert.equal(both.players.ada.turnInput, 1);
  assert.equal(game.turn(both, "right", false).players.ada.turnInput, -1);
  assert.equal(game.turn(both, "right", true), both);
});

test("arena setup accepts the offered modes outside active play", () => {
  const game = round();
  assert.equal(serverGame.handleHostAction(game.state, { type: "configure-lobby", arena: "collapse" }, game.context), null);
  assert.equal(serverGame.handleHostAction(null, { type: "configure-lobby", arena: "unknown" }, game.context), null);
  assert.deepEqual(serverGame.handleHostAction(null, { type: "configure-lobby", arena: "collapse" }, game.context), {
    roomSettings: { arena: "collapse" }
  });
  assert.equal(game.state.obstacles.length, 2);
  assert.deepEqual(game.state.pickups.map(({ kind }) => kind), ["phase", "boost"]);
  assert.equal(round("classic").state.pickups.length, 0);
});

test("collapse warns for three seconds, then applies each solid boundary", () => {
  assert.deepEqual(getCollapseBounds(8999), { inset: 0, nextInset: undefined });
  assert.deepEqual(getCollapseBounds(9000), { inset: 0, nextInset: 40 });
  assert.deepEqual(getCollapseBounds(12000), { inset: 40, nextInset: undefined });
  assert.deepEqual(getCollapseBounds(19000), { inset: 40, nextInset: 80 });
  assert.deepEqual(getCollapseBounds(32000), { inset: 120, nextInset: undefined });
  const game = round("collapse");
  Object.assign(game.state.players.ada, { x: 45, y: 25, angleRad: Math.PI / 2 });
  assert.equal(game.tick(game.state, 11999).players.ada.alive, true);
  const shrunk = game.tick(game.state, 12000);
  assert.equal(shrunk.players.ada.collisionReason, "collapse");
  assert.equal(shrunk.nextInset, undefined);
});

test("phase crosses a trail without writing one, but cannot cross a wall or barrier", () => {
  const game = round("reactor");
  const driver = game.state.players.ada;
  Object.assign(driver, { x: 399, y: 228, power: "phase", powerUntilMs: 1000 });
  game.state.occupiedCells[pointToCellId(400, 228, grid)] = "other";
  const phased = game.tick(game.state);
  assert.ok(phased.players.ada.x > 400);
  assert.equal(phased.players.ada.trailSegments.length, 0);
  assert.equal(game.tick(phased, 1000).players.ada.collisionReason, "trail");

  const barrier = round("reactor");
  Object.assign(barrier.state.players.ada, { x: 171, y: 168, power: "phase", powerUntilMs: 1000 });
  assert.equal(barrier.tick(barrier.state).players.ada.collisionReason, "reactor");
  const wall = round("classic");
  Object.assign(wall.state.players.ada, { x: 959, power: "phase", powerUntilMs: 1000 });
  assert.equal(wall.tick(wall.state).players.ada.collisionReason, "wall");
});

test("boost changes travel distance and phase cannot prevent a head-on draw", () => {
  const boost = round("classic");
  const x = boost.state.players.ada.x;
  Object.assign(boost.state.players.ada, { power: "boost", powerUntilMs: 1000 });
  assert.ok(Math.abs(boost.tick(boost.state).players.ada.x - x - config.moveSpeed * 0.016 * config.boostMultiplier) < 0.001);
  const clash = round("reactor", ["ada", "ben"]);
  Object.assign(clash.state.players.ada, { x: 455, y: 240, power: "phase", powerUntilMs: 1000 });
  Object.assign(clash.state.players.ben, { x: 465, y: 240, angleRad: Math.PI });
  const crashed = clash.tick(clash.state);
  assert.equal(crashed.isDraw, true);
  assert.deepEqual(Object.values(crashed.players).map((driver) => driver.collisionReason), ["head_clash", "head_clash"]);
});

test("only new trail data crosses the host stream; reconnect snapshots merge overlap", () => {
  const game = round("classic");
  const previous = serverGame.toPublicState(game.state, game.context);
  const client = structuredClone(previous);
  const mid = game.tick(game.state);
  const delayedClient = structuredClone(serverGame.toPublicState(mid, game.context));
  const next = game.tick(mid, 32);
  const current = serverGame.toPublicState(next, game.context);
  assert.equal(previous.players.ada.trailLength, 0);
  assert.ok(previous.players.ada.trailSegments.length > 0);
  const patch = JSON.parse(JSON.stringify(serverGame.buildHostPatch(current, previous, game.context)));
  assert.equal(patch.players.ada.trailStart, 0);
  assert.equal(patch.players.ada.trailSegments.length, current.players.ada.trailLength);
  assert.deepEqual(applyLightTrailsHostPatch(client, patch).players.ada.trailSegments, current.players.ada.trailSegments);
  assert.deepEqual(applyLightTrailsHostPatch(delayedClient, patch).players.ada.trailSegments, current.players.ada.trailSegments);
  const nextPatch = serverGame.buildHostPatch(serverGame.toPublicState(game.tick(next, 48), game.context), current, game.context);
  assert.equal(nextPatch.players.ada.trailSegments.length, patch.players.ada.trailSegments.length / 2);
  assert.equal(applyLightTrailsHostPatch(delayedClient, nextPatch), null);
});

test("phone state includes its own driver and no geometry stream", () => {
  const game = round("reactor", ["ada", "ben"]);
  const state = game.tick(game.state);
  const mobile = serverGame.toControllerStateForPlayer(state, game.context, "ada");
  assert.equal(mobile.playerCount, 2);
  assert.deepEqual(Object.keys(mobile.players), ["ada"]);
  assert.deepEqual(mobile.players.ada.trailSegments, []);
  assert.deepEqual(mobile.pickups, []);
});
