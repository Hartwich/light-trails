import type { GameManifest } from "@open-party-lab/game-core";

export const lightTrailsManifest = {
  id: "light-trails",
  displayName: "Light Trails",
  description: "Lenke deine Spur durch die Arena und ueberlebe am laengsten.",
  minPlayers: 1,
  maxPlayers: 8,
  hostView: "LightTrailsHostScene",
  controllerView: "light-trails",
  controllerLayout: "left_right_hold",
  supportsTeams: false,
  estimatedRoundDurationMs: 40_000,
  roundCompletionMode: "wait_for_ready",
  phaseDurations: {
    roundIntroMs: 1_500,
    countdownMs: 2_400,
    resultMs: 3_500,
    scoreboardMs: 4_000
  }
} as const satisfies GameManifest;

export const manifest = lightTrailsManifest;
