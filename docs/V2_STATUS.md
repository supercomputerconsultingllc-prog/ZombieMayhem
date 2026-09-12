# Zombie Mayhem V2.0 Status

## Protected release lines

- `main`: existing production line; do not overwrite during V2.0 development.
- `release/v1.2-preserved`: immutable recovery branch for the current fully functional V1.2 game.
- `v2.0-development`: isolated V2.0 implementation and validation branch.
- `release/v2.0`: created only after all V2.0 release gates pass.

## Current version

`2.0.0-beta.2`

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
