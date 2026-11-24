import { arenaOptions, defaultArena, lightTrailsText } from "./catalogText.js";
import type { GameManifest } from "@open-party-lab/game-core";

export const lightTrailsManifest = {
  id: "light-trails",
  translations: lightTrailsText,
  displayName: "Light Trails",
  description: lightTrailsText.de.description,
  minPlayers: 1,
  maxPlayers: 8,
  hostView: "LightTrailsHostScene",
  controllerView: "light-trails",
  controllerLayout: "left_right_hold",
  supportsTeams: false,
  estimatedRoundDurationMs: 45_000,
  roundCompletionMode: "wait_for_ready",
  phaseDurations: {
    roundIntroMs: 1_500,
    countdownMs: 2_400,
    resultMs: 3_500,
    scoreboardMs: 4_000
  },
  lobbySetup: {
    fields: [{ id: "arena", kind: "select", label: "Arena", options: arenaOptions("de"), defaultValue: defaultArena }]
  },
  ownsScreens: ["round_intro", "result"],
  hostChrome: { hud: false, roomCode: false, joinOverlayWhenFinished: false },
  controllerChrome: { minimal: true, wide: true },
  visual: { accent: "#8772d8", icon: "bolt", eyebrow: "Arcade" },
  audio: { track: { profile: "chase", bpm: 144, rootMidi: 57, masterGain: 0.16 } },
  broadcast: { supportsHostPatches: true, controllerStateIntervalMs: 80, deferInputBroadcastToTick: true }
} as const satisfies GameManifest;

export const manifest = lightTrailsManifest;
