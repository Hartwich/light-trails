# Light Trails

Realtime trail-survival arena game for Open Party Lab with compact phone steering.

## Status

Alpha for 1–8 players. Steer with two hold buttons and survive for up to 45 seconds.
In multiplayer, the last survivor gets one point. If several drivers survive the
time limit, the round is a draw. In solo play, reaching the time limit earns a point.

## Arenas

- **Reactor** is the default. Dodge two solid barriers and collect phase or boost pickups.
- **Classic** has an open field and periodic trail gaps.
- **Collapse** has pickups and moves the boundary inward after 12, 22 and 32 seconds.
  A dashed line shows the next boundary three seconds before it moves.

Every arena has short breaks in the trails. An amber ring around a driver
announces their next gap. Cyan phase pickups let a driver cross trails without
leaving one for 1.3 seconds. Walls, barriers and other drivers still cause
crashes. Amber boost pickups raise speed by 30% for 1.8 seconds.

The host draws new trail segments from incremental updates and interpolates the
drivers between updates. Press and release events travel reliably to the server,
which remains authoritative for movement, pickups, collisions and scoring.

## Run Through Open Party Lab

This repo is not a standalone app. Run it through the Open Party Lab platform.

Recommended layout:

```text
Open-Party-Lab/
  local-games/
    light-trails/
```

From the Platform repo:

```bash
npm install
npm run games:sync-local
npm run dev:all
```

The Platform loads this game only when the repo exists locally and `npm run games:sync-local` links it. Missing optional games are skipped.

## GitHub Metadata

Description:

```text
Realtime trail-survival arena game for Open Party Lab with compact phone steering.
```

Suggested topics:

```text
open-party-lab party-game browser-game phaser typescript local-multiplayer arcade
```

## Package Entrypoints

- `@open-party-lab/game-light-trails/manifest`
- `@open-party-lab/game-light-trails/protocol`
- `@open-party-lab/game-light-trails/server`
- `@open-party-lab/game-light-trails/host`
- `@open-party-lab/game-light-trails/controller`

The Platform should import only these public entrypoints.

## Development Checks

```bash
npm install
npm run typecheck
npm test
npm run pack:dry-run
```

For visual checks, start Open Party Lab, add virtual controllers when needed, and capture host screenshots through a browser.

## License

Code is licensed under the Apache License 2.0. See [LICENSE](LICENSE).

Assets, generated media, word lists, prompts, and third-party references may need separate rights review before public store distribution.

The arena floor texture was generated for this game with OpenAI ImageGen.
