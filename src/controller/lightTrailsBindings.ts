import type { LightTrailsInput, LightTrailsTurnDirection } from "../protocol.js";

export function createLightTrailsInput(
  playerId: string,
  direction: LightTrailsTurnDirection,
  active: boolean
): LightTrailsInput {
  return {
    type: "light-trails:turn",
    playerId,
    direction,
    active,
    sentAt: Date.now()
  };
}
