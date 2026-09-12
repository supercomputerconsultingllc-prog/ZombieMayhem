export const VERSION = '2.0.0-beta.2';
export const SAVE_VERSION = 4;
export const SAVE_KEY = 'zombieMayhemV2Profile';
export const SETTINGS_KEY = 'zombieMayhemV2Settings';
export const WIDTH = 960;
export const HEIGHT = 720;
export const LANES = [270, 480, 690];

export const BIOMES = [
  { id: 'highway', name: 'Quarantine Highway', sky: '#071812', ground: '#17251f', road: '#242b29', accent: '#64d98b', hazard: 'wrecks' },
  { id: 'suburb', name: 'Deadlight Suburbs', sky: '#161426', ground: '#28233a', road: '#30313b', accent: '#ffb86c', hazard: 'barricades' },
  { id: 'downtown', name: 'Burning Downtown', sky: '#240d0b', ground: '#3a1915', road: '#302522', accent: '#ff684d', hazard: 'fire' },
  { id: 'industrial', name: 'Flooded Industrial Zone', sky: '#071b24', ground: '#12313a', road: '#23343a', accent: '#53c5ff', hazard: 'flood' }
];

export const FORMATIONS = {
  wedge: { name: 'Assault Wedge', damage: 1.12, armor: .9, fireRate: 1, spread: 1, detail: '+12% damage, -10% protection' },
  box: { name: 'Defensive Box', damage: .92, armor: 1.3, fireRate: .92, spread: .85, detail: '+30% protection, slower fire' },
  wide: { name: 'Wide Screen', damage: 1, armor: .94, fireRate: 1.08, spread: 1.35, detail: 'Faster fire and wider coverage' }
};

export const SPECIALISTS = {
  medic: { name: 'Field Medic', detail: 'Restores one survivor each wave', color: '#7bf1a8' },
  gunner: { name: 'Heavy Gunner', detail: '+18% sustained weapon damage', color: '#f6d365' },
  engineer: { name: 'Combat Engineer', detail: '+35 starting armor and larger blasts', color: '#53c5ff' },
  sniper: { name: 'Recon Sniper', detail: '+12% critical chance', color: '#c4b5fd' }
};

export const RUN_UPGRADES = [
  { id: 'hollowpoints', name: 'Hollow Points', detail: '+18% weapon damage', tag: 'Offense' },
  { id: 'rapidcycle', name: 'Rapid Cycle', detail: '+14% fire rate', tag: 'Offense' },
  { id: 'plates', name: 'Ceramic Plates', detail: '+45 armor', tag: 'Defense' },
  { id: 'reinforcements', name: 'Reinforcements', detail: '+3 survivors', tag: 'Squad' },
  { id: 'scavenger', name: 'Lucky Scavenger', detail: '+15% loot chance', tag: 'Economy' },
  { id: 'incendiary', name: 'Incendiary Rounds', detail: 'All bullets ignite targets', tag: 'Status' },
  { id: 'cryo', name: 'Cryo Payload', detail: 'Critical hits slow targets', tag: 'Status' },
  { id: 'glasscannon', name: 'Last Magazine', detail: '+40% damage, incoming damage +25%', tag: 'Cursed' }
];

export const MODES = {
  campaign: { label: 'Campaign', speed: 1, spawn: 1, bossEvery: 5, reward: 1 },
  horde: { label: 'Endless Horde', speed: 1.08, spawn: 1.28, bossEvery: 4, reward: 1.25 },
  extraction: { label: 'Extraction', speed: 1.12, spawn: 1.08, bossEvery: 6, reward: 1.2, targetDistance: 1800 },
  bossrush: { label: 'Boss Rush', speed: 1, spawn: .72, bossEvery: 2, reward: 1.5 }
};

