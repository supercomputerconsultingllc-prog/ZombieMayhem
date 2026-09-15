# Zombie Mayhem 10 Upgrade Plan

This branch upgrades Zombie Mayhem without changing the production `main` branch until validation and review are complete.

## Non-negotiable gates

1. Preserve the current playable v1.2 baseline.
2. Keep local saves compatible or provide an explicit migration.
3. Keep offline play functional when Supabase is unavailable.
4. Pass `npm run validate` after every implementation batch.
5. Do not merge broken, truncated, or partially wired UI.
6. Maintain acceptable late-game performance with large squads and crowds.
7. Verify keyboard, mouse, touch, pause, restart, settings, shop, missions, rewards, and account flows.

## Implementation order

### Stabilization

- Automated structural and JavaScript validation.
- Browser smoke tests.
- Save/load and offline fallback tests.
- UI action inventory and regression tests.
- Audio lifecycle audit.
- Runtime and performance instrumentation.

### Architecture

- Extract configuration and immutable content definitions.
- Isolate persistence and account synchronization.
- Isolate audio lifecycle management.
- Separate rendering, enemies, squad, missions, progression, and UI incrementally.
- Preserve a compatibility bootstrap while modules are extracted.

### Gameplay expansion

- Distinct enemy archetypes and bosses.
- Weapon families, status effects, and meaningful builds.
- Objective-based mission variants.
- Skill trees, mastery, equipment, achievements, and challenges.

### Presentation

- Improved visual hierarchy and responsive HUD.
- Environment depth, lighting, weather, particles, decals, and impact feedback.
- Controller and accessibility support.
- Dynamic audio and reliable pause/resume behavior.

### Release

- Long-run stress tests.
- Save migration tests.
- Mobile and desktop acceptance pass.
- Versioned release notes and rollback checkpoint.
