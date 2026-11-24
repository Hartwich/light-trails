import type { LightTrailsHostPatch, LightTrailsPlayerState, LightTrailsState } from "../protocol.js";

export function applyLightTrailsHostPatch(current: unknown, update: unknown): LightTrailsState | null {
  const state = current as LightTrailsState | null;
  const patch = update as LightTrailsHostPatch | null;
  if (!state || !patch || patch.tick <= patch.fromTick || state.tick < patch.fromTick || state.tick >= patch.tick) {
    return null;
  }

  const deltas = Object.entries(patch.players);
  for (const [id, delta] of deltas) {
    // A reconnect snapshot can already contain some of the segments in the next patch.
    const count = state.players[id]?.trailSegments.length ?? 0;
    if (count < delta.trailStart || count > delta.trailStart + delta.trailSegments.length) return null;
  }

  const players: LightTrailsState["players"] = {};
  for (const [id, delta] of deltas) {
    const { trailStart, trailSegments: appended, ...driver } = delta;
    const trailSegments = state.players[id]?.trailSegments ?? [];
    const offset = trailSegments.length - trailStart;
    for (let index = offset; index < appended.length; index++) trailSegments.push(appended[index]);
    const player: LightTrailsPlayerState = {
      ...driver, trailCellIds: [], trailSegments, trailLength: trailSegments.length
    };
    players[id] = player;
  }
  return {
    ...state, tick: patch.tick, pickups: patch.pickups, inset: patch.inset, nextInset: patch.nextInset,
    remainingMs: patch.remainingMs, alivePlayerIds: patch.alivePlayerIds,
    winnerPlayerId: patch.winnerPlayerId, winnerName: patch.winnerName, isDraw: patch.isDraw, players
  };
}
