# Zombie Mayhem V2.0 Status

## Protected release lines

- `main`: existing production line; do not overwrite during V2.0 development.
- `release/v1.2-preserved`: immutable recovery branch for the current fully functional V1.2 game.
- `v2.0-development`: isolated V2.0 implementation and validation branch.
- `release/v2.0`: created only after all V2.0 release gates pass.

## Current version

`2.0.0-beta.4`

Beta 4 replaces primitive hazard blocks and labeled pickups with a transparent prop atlas. Every survivor up to the 40-person cap has a visible formation slot; the growing formation stays inside mobile view bounds. Firing rotates through the squad without multiplying weapon damage. Equipped gun models, muzzle flashes and eight projectile families now distinguish rifle tracers, shotgun pellets, sniper rails, minigun streaks, flames, Tesla bolts, ice shards and grenades. Explosions show expanding blast rings. Active projectiles retain the weapon that fired them. New automated tests exercise all eight render paths, authored props and a full squad on desktop and phone viewports.

Beta 3 replaces lane switching with continuous two-dimensional movement, relative touch dragging and a thumb pad. Phones use a full-height portrait view with matching simulation bounds; enemy spawns, aim assistance, pickups, contact damage and circular boss warnings use the squad's actual position. Mobile rendering has a 1.5x DPR cap, lower-quality 30 FPS rendering and 4 FPS paused rendering, while simulation remains fixed-step. Physical-device frame-rate and battery certification are still pending.

Phases 1–3 now have an integrated playable beta. This is not commercial/production certification. See [Beta 2 delivery notes](V2_BETA_2.md) for implementation, validation and remaining release gates.

## V2.0 release gates

V2.0 is not ready until all of the following are complete:

1. Structural and JavaScript validation passes.
2. Desktop and mobile Playwright smoke tests pass.
3. Existing V1.2 gameplay parity is verified before feature changes.
4. Save/load and offline fallback pass migration testing.
5. Audio pause, resume, mute, and autoplay behavior pass.
6. New enemy archetypes, weapons, mission modes, progression, UI, graphics, and accessibility work are complete.
7. Long-run performance and large-army stress tests pass.
8. A separate V2.0 test deployment is verified without changing V1.2.
9. A release candidate is cut from `release/v2.0`.
10. The final V2.0 build receives explicit approval before replacing or redirecting any production URL.

## Non-negotiable rollback rule

The V1.2 preservation branch must remain independently recoverable throughout V2.0 development and after V2.0 release.
