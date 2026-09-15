# Beta 6 survival balance

Addresses player feedback that combat was too easy and power-ups too frequent.

- Fixed unlimited tutorial invulnerability. Training protection lasts eight seconds; unfinished guidance ends after 25 seconds. The tutorial can still be skipped immediately.
- Normal loot probability reduced from 9% to 3.5%, with six seconds between random drops. Elite bonuses and permanent/run luck are capped at 14% total. Bosses retain one guaranteed drop.
- Lucky Scavenger adds one percentage point per choice, capped at four; account luck adds 0.4 percentage points per rank. Neither can grow into guaranteed drops.
- Drafts arrive on every third wave, with at least 30 seconds of combat between them and at most one queued draft. Boss Rush retains between-boss choices. Missions award credits without an additional draft.
- Campaign/extraction waves last roughly 12 to 20 seconds rather than 8 to 11 seconds. Enemy spawning is faster, base health is 20% higher, health scales 14% per wave, and movement speed increases with later waves. Boss telegraph timing stays unchanged.
- Random armor drops grant 14 armor instead of 24; weapon mods add 4% damage instead of 8%; squad beacons recruit two instead of three.
- Overdrive lasts 4.5 seconds and recharges at 3.5 points per second, previously 5.5 seconds and 6 points per second.

Profile progression is preserved. Start a fresh Beta 6 run; older beta run checkpoints are version-specific. This is a first tuning pass based on player feedback, not a claim that difficulty is perfectly balanced for every skill level.

Regression coverage checks finite tutorial protection, loot caps and burst limits, draft spacing and enemy scaling, alongside existing combat/mode/recovery tests.
