import type { ControllerLayoutKey, SupportedLanguage } from "@open-party-lab/game-core";
import { lightTrailsCopy } from "../catalogText.js";
import { lightTrailsManifest } from "../manifest.js";
import type { LightTrailsState } from "../protocol.js";
import { createLightTrailsInput } from "./lightTrailsBindings.js";

interface ControllerContext {
  state: {
    connected: boolean;
    preferredLanguage?: SupportedLanguage;
    room?: {
      language?: SupportedLanguage;
      players?: Array<{ id: string; isReady?: boolean }>;
      pausedBy?: unknown;
    } | null;
    player?: { id: string; color?: string; isReady?: boolean } | null;
    game?: { phase?: string; roundNumber?: number; state?: unknown } | null;
  };
  onInput(input: unknown): void;
  onSetReady?: (isReady: boolean) => void;
}

export function buildLightTrailsControllerModel(context: ControllerContext) {
  const { state } = context;
  const language = state.room?.language ?? state.preferredLanguage ?? "de";
  const words = lightTrailsCopy[language];
  const game = (state.game?.state ?? null) as LightTrailsState | null;
  const playerId = state.player?.id ?? "";
  const driver = game?.players[playerId];
  const phase = state.game?.phase;
  const finished = phase === "finished";
  const playing = phase === "playing";
  const won = playerId !== "" && game?.winnerPlayerId === playerId;
  const out = driver?.alive === false;
  const status = won ? "won" : out ? "out" : finished && game?.isDraw ? "draw" : playing ? "playing" : "waiting";
  const statusLabel = { won: words.victory, out: words.out, draw: words.draw, playing: words.alive, waiting: words.waiting }[status];
  const helperText = driver?.collisionReason ? words.crash[driver.collisionReason]
    : playing ? (driver?.power ? words[driver.power] : undefined) : finished ? undefined : words.steer;
  const players = state.room?.players ?? [];
  const readyCount = players.filter((player) => player.isReady).length;
  const playerCount = players.length;
  const currentPlayerReady = Boolean(players.find((player) => player.id === playerId)?.isReady ?? state.player?.isReady);

  return {
    kind: "left_right_hold" as const,
    title: lightTrailsManifest.translations[language].displayName,
    helperText,
    disabled: !state.connected || Boolean(state.room?.pausedBy) || !playing || !driver?.alive,
    accentColor: state.player?.color ?? driver?.color,
    statusLabel,
    statusKey: `${state.game?.roundNumber ?? 0}:${status}`,
    leftLabel: words.left,
    rightLabel: words.right,
    ready: finished && context.onSetReady ? {
      currentPlayerReady,
      readyCount,
      playerCount,
      label: words.next,
      description: words.ready(`${readyCount}/${playerCount}`),
      language,
      onToggleReady: () => context.onSetReady?.(!currentPlayerReady)
    } : undefined,
    onLeftChange: (active: boolean) => context.onInput(createLightTrailsInput(playerId, "left", active)),
    onRightChange: (active: boolean) => context.onInput(createLightTrailsInput(playerId, "right", active))
  };
}

export const controllerGame = {
  id: lightTrailsManifest.id,
  layoutKey: "left_right_hold" as ControllerLayoutKey,
  buildLayout: buildLightTrailsControllerModel
} as const;
