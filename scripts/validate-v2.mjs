import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ENEMIES, WEAPONS, MODES, MISSION_TEMPLATES, SKILL_TREES, VERSION } from '../docs/v2/src/config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  'docs/v2/index.html',
  'docs/v2/styles.css',
  'docs/v2/src/config.js',
  'docs/v2/src/storage.js',
  'docs/v2/src/audio.js',
  'docs/v2/src/simulation.js',
  'docs/v2/src/engine.js',
  'docs/v2/src/director.js',
  'docs/v2/src/renderer.js',
  'docs/v2/src/progression.js',
  'docs/v2/src/screens.js',
  'docs/v2/src/game.js'
];
const failures = [];

for (const relative of requiredFiles) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) failures.push(`Missing ${relative}`);
  else if (fs.statSync(absolute).size < 100) failures.push(`Unexpectedly small ${relative}`);
}

for (const relative of requiredFiles.filter((file) => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, relative)], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${relative} syntax error: ${result.stderr.trim()}`);
}

const html = fs.readFileSync(path.join(root, 'docs/v2/index.html'), 'utf8');
const game = requiredFiles.filter(file => file.endsWith('.js')).map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const styles = fs.readFileSync(path.join(root, 'docs/v2/styles.css'), 'utf8');

const requiredHtml = [
  ['V2 title', /Zombie Mayhem V2\.0/],
  ['game canvas', /id="gameCanvas"/],
  ['mode selector', /id="modeGrid"/],
  ['settings template', /id="settingsTemplate"/],
  ['skill template', /id="skillsTemplate"/],
  ['save tools', /id="saveToolsTemplate"/],
  ['preserved V1.2 link', /href="\.\.\/index\.html"/],
  ['module entry point', /src="\.\/src\/game\.js"/]
];
for (const [label, pattern] of requiredHtml) if (!pattern.test(html)) failures.push(`Missing ${label}`);

const requiredGameSystems = [
  ['enemy spawning', /spawnEnemy\(/],
  ['weapon firing', /fireWeapon\(/],
  ['boss phases', /updateBoss\(/],
  ['missions', /updateMission\(/],
  ['loot', /dropLoot\(/],
  ['skill progression', /buySkill\(/],
  ['account XP', /awardRun\(/],
  ['achievements', /ACHIEVEMENTS/],
  ['adaptive quality', /adaptiveQuality/],
  ['public runtime snapshot', /window\.__zombieV2/]
];
for (const [label, pattern] of requiredGameSystems) if (!pattern.test(game)) failures.push(`Missing ${label}`);

if (!/reduced-motion/.test(styles) || !/high-contrast/.test(styles)) failures.push('Missing accessibility styles');
if (!/^2\.0\.0-(alpha|beta)\./.test(VERSION)) failures.push(`Unexpected V2 version ${VERSION}`);
if (Object.keys(WEAPONS).length < 8) failures.push('Expected at least 8 weapons');
if (Object.keys(ENEMIES).length < 10) failures.push('Expected at least 10 enemy archetypes');
if (Object.keys(MODES).length < 4) failures.push('Expected at least 4 game modes');
if (MISSION_TEMPLATES.length < 6) failures.push('Expected at least 6 mission templates');
if (Object.keys(SKILL_TREES).length < 5) failures.push('Expected at least 5 skill trees');

// Base stats must remain readable to the spawner, while spread only carries
// behavioral traits. This prevents base fields from overwriting scaled values.
if (ENEMIES.walker.hp !== 42) failures.push('Walker base HP is unreadable');
if (Object.prototype.hasOwnProperty.call({ ...ENEMIES.walker }, 'hp')) failures.push('Enemy HP can overwrite runtime scaling');
if ({ ...ENEMIES.crawler }.weave !== true) failures.push('Enemy behavioral traits are not spreadable');
if ({ ...ENEMIES.spitter }.ranged !== true) failures.push('Ranged enemy trait is missing');
if ({ ...ENEMIES.boss }.boss !== true) failures.push('Boss trait is missing');

if (failures.length) {
  console.error('Zombie Mayhem V2 validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Zombie Mayhem ${VERSION} validation passed: ${Object.keys(WEAPONS).length} weapons, ${Object.keys(ENEMIES).length} enemies, ${MISSION_TEMPLATES.length} missions.`);
