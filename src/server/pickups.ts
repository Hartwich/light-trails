import type { LightTrailsPickup } from "../protocol.js";
import { containsPoint } from "./collision.js";
import { lightTrailsConfig as config } from "./lightTrailsConfig.js";
import type { LightTrailsRuntimePlayerState, LightTrailsRuntimeState } from "./lightTrailsState.js";
import { createTrailGridMetrics, pointToCellId } from "./trailGrid.js";

const grid = createTrailGridMetrics(config);
const sites = [
  { x: 396, y: 190 }, { x: 564, y: 350 },
  { x: 564, y: 190 }, { x: 396, y: 350 },
  { x: 480, y: 270 }, { x: 290, y: 270 },
  { x: 670, y: 270 }, { x: 480, y: 384 }, { x: 480, y: 156 },
  { x: 128, y: 270 }, { x: 832, y: 270 }
];
const maxPickups = 2;
const pickupRadiusSquared = config.pickupRadius ** 2;

function closeTo(a: { x: number; y: number }, b: { x: number; y: number }, distanceSquared: number): boolean {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= distanceSquared;
}

function siteIsFree(
  state: LightTrailsRuntimeState,
  site: { x: number; y: number },
  drivers: LightTrailsRuntimePlayerState[]
): boolean {
  const clearance = 24;
  const inset = state.nextInset ?? state.inset;
  if (site.x < inset + clearance || site.x > state.arenaWidth - inset - clearance ||
      site.y < inset + clearance || site.y > state.arenaHeight - inset - clearance ||
      state.pickups.some((pickup) => closeTo(pickup, site, 56 ** 2)) ||
      drivers.some((driver) => closeTo(driver, site, 44 ** 2)) ||
      state.obstacles.some((rect) => containsPoint({
        x: rect.x - clearance, y: rect.y - clearance,
        width: rect.width + clearance * 2, height: rect.height + clearance * 2
      }, site.x, site.y))) {
    return false;
  }

  for (let y = site.y - clearance; y < site.y + clearance; y += grid.cellSize) {
    for (let x = site.x - clearance; x < site.x + clearance; x += grid.cellSize) {
      const id = pointToCellId(x, y, grid);
      if (id !== null && state.occupiedCells[id] !== undefined) {
        return false;
      }
    }
  }
  return true;
}

export function placePickups(state: LightTrailsRuntimeState, elapsed: number): LightTrailsRuntimeState {
  if (state.arena === "classic" || elapsed < state.nextPickupAtMs || state.pickups.length >= maxPickups) {
    return state;
  }
  const drivers = Object.values(state.players).filter((driver) => driver.alive);
  const firstSite = Math.floor(state.pickupSequence * sites.length / 3) % sites.length;
  for (let offset = 0; offset < sites.length; offset++) {
    const site = sites[(firstSite + offset) % sites.length];
    if (siteIsFree(state, site, drivers)) {
      const pickup: LightTrailsPickup = {
        ...site,
        id: state.pickupSequence,
        kind: state.pickupSequence % 2 === 0 ? "phase" : "boost"
      };
      return {
        ...state,
        pickups: [...state.pickups, pickup],
        pickupSequence: state.pickupSequence + 1,
        nextPickupAtMs: elapsed + config.pickupIntervalMs
      };
    }
  }
  return { ...state, nextPickupAtMs: elapsed + 500 };
}

export function collectPickups(state: LightTrailsRuntimeState, elapsed: number): LightTrailsRuntimeState {
  const players = state.players;
  const pickups = state.pickups.filter((pickup) => {
    if (pickup.x < state.inset + config.pickupRadius || pickup.x > state.arenaWidth - state.inset - config.pickupRadius ||
        pickup.y < state.inset + config.pickupRadius || pickup.y > state.arenaHeight - state.inset - config.pickupRadius) {
      return false;
    }
    let collector: LightTrailsRuntimePlayerState | undefined;
    let distance = pickupRadiusSquared;
    for (const driver of Object.values(players)) {
      if (!driver.alive || driver.power) continue;
      const candidateDistance = (driver.x - pickup.x) ** 2 + (driver.y - pickup.y) ** 2;
      if (candidateDistance < distance ||
          (candidateDistance === distance && (!collector || driver.playerId < collector.playerId))) {
        collector = driver;
        distance = candidateDistance;
      }
    }
    if (!collector) return true;
    players[collector.playerId] = {
      ...collector,
      power: pickup.kind,
      powerUntilMs: elapsed + (pickup.kind === "phase" ? config.phaseDurationMs : config.boostDurationMs)
    };
    return false;
  });
  return pickups.length === state.pickups.length ? state : { ...state, pickups };
}
