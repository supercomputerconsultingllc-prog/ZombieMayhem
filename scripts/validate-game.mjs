import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../docs/index.html', import.meta.url);
const html = fs.readFileSync(file, 'utf8');
const failures = [];

function requireMatch(label, pattern) {
  if (!pattern.test(html)) failures.push(`Missing ${label}`);
}

requireMatch('HTML doctype', /<!doctype html>/i);
requireMatch('Zombie Mayhem title', /<title>Zombie Mayhem<\/title>/i);
requireMatch('canvas', /<canvas\b/i);
requireMatch('start action', /startZombieRun/);
requireMatch('settings action', /openSettingsPanel/);
requireMatch('pause support', /pause/i);
requireMatch('local persistence', /localStorage/);
requireMatch('mission system', /mission/i);
requireMatch('season progression', /season/i);
requireMatch('shop or upgrade system', /(shop|upgrade)/i);

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim());

if (inlineScripts.length === 0) {
  failures.push('No inline gameplay script found');
} else {
  inlineScripts.forEach((script, index) => {
    try {
      new vm.Script(script, { filename: `docs/index.html:inline-script-${index + 1}` });
    } catch (error) {
      failures.push(`JavaScript syntax error in inline script ${index + 1}: ${error.message}`);
    }
  });
}

const duplicateIds = [...html.matchAll(/\bid=["']([^"']+)["']/gi)]
  .map((match) => match[1])
  .filter((id, index, all) => all.indexOf(id) !== index);

if (duplicateIds.length) {
  failures.push(`Duplicate element IDs: ${[...new Set(duplicateIds)].join(', ')}`);
}

if (html.length < 50000) {
  failures.push(`Unexpectedly small game file (${html.length} bytes)`);
}

if (failures.length) {
  console.error('Zombie Mayhem validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Zombie Mayhem validation passed (${html.length} bytes, ${inlineScripts.length} inline scripts).`);