export const WEAPONS = {
  rifle: { name: 'Rifle', subtitle: 'Reliable automatic', unlock: 1, cooldown: 155, damage: 18, shots: 1, spread: 0, speed: 780, color: '#f8fafc', crit: .12, pierce: 0, knockback: 16 },
  shotgun: { name: 'Shotgun', subtitle: 'Close-range spread', unlock: 2, cooldown: 520, damage: 14, shots: 6, spread: .24, speed: 690, color: '#f6d365', crit: .08, pierce: 0, knockback: 34 },
  sniper: { name: 'Sniper', subtitle: 'Critical penetration', unlock: 3, cooldown: 760, damage: 92, shots: 1, spread: 0, speed: 1100, color: '#8be9fd', crit: .38, pierce: 3, knockback: 52 },
  minigun: { name: 'Minigun', subtitle: 'Sustained suppression', unlock: 4, cooldown: 72, damage: 9, shots: 1, spread: .06, speed: 850, color: '#ffb86c', crit: .06, pierce: 0, knockback: 10, heat: true },
  flame: { name: 'Flamethrower', subtitle: 'Burning cone', unlock: 5, cooldown: 90, damage: 6, shots: 3, spread: .18, speed: 420, color: '#ff6b35', crit: 0, pierce: 1, knockback: 5, status: 'burn' },
  tesla: { name: 'Tesla', subtitle: 'Chain lightning', unlock: 6, cooldown: 440, damage: 38, shots: 1, spread: 0, speed: 900, color: '#9d7bff', crit: .16, pierce: 0, knockback: 18, status: 'shock', chain: 3 },
  freeze: { name: 'Cryo', subtitle: 'Freeze and shatter', unlock: 7, cooldown: 330, damage: 24, shots: 1, spread: .02, speed: 720, color: '#53c5ff', crit: .1, pierce: 1, knockback: 12, status: 'freeze' },
  grenade: { name: 'Grenade', subtitle: 'Explosive splash', unlock: 8, cooldown: 920, damage: 72, shots: 1, spread: 0, speed: 520, color: '#b7f34a', crit: .05, pierce: 0, knockback: 70, explosive: 115 }
};

export const ENEMIES = {
  walker: { name: 'Walker', hp: 42, speed: 68, damage: 1, reward: 8, size: 28, color: '#7ca982', weight: 34 },
  runner: { name: 'Runner', hp: 30, speed: 128, damage: 1, reward: 10, size: 24, color: '#d7a86e', weight: 19 },
  crawler: { name: 'Crawler', hp: 24, speed: 92, damage: 1, reward: 9, size: 20, color: '#9f7aea', weight: 12, weave: true },
  armored: { name: 'Armored', hp: 105, armor: 26, speed: 54, damage: 2, reward: 22, size: 32, color: '#718096', weight: 10 },
  spitter: { name: 'Spitter', hp: 56, speed: 52, damage: 1, reward: 18, size: 28, color: '#68d391', weight: 8, ranged: true },
  exploder: { name: 'Exploder', hp: 44, speed: 76, damage: 3, reward: 20, size: 31, color: '#f56565', weight: 7, explode: true },
  screamer: { name: 'Screamer', hp: 68, speed: 62, damage: 1, reward: 24, size: 30, color: '#ed64a6', weight: 5, summon: true },
  leader: { name: 'Pack Leader', hp: 125, speed: 82, damage: 2, reward: 35, size: 35, color: '#f6ad55', weight: 4, aura: true },
  tank: { name: 'Tank', hp: 280, armor: 55, speed: 37, damage: 4, reward: 55, size: 46, color: '#4a5568', weight: 3 },
  boss: { name: 'Mutant Overlord', hp: 1550, armor: 75, speed: 31, damage: 6, reward: 420, size: 76, color: '#d53f8c', weight: 0, boss: true }
};

// The game builds each runtime enemy with `...base` for behavioral traits.
// Keep numerical base stats readable but non-enumerable so that spread cannot
// overwrite the wave-, elite-, daily-, and mode-scaled runtime values.
const COMPUTED_ENEMY_FIELDS = ['name', 'hp', 'armor', 'speed', 'damage', 'reward', 'size', 'color', 'weight'];
for (const enemy of Object.values(ENEMIES)) {
  for (const field of COMPUTED_ENEMY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(enemy, field)) continue;
    Object.defineProperty(enemy, field, {
      value: enemy[field],
      writable: false,
      configurable: false,
      enumerable: false
    });
  }
  Object.freeze(enemy);
}
Object.freeze(ENEMIES);

