import { VERSION, WIDTH, WEAPONS, MODES, FORMATIONS, SPECIALISTS, SKILL_TREES, ACHIEVEMENTS, EVOLUTIONS, BIOMES } from './config.js';
import { loadProfile, saveProfile, loadSettings, saveSettings, exportSave, importSave } from './storage.js';
import { CombatEngine } from './engine.js';
import { FixedStepClock } from './simulation.js';
import { awardRun } from './progression.js';
import { GameRenderer } from './renderer.js';
import { AudioDirector } from './audio.js';
import { ScreenManager } from './screens.js';
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const $ = (selector, root = document) => root.querySelector(selector);

class ZombieMayhemV2 {
  constructor() {
    this.title = $('#titlePanel'); this.profile = loadProfile(); this.settings = loadSettings(); this.mode = 'campaign';
    this.seed = new Date().toISOString().slice(0, 10).replaceAll('-', ''); $('#runSeed').value = this.seed;
    this.ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(node => [node.id, node]));
    this.clock = new FixedStepClock(); this.renderer = new GameRenderer(this.ui.gameCanvas, this.settings); this.audio = new AudioDirector(this.settings);
    this.engine = new CombatEngine(this.profile); this.engine.state.running = false;
    this.screens = new ScreenManager(this.ui.overlay, this.ui.appShell, paused => {
      this.engine.state.paused = paused; this.clock.reset();
      if (paused) this.audio.stopMusic(); else if (this.engine.state.running) void this.audio.startMusic();
    });
    this.bindUi(); this.applySettings(); this.renderWeapons(this.ui.weaponGrid); this.refreshTitle(); this.syncHud();
    this.screens.set('title', this.title); this.ui.startBtn.disabled = true;
    this.ui.startBtn.textContent = 'Loading assets…';
  }
  async init() {
    await Promise.all([this.renderer.load(), this.audio.preload()]);
    this.ui.startBtn.disabled = false; this.ui.startBtn.textContent = 'Start V2.0 Run';
    window.__zombieV2 = { version: VERSION, snapshot: () => this.snapshot(), start: () => this.startRun(), pause: () => this.togglePause() };
    this.lastFrame = performance.now(); this.hudElapsed = 0;
    this.loop = time => {
      try {
        const dt = Math.max(0, Math.min(.2, (time - this.lastFrame) / 1000)); this.lastFrame = time;
        const alpha = this.engine.state.paused ? 1 : this.clock.advance(dt, step => this.engine.tick(step));
        this.renderer.render(this.engine, alpha, dt); this.hudElapsed += dt;
        if (this.hudElapsed >= .1) { this.hudElapsed = 0; this.syncHud(); }
        requestAnimationFrame(this.loop);
      } catch (error) { this.fatal(error); }
    };
    requestAnimationFrame(this.loop);
  }
  bindUi() {
    this.ui.startBtn.onclick = () => this.startRun();
    this.ui.pauseBtn.onclick = () => this.togglePause(); this.ui.settingsBtn.onclick = () => this.showSettings();
    this.ui.skillsBtn.onclick = () => this.showSkills(); this.ui.saveToolsBtn.onclick = () => this.showSaveTools();
    this.ui.recordsBtn.onclick = () => this.showRecords();
    this.ui.leftBtn.onpointerdown = () => this.engine.lane(-1); this.ui.rightBtn.onpointerdown = () => this.engine.lane(1);
    this.ui.abilityBtn.onpointerdown = () => this.engine.overdrive(); this.ui.evacBtn.onclick = () => this.engine.extract();
    this.ui.loadoutBtn.onclick = () => this.showLoadout(); this.ui.skipTutorial.onclick = () => this.engine.skipTutorial();
    this.ui.formationSelect.innerHTML = Object.entries(FORMATIONS).map(([id, form]) => `<option value="${id}">${form.name}</option>`).join('');
    this.ui.formationSelect.onchange = () => { this.engine.state.formation = this.ui.formationSelect.value; this.syncHud(); };
    this.title.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
      this.mode = button.dataset.mode;
      this.title.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    });
    window.addEventListener('keydown', event => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
        if (this.screens.kind === 'playing' || this.screens.kind === 'pause') this.togglePause();
        else if (['settings', 'loadout', 'skills', 'saves', 'records', 'confirm'].includes(this.screens.kind)) this.screens.pop();
        return;
      }
      if (this.screens.kind !== 'playing') return;
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'e'].includes(event.key)) event.preventDefault();
      if (event.repeat) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') this.engine.lane(-1);
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') this.engine.lane(1);
      if (event.key === ' ' || event.key.toLowerCase() === 'e') this.engine.overdrive();
      const weapon = Object.keys(WEAPONS)[Number(event.key) - 1]; if (weapon) this.selectWeapon(weapon);
    });
    this.ui.gameCanvas.onpointerdown = event => {
      if (this.screens.kind !== 'playing') return;
      const rect = this.ui.gameCanvas.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width * WIDTH;
      this.engine.lane(x < 375 ? 0 : x < 585 ? 1 : 2, true);
    };
    const pauseOnLeave = () => { if (this.screens.kind === 'playing' && this.engine.state.running) this.togglePause(); };
    window.addEventListener('blur', pauseOnLeave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('pagehide', () => { this.persist(); this.audio.stopMusic(); });
  }
  startRun() {
    if (this.ui.startBtn.disabled) return;
    this.seed = this.ui.runSeed.value.trim().replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32) || this.seed;
    this.unsubscribe?.(); this.audio.stopMusic(true); this.renderer.reset();
    this.engine = new CombatEngine(this.profile, this.mode, this.seed, !this.profile.tutorialComplete);
    this.unsubscribe = this.engine.events.subscribe(event => this.onEvent(event)); this.clock.reset();
    this.screens.clear(); this.renderWeapons(this.ui.weaponGrid); this.syncHud();
    this.feed(this.engine.director.objective());
  }
  onEvent(event) {
    this.renderer.event(event); this.audio.event(event);
    if (event.type === 'draft') { this.showDraft(event.choices); return; }
    if (event.type === 'finish') { this.finishRun(); return; }
    if (event.type === 'tutorialComplete') { this.profile.tutorialComplete = true; this.persist(); this.feed('Training complete. Hold the line.'); }
    if (event.type === 'hurt' && this.settings.damageFlashes) {
      this.ui.damageFlash.classList.add('flash'); clearTimeout(this.flashTimer); this.flashTimer = setTimeout(() => this.ui.damageFlash.classList.remove('flash'), 120);
    }
    const text = ({ wave: `Wave ${event.wave} · ${event.biome}`, boss: event.name, bossDefeated: `${event.name} defeated`,
      warning: event.text, overdrive: 'OVERDRIVE ENGAGED', loot: event.name, mission: `Mission complete +${event.reward}`,
      chapter: `Chapter ${event.number}: ${event.name}`, phase: `Boss phase ${event.phase}`, revive: 'LAST STAND · 2 seconds of protection',
      weapon: `${event.name} equipped`, upgrade: 'Tactical upgrade acquired', evac: event.active ? 'Evac inbound. Survive five seconds.' : 'Evac canceled. Supplies remain at risk.' })[event.type];
    if (text) this.feed(text, event.color);
    if (['upgrade', 'weapon'].includes(event.type)) this.renderWeapons(this.ui.weaponGrid);
  }
  togglePause() {
    if (!this.engine.state.running || this.engine.state.gameOver) return;
    if (this.screens.kind === 'pause') { this.screens.pop(); return; }
    if (this.screens.kind !== 'playing') return;
    this.screens.push('pause', `<section class="modal hero"><span class="eyebrow">RUN PAUSED</span><h2>Hold the line</h2><p>Your run is safe while this menu is open.</p><div class="modal-actions"><button id="resumeRun" class="primary">Resume</button><button id="pauseSettings">Settings</button><button id="restartRun">Restart</button><button id="quitRun">Title Screen</button></div></section>`);
    $('#resumeRun').onclick = () => this.screens.pop(); $('#pauseSettings').onclick = () => this.showSettings();
    $('#restartRun').onclick = () => this.confirmAbandon(() => this.startRun());
    $('#quitRun').onclick = () => this.confirmAbandon(() => this.showTitle());
  }
  confirmAbandon(next) {
    this.screens.push('confirm', `<section class="modal"><h2>End this run?</h2><p>Your run will be recorded. Extraction retains 25% of unbanked supplies when you abandon it.</p><div class="modal-actions"><button id="keepRun" class="primary">Keep playing</button><button id="endRun">End run</button></div></section>`);
    $('#keepRun').onclick = () => this.screens.pop(); $('#endRun').onclick = () => { this.engine.finish(false); next(); };
  }
  showTitle() {
    this.engine.state.running = false; this.refreshTitle(); this.screens.set('title', this.title); this.syncHud();
  }
  showSettings() {
    const panel = $('#settingsTemplate').content.firstElementChild.cloneNode(true);
    const ids = { masterVolume: 'masterVolume', musicVolume: 'musicVolume', effectsVolume: 'effectsVolume', qualitySelect: 'quality', reducedMotion: 'reducedMotion', highContrast: 'highContrast', damageFlashes: 'damageFlashes', screenShake: 'screenShake', damageNumbers: 'damageNumbers', gore: 'gore' };
    for (const [id, key] of Object.entries(ids)) {
      const control = $(`#${id}`, panel), boolean = control.type === 'checkbox';
      if (boolean) control.checked = this.settings[key]; else control.value = this.settings[key];
      control.oninput = () => {
        this.settings[key] = boolean ? control.checked : control.type === 'range' ? Number(control.value) : control.value;
        if (!saveSettings(this.settings)) this.feed('Settings could not be saved. Device storage is unavailable.');
        this.audio.updateSettings(this.settings); this.applySettings();
      };
    }
    $('[data-close]', panel).onclick = () => this.screens.pop(); this.screens.push('settings', panel);
  }
  applySettings() {
    document.body.classList.toggle('reduced-motion', this.settings.reducedMotion); document.body.classList.toggle('high-contrast', this.settings.highContrast);
    this.renderer.settings = this.settings;
  }
  showSkills(replace = false) {
    const panel = $('#skillsTemplate').content.firstElementChild.cloneNode(true);
    $('#skillTrees', panel).innerHTML = Object.values(SKILL_TREES).map(tree => `<section class="skill-tree"><h3>${tree.label}</h3>${tree.nodes.map(node => {
      const level = this.profile.skills[node.id] || 0;
      return `<button data-skill="${node.id}" ${level >= node.max || this.profile.skillPoints < 1 ? 'disabled' : ''}><b>${node.name} ${level}/${node.max}</b><small>${node.detail}</small></button>`;
    }).join('')}</section>`).join('');
    panel.querySelectorAll('[data-skill]').forEach(button => button.onclick = () => this.buySkill(button.dataset.skill));
    $('[data-close]', panel).onclick = () => this.screens.pop();
    if (replace) { this.screens.stack.at(-1).content = panel; this.screens.render(); } else this.screens.push('skills', panel);
  }
  buySkill(id) {
    const node = Object.values(SKILL_TREES).flatMap(tree => tree.nodes).find(n => n.id === id);
    if (!node || !this.profile.skillPoints || (this.profile.skills[id] || 0) >= node.max) return;
    this.profile.skills[id] = (this.profile.skills[id] || 0) + 1; this.profile.skillPoints--; this.persist(); this.refreshTitle(); this.showSkills(true);
  }
  showSaveTools() {
    const panel = $('#saveToolsTemplate').content.firstElementChild.cloneNode(true), area = $('#saveData', panel), status = $('#saveStatus', panel);
    $('#exportSave', panel).onclick = () => { area.value = exportSave(this.profile, this.settings); area.select(); status.textContent = 'Backup ready. Copy and keep it somewhere safe.'; };
    $('#importSave', panel).onclick = () => {
      try { const data = importSave(area.value); this.profile = data.profile; this.settings = data.settings;
        this.audio.updateSettings(this.settings); this.applySettings(); this.refreshTitle(); this.renderWeapons(this.ui.weaponGrid); status.textContent = 'Import successful.';
      } catch (error) { status.textContent = `Import failed: ${error.message}`; }
    };
    $('[data-close]', panel).onclick = () => this.screens.pop(); this.screens.push('saves', panel);
  }
  renderWeapons(host) {
    host.innerHTML = Object.entries(WEAPONS).map(([id, weapon], index) => {
      const unlocked = this.profile.unlockedWeapons.includes(id) || this.profile.accountLevel >= weapon.unlock;
      const evolution = EVOLUTIONS[id].find(item => item.id === this.engine.state.evolutions[id]);
      const bonus = Math.min(12, Math.floor((this.profile.mastery[id] || 0) / 250) * 2);
      return `<button data-weapon="${id}" class="${id === this.engine.state.selectedWeapon ? 'selected' : ''}" aria-pressed="${id === this.engine.state.selectedWeapon}" ${unlocked ? '' : 'disabled'}><i>${index + 1}</i><b>${evolution?.name || weapon.name}</b><span>${unlocked ? `${weapon.damage} damage · ${Math.round(1000 / weapon.cooldown * 10) / 10}/s` : `Unlock Lv. ${weapon.unlock}`}</span><span>${evolution ? 'EVOLVED' : `Mastery bonus +${bonus}%`}</span></button>`;
    }).join('');
    host.querySelectorAll('[data-weapon]').forEach(button => button.onclick = () => { this.selectWeapon(button.dataset.weapon); if (host !== this.ui.weaponGrid) this.renderWeapons(host); });
  }
  selectWeapon(id) { this.engine.selectWeapon(id); }
  showLoadout() {
    this.screens.push('loadout', `<section class="modal"><h2>Squad command</h2><div class="weapon-grid" id="mobileWeaponGrid"></div><label class="command-label">Formation<select id="mobileFormation">${Object.entries(FORMATIONS).map(([id, f]) => `<option value="${id}">${f.name}</option>`).join('')}</select></label><p id="formationDetail"></p><div class="modal-actions"><button id="closeLoadout" class="primary">Done</button></div></section>`);
    this.renderWeapons($('#mobileWeaponGrid')); const select = $('#mobileFormation'); select.value = this.engine.state.formation;
    const update = () => { this.engine.state.formation = select.value; $('#formationDetail').textContent = FORMATIONS[select.value].detail; }; select.onchange = update; update();
    $('#closeLoadout').onclick = () => this.screens.pop();
  }
  showDraft(choices) {
    this.screens.set('draft', `<section class="modal wide draft-modal"><span class="eyebrow">TACTICAL LEVEL UP</span><h2>Choose one upgrade</h2><p>Combat is paused. This choice lasts for the current run.</p><div class="draft-grid">${choices.map(item => `<button data-draft="${item.id}"><small>${item.tag}</small><b>${item.name}</b><span>${item.detail}</span></button>`).join('')}</div></section>`);
    this.ui.overlay.querySelectorAll('[data-draft]').forEach(button => button.onclick = () => {
      if (this.engine.applyRunUpgrade(button.dataset.draft)) { this.screens.clear(); this.syncHud(); }
    });
  }
  finishRun() {
    const { report, earned } = awardRun(this.profile, this.engine.state, this.mode, this.seed); this.persist(); this.refreshTitle();
    const title = report.victory ? this.mode === 'campaign' ? 'The corridor is clear' : this.mode === 'extraction' ? 'Extraction secured' : 'All bosses defeated' : 'The run is over';
    this.screens.set('results', `<section class="modal hero"><span class="eyebrow">${report.victory ? 'MISSION ACCOMPLISHED' : 'AFTER ACTION REPORT'}</span><h2>${title}</h2>${this.reportMarkup(report)}<p>Account Level ${this.profile.accountLevel} · ${this.profile.skillPoints} skill points</p>${earned.length ? `<p class="earned">Unlocked: ${earned.join(', ')}</p>` : ''}<div class="modal-actions"><button id="runAgain" class="primary">Run Again</button><button id="returnTitle">Title Screen</button></div></section>`);
    $('#runAgain').onclick = () => this.startRun(); $('#returnTitle').onclick = () => this.showTitle();
  }
  reportMarkup(r) {
    const evolutions = Object.entries(r.evolutions).map(([weapon, branch]) => EVOLUTIONS[weapon].find(e => e.id === branch)?.name).filter(Boolean);
    return `<div class="report-grid"><div><span>Time</span><b>${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, '0')}</b></div><div><span>Kills</span><b>${r.kills}</b></div><div><span>Bosses</span><b>${r.bosses}</b></div><div><span>Banked</span><b>${r.banked}</b></div><div><span>Damage</span><b>${Math.round(r.damage).toLocaleString()}</b></div><div><span>Shot accuracy</span><b>${r.shots ? Math.min(100, Math.round(r.hits / r.shots * 100)) : 0}%</b></div></div><p>${FORMATIONS[r.formation].name} · ${r.specialists.map(id => SPECIALISTS[id].name).join(', ') || 'No specialists'}</p>${evolutions.length ? `<p>${evolutions.join(' · ')}</p>` : ''}<small class="seed-note">Seed ${escapeHtml(r.seed)} · ${Math.floor(r.distance)}m · Wave ${r.wave}</small>`;
  }
  showRecords() {
    this.screens.push('records', `<section class="modal wide"><h2>Service record</h2><div class="achievement-grid">${Object.entries(ACHIEVEMENTS).map(([id, name]) => `<div class="${this.profile.achievements[id] ? 'earned' : ''}">${this.profile.achievements[id] ? '✓' : '○'} ${name}</div>`).join('')}</div><h3>Recent runs</h3>${this.profile.history.length ? this.profile.history.map(r => `<details><summary>${MODES[r.mode].label} · ${r.victory ? 'Victory' : 'Run ended'} · ${r.kills} kills</summary>${this.reportMarkup(r)}</details>`).join('') : '<p>Complete your first run to start your service record.</p>'}<div class="modal-actions"><button id="closeRecords" class="primary">Done</button></div></section>`);
    $('#closeRecords').onclick = () => this.screens.pop();
  }
  persist() { if (!saveProfile(this.profile)) this.feed('Progress could not be saved. Use Save Tools to export a backup.'); }
  refreshTitle() {
    this.ui.bestDistance.textContent = `${Math.floor(this.profile.bestDistance)}m`; this.ui.accountLevel.textContent = this.profile.accountLevel; this.ui.skillPoints.textContent = this.profile.skillPoints;
  }
  feed(text, color = '#d8f6e8') {
    this.ui.combatFeed.textContent = text; this.ui.combatFeed.style.color = color; this.ui.combatFeed.style.opacity = '1';
    clearTimeout(this.feedTimer); this.feedTimer = setTimeout(() => { this.ui.combatFeed.style.opacity = '0'; }, 2100);
  }
  syncHud() {
    const s = this.engine.state, ui = this.ui;
    for (const [id, value] of Object.entries({ squadStat: Math.ceil(s.squad), armorStat: Math.ceil(s.armor), waveStat: s.wave, distanceStat: `${Math.floor(s.distance)}m`, creditsStat: Math.floor(s.credits), levelStat: this.profile.accountLevel, fpsStat: `${this.renderer.fps} FPS`, modeLabel: MODES[this.engine.mode].label, objectiveText: this.engine.director.objective(), upgradePoints: `Wave ${s.wave + 1} draft` })) ui[id].textContent = value;
    const mission = s.mission;
    ui.missionTitle.textContent = mission.title; ui.missionText.textContent = mission.text.replace('{target}', mission.target);
    ui.missionReward.textContent = `+${mission.reward}`; ui.missionCount.textContent = `${Math.min(mission.target, Math.floor(s.missionValue))} / ${mission.target}`;
    ui.missionProgress.style.width = `${Math.min(100, s.missionValue / mission.target * 100)}%`;
    ui.formationSelect.value = s.formation; ui.weaponMastery.textContent = this.engine.weapon().name;
    const specialistNames = s.specialists.map(id => SPECIALISTS[id].name).join(' · ');
    if (ui.specialistCard.dataset.value !== specialistNames) { ui.specialistCard.dataset.value = specialistNames; ui.specialistCard.textContent = specialistNames || 'Recruit specialists through tactical drafts.'; }
    ui.effectList.textContent = `${FORMATIONS[s.formation].detail}${s.time < s.overdriveUntil ? ' · OVERDRIVE' : ''}${s.combo > 2 ? ` · ${s.combo} kill streak` : ''}`;
    ui.abilityBtn.textContent = s.time < s.overdriveUntil ? 'Overdrive active' : s.overdrive >= 100 ? 'Overdrive' : `Charge ${Math.floor(s.overdrive)}%`;
    ui.evacBtn.hidden = this.engine.mode !== 'extraction' || s.distance < 600 || !s.running;
    ui.evacBtn.textContent = s.extracting ? 'Cancel evac' : 'Call evacuation';
    ui.bossBar.classList.toggle('hidden', !s.boss); ui.missionCard.classList.toggle('boss-active', !!s.boss);
    if (s.boss) { ui.bossName.textContent = s.boss.name; ui.bossPhase.textContent = `Phase ${s.boss.phase} · ${s.boss.weakUntil > s.time ? 'WEAK POINT OPEN' : 'Armored'}`; ui.bossHealth.style.width = `${Math.max(0, s.boss.hp / s.boss.maxHp * 100)}%`; }
    ui.tutorialBanner.hidden = s.tutorial < 0 || !s.running;
    ui.tutorialText.textContent = ['Move lanes: tap the road or use ← → / A D.', 'Use Overdrive: press Space, E, or the Overdrive button.', 'Defeat three infected. Fire is automatic; keep threats in your lane.'][s.tutorial] || '';
    this.audio.intensity(!!s.boss, s.enemies.length);
  }
  snapshot() {
    const s = this.engine.state;
    return { version: VERSION, mode: this.engine.mode, running: s.running, paused: s.paused, gameOver: s.gameOver,
      wave: s.wave, distance: Math.floor(s.distance), squad: Math.ceil(s.squad), enemies: s.enemies.length,
      weapon: s.selectedWeapon, mission: s.mission.type, seed: this.seed, formation: s.formation,
      specialists: [...s.specialists], biome: BIOMES[this.engine.director.biomeIndex].id,
      quality: this.renderer.quality(), fps: this.renderer.fps, screen: this.screens.kind, assetsLoaded: Object.keys(this.renderer.assets).length === 2,
      tutorial: s.tutorial, time: s.time, overdriveUntil: s.overdriveUntil, draft: s.draft?.map(item => item.id) || null, bosses: s.bosses,
      pools: Object.fromEntries(Object.entries(this.engine.pools).map(([id, pool]) => [id, { active: pool.active.size, created: pool.created, limit: pool.limit }])) };
  }
  fatal(error) {
    console.error(error); this.engine.state.paused = true; this.audio.stopMusic();
    this.screens.set('error', '<section class="modal"><h2>The game could not continue</h2><p>Your saved profile is safe. Reload to recover. If loading failed, check your connection.</p><button id="recoverGame" class="primary">Reload game</button></section>');
    $('#recoverGame').onclick = () => location.reload();
  }
}
const app = new ZombieMayhemV2();
app.init().catch(error => app.fatal(error));
