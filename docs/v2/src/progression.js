import { ACHIEVEMENTS, WEAPONS } from './config.js';
export function awardRun(profile, state, mode, seed) {
  const banked = Math.floor(state.credits * (mode === 'extraction' && !state.victory ? .25 : 1));
  profile.bestDistance = Math.max(profile.bestDistance, Math.floor(state.distance));
  profile.lifetimeKills += state.kills; profile.lifetimeCredits += banked;
  profile.chaptersCompleted = Math.max(profile.chaptersCompleted, mode === 'campaign' ? state.bosses : 0);
  for (const [id, amount] of Object.entries(state.mastery)) profile.mastery[id] = (profile.mastery[id] || 0) + amount;
  profile.accountXp += Math.floor(state.distance * .12 + state.kills * 7 + state.bosses * 230 + (state.victory ? 220 : 0));
  while (profile.accountLevel < 500 && profile.accountXp >= profile.accountLevel * 220) {
    profile.accountXp -= profile.accountLevel * 220; profile.accountLevel++; profile.skillPoints++;
  }
  const checks = { first_blood: profile.lifetimeKills >= 1, exterminator: profile.lifetimeKills >= 500,
    road_warrior: state.distance >= 1000, boss_breaker: state.bosses > 0, rich_run: banked >= 1000,
    campaign_clear: mode === 'campaign' && state.victory };
  const earned = [];
  for (const [id, valid] of Object.entries(checks)) if (valid && !profile.achievements[id]) {
    profile.achievements[id] = true; profile.skillPoints++; earned.push(ACHIEVEMENTS[id]);
  }
  for (const [id, weapon] of Object.entries(WEAPONS)) if (profile.accountLevel >= weapon.unlock && !profile.unlockedWeapons.includes(id)) profile.unlockedWeapons.push(id);
  const report = {
    mode, seed, victory: state.victory, date: new Date().toISOString(), distance: Math.floor(state.distance),
    kills: state.kills, bosses: state.bosses, credits: Math.floor(state.credits), banked,
    time: state.time, damage: Math.round(state.damageDealt), shots: state.shots, hits: state.hits, wave: state.wave,
    formation: state.formation, specialists: [...state.specialists], evolutions: { ...state.evolutions }
  };
  profile.history.unshift(report); profile.history.length = Math.min(profile.history.length, 20);
  return { report, earned };
}