export const MISSION_TEMPLATES = [
  { type: 'kills', title: 'Clear the road', text: 'Defeat {target} infected.', target: 20, reward: 100 },
  { type: 'distance', title: 'Push forward', text: 'Travel {target} meters.', target: 550, reward: 120 },
  { type: 'elite', title: 'Mutant hunt', text: 'Eliminate {target} elite infected.', target: 5, reward: 160 },
  { type: 'credits', title: 'Supply sweep', text: 'Collect {target} credits.', target: 180, reward: 130 },
  { type: 'survive', title: 'Hold the line', text: 'Survive {target} seconds.', target: 75, reward: 180 },
  { type: 'boss', title: 'Decapitation strike', text: 'Defeat {target} boss.', target: 1, reward: 300 }
];

export const SKILL_TREES = {
  commander: { label: 'Commander', nodes: [
    { id: 'command_squad', name: 'Bigger Formation', detail: '+2 starting squad', max: 5 },
    { id: 'command_focus', name: 'Focus Fire', detail: '+4% damage', max: 5 },
    { id: 'command_revive', name: 'Last Stand', detail: '+1 emergency revive', max: 2 }
  ]},
  heavy: { label: 'Heavy', nodes: [
    { id: 'heavy_damage', name: 'Ballistics', detail: '+6% weapon damage', max: 5 },
    { id: 'heavy_crit', name: 'Kill Zone', detail: '+3% critical chance', max: 5 },
    { id: 'heavy_heat', name: 'Cooling Jacket', detail: '-8% minigun heat', max: 4 }
  ]},
  medic: { label: 'Medic', nodes: [
    { id: 'medic_armor', name: 'Field Armor', detail: '+12 starting armor', max: 5 },
    { id: 'medic_recovery', name: 'Triage', detail: 'Recover squad each wave', max: 4 },
    { id: 'medic_resist', name: 'Resistance', detail: '-5% incoming damage', max: 5 }
  ]},
  scavenger: { label: 'Scavenger', nodes: [
    { id: 'scavenger_credit', name: 'Deep Pockets', detail: '+8% credits', max: 5 },
    { id: 'scavenger_luck', name: 'Lucky Find', detail: '+8% loot chance', max: 5 },
    { id: 'scavenger_mastery', name: 'Fast Learner', detail: '+10% mastery XP', max: 4 }
  ]},
  engineer: { label: 'Engineer', nodes: [
    { id: 'engineer_overdrive', name: 'Overdrive Core', detail: '+12% ability duration', max: 5 },
    { id: 'engineer_explosive', name: 'Demolitions', detail: '+8% splash radius', max: 5 },
    { id: 'engineer_freeze', name: 'Cryogenic Mix', detail: '+10% freeze duration', max: 4 }
  ]}
};

export const LOOT = [
  { rarity: 'common', name: 'Ammo Cache', weight: 48, color: '#cbd5e1', apply: { credits: 35 } },
  { rarity: 'uncommon', name: 'Armor Plates', weight: 28, color: '#4ade80', apply: { armor: 24 } },
  { rarity: 'rare', name: 'Weapon Mod', weight: 15, color: '#53c5ff', apply: { damage: .08 } },
  { rarity: 'epic', name: 'Squad Beacon', weight: 7, color: '#c084fc', apply: { squad: 3 } },
  { rarity: 'legendary', name: 'Overdrive Cell', weight: 2, color: '#f6d365', apply: { ability: 25 } }
];

export const DEFAULT_PROFILE = {
  accountLevel: 1, accountXp: 0, skillPoints: 0, bestDistance: 0, lifetimeKills: 0,
  lifetimeCredits: 0, unlockedWeapons: ['rifle'], mastery: {}, skills: {}, achievements: {}, dailyBest: 0,
  tutorialComplete: false, chaptersCompleted: 0, history: []
};

export const DEFAULT_SETTINGS = {
  masterVolume: 75, musicVolume: 28, effectsVolume: 65, quality: 'auto',
  reducedMotion: false, highContrast: false, damageFlashes: true, screenShake: true, damageNumbers: true, gore: false
};

