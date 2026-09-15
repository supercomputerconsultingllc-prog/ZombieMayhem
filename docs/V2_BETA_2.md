# Zombie Mayhem 2.0 Beta 2

## Delivery scope

Phases 1–3 are implemented on `v2.0-development`, playable at `/v2/index.html` when `docs` is served. No production URL is redirected. The preservation branch remains at `80b5127b3504dd72d291a7f8d9899ac763075734`. The development branch's V1 root receives only a Settings/Done navigation correction, with regression coverage.

### Simulation and architecture

- Pure fixed-step combat at 60 Hz, interpolated rendering and seeded gameplay randomness.
- Separate combat engine, mode director, renderer, audio, screens, progression and persistence modules. Modules remain native JavaScript, not a TypeScript or Phaser migration.
- Swept, nearest-first projectile hits with a spatial grid; correct splash death rewards, piercing hit histories and distinct chain targets.
- Bounded entity pools, crowd separation, armor break, stagger, status interactions and animated lane changes.
- Schema 4 saves with bounded allowlists, versions 2/3 migration, malformed import rejection and failure reporting. Offline saves are editable local data, not trusted competitive or paid-economy records.

### Presentation

- Authored bitmap character atlas and four environment panels, high-DPI 4:3 rendering, animated survivors/zombies, boss presentation, warnings, weather, shadows and pooled effects.
- Three synchronized recorded music stems and sixteen sound effects, adaptive mixing, stereo panning, voice limiting and pause-safe playback.
- Fixed-viewport mobile controls, dedicated loadout dialog, guided training, nested pause-safe menus, focus trapping, service record and post-run reports.
- Reduced motion, high contrast, independent shake, damage-number and gore controls. This is not a full accessibility certification.

### Gameplay

- Campaign: four chapters with three-wave boss gates and distinct environments.
- Horde: defend a base, clear finite wave quotas, draft sentries and repairs.
- Extraction: reach 600m, choose when to request evacuation and survive its five-second countdown. Defeat retains only a quarter of earned run credits.
- Boss Rush: four sequential named encounters, limited recovery and between-boss drafts.
- Three formations, four simultaneously recruitable specialists and sixteen branching weapon evolutions across eight weapons.
- Three-choice drafts, defensive/economy/status/cursed perks, environmental wrecks/barrels/fire/flooding, boss telegraphs and phase-specific patterns.

## Reproducible verification

```sh
npm ci
npm run validate
npm run test:unit
npm run test:soak
npm audit --audit-level=high
npx playwright install --with-deps chromium firefox webkit
CROSS_BROWSER=1 npm run test:browser
```

The unit suite covers 57 cases including deterministic results at 30/60/144 render Hz, all weapons/evolutions, specialists, formations, missions, mode rules, collisions, pools and save migration. The accelerated 60-minute simulation soak checks finite state and bounded allocations; it is not a 60-minute browser/GPU benchmark and uses replenished defenses to keep its stress harness alive.

The 28-test default browser suite covers V1 and V2 on desktop Chromium and emulated mobile Chromium. CI additionally runs desktop Firefox and emulated iPhone WebKit, with reports/traces on failures. Browser screenshots are QA captures, not approved pixel-regression baselines. Mobile emulation does not replace physical-device testing.

## Release boundaries

Before production promotion: verify the CI result on the published commit, exercise a separate staging deployment, perform physical-device/audio/performance and accessibility QA, approve visual baselines, and test rollback. The beta does not implement cloud accounts, server-authoritative currency, payment migration, telemetry infrastructure or Phase 4 commercial readiness. Those require separate backend configuration and production approval. Do not replace or redirect V1 URLs as part of this beta publication.

The original roadmap also includes optional follow-on breadth such as eight campaign biomes, eight specialists, custom/daily challenges, controller/rebinding/localization, and unique full animation sets for every enemy archetype. This beta implements the focused four-biome, four-specialist Phase 1–3 slice, not every item in that enterprise assessment.
