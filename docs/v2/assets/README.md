# Beta 2 art and audio

## Art direction and provenance

Original AI-generated raster art was created for this project, not downloaded from stock libraries or other games. Retain this provenance if assets are replaced or redistributed. Generation alone is not a legal trademark or exclusivity clearance.

Style: readable, illustrated military survival horror. Muted charcoal/olive environments support warm hostile silhouettes, teal survivor indicators and amber/red danger telegraphs. Keep three traversable lanes unobstructed by decorative scenery. Foreground combat feedback must remain legible at mobile scale; do not encode a dangerous attack through color alone.

- `characters.png`: transparent 4-column, 6-row atlas. Columns are four animation frames. Rows are survivor, walker, runner, armored zombie, spitter and boss. Additional configured enemy types share these families with overlays/status marks rather than having ten independent animation productions.
- `environments.png`: 2-by-2 environment atlas, ordered quarantine highway, ruined suburbs, burning city and flooded industrial zone. Each panel is 4:3. The renderer alternates vertical orientation when scrolling so tile boundaries share the same edge.

Avoid placing text in raster art. Render objectives, attack lanes, names, weak points and accessibility hints in code. New assets should preserve these atlas contracts or update renderer mappings and viewport/browser tests together.

## Original recorded audio

`audio/` contains three synchronized 16-second MP3 music stems (`bed`, `combat`, `boss`) and sixteen weapon/UI/combat effects. They are original offline synthesized compositions, with no fetched samples or third-party recordings. The runtime decodes these files instead of generating oscillator tones during combat. These are a beta sound design pass, not live musician recordings or a full voice/dialogue production.

Rebuild with `python3 tools/render-v2-audio.py` from the repository root (Python, NumPy and ffmpeg required). The generator uses a fixed seed. MP3 bytes may differ between encoder versions. Normalize replacements consistently, keep stem durations aligned and verify mute, pause/resume and autoplay behavior before release.

## Asset QA

Check atlas transparency, frame edges, all four biomes, reduced-motion rendering, safe-lane warnings and dark-scene readability. Keep the initial package bounded; the current two PNG atlases and nineteen MP3 files total approximately 6 MB. CI loads the real assets and captures desktop/mobile gameplay for review.