export const ACHIEVEMENTS = {
  first_blood: 'First Blood', exterminator: 'Exterminator', road_warrior: 'Road Warrior',
  boss_breaker: 'Boss Breaker', rich_run: 'Supply Baron', campaign_clear: 'Dawn Patrol'
};

export const CHAPTERS = [
  { name: 'The Last Convoy', boss: 'The Roadblock', attack: 'slam', story: 'Recover the convoy route and break the quarantine line.' },
  { name: 'Deadlight Rescue', boss: 'The Howler', attack: 'summon', story: 'Move the survivors through the suburbs before the pack closes in.' },
  { name: 'Ashes of the City', boss: 'The Furnace', attack: 'crossfire', story: 'Cross the burning district. Keep clear of the fuel drums.' },
  { name: 'Cold Harbor', boss: 'The Leviathan', attack: 'barrage', story: 'Secure the industrial evacuation corridor. Bring everyone home.' }
];

// Each evolution changes weapon behavior and is exclusive for that weapon this run.
export const EVOLUTIONS = {
  rifle: [
    { id: 'burst', name: 'Trident Burst', detail: 'Three rounds per volley; slower cycling.', mods: { shots: 3, spread: .045, cooldown: 290, damage: 22 } },
    { id: 'sabot', name: 'Sabot Rifle', detail: 'Pierces two enemies and ignores most armor.', mods: { pierce: 2, armorPierce: .8, damage: 25 } }
  ],
  shotgun: [
    { id: 'dragon', name: 'Dragon Breath', detail: 'Incendiary pellets ignite a wide cone.', mods: { status: 'burn', shots: 8 } },
    { id: 'slug', name: 'Slug Cannon', detail: 'One heavy penetrating projectile.', mods: { shots: 1, damage: 115, pierce: 3, speed: 1100, knockback: 60 } }
  ],
  sniper: [
    { id: 'rail', name: 'Rail Lance', detail: 'Cuts through five targets and armor.', mods: { pierce: 5, armorPierce: 1, speed: 2400 } },
    { id: 'headhunter', name: 'Headhunter', detail: 'Explosive critical rounds.', mods: { crit: .6, explosive: 85 } }
  ],
  minigun: [
    { id: 'stable', name: 'Stabilized Minigun', detail: 'No overheating; concentrated fire.', mods: { heat: false, spread: 0 } },
    { id: 'inferno', name: 'Inferno Rotary', detail: 'High damage incendiary suppression.', mods: { damage: 16, status: 'burn', cooldown: 90 } }
  ],
  flame: [
    { id: 'napalm', name: 'Napalm Sprayer', detail: 'Wider cone with explosive fire pockets.', mods: { explosive: 55, spread: .25 } },
    { id: 'plasma', name: 'Plasma Torch', detail: 'Longer reach and armor penetration.', mods: { speed: 780, armorPierce: .7, damage: 11 } }
  ],
  tesla: [
    { id: 'storm', name: 'Chain Storm', detail: 'Arcs across six distinct targets.', mods: { chain: 6 } },
    { id: 'lance', name: 'Arc Lance', detail: 'Concentrated lightning pierces a column.', mods: { chain: 0, damage: 95, pierce: 3 } }
  ],
  freeze: [
    { id: 'field', name: 'Freeze Field', detail: 'Chilling blasts slow nearby targets.', mods: { explosive: 120 } },
    { id: 'shatter', name: 'Shatter Driver', detail: 'Double impact damage against frozen targets.', mods: { shatter: true, damage: 40 } }
  ],
  grenade: [
    { id: 'cluster', name: 'Cluster Launcher', detail: 'Three overlapping explosive projectiles.', mods: { shots: 3, spread: .17, damage: 48 } },
    { id: 'bunker', name: 'Bunker Buster', detail: 'Large armor-breaking blast.', mods: { explosive: 180, armorPierce: .75, damage: 130 } }
  ]
};

export const LIMITS = Object.freeze({ enemies: 160, bullets: 320, particles: 400, pickups: 80, enemyProjectiles: 200, hazards: 18 });
