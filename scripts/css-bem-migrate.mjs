/**
 * One-off style migration: ID selectors → BEM classes, legacy classes → BEM.
 * Run: node scripts/css-bem-migrate.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const cssPath = path.join(root, 'src', 'styles.css');

let s = fs.readFileSync(cssPath, 'utf8');

const idToClass = [
  ['#game-view', '.game-view'],
  ['#hud', '.race-hud'],
  ['#lap-display', '.race-hud__lap'],
  ['#lap-times-list', '.race-hud__lap-times'],
  ['#best-display', '.race-hud__best'],
  ['#time-display', '.race-hud__time'],
  ['#speed-display', '.race-hud__speed'],
  ['#stage-display', '.race-hud__stage'],
  ['#camera-display', '.race-hud__camera'],
  ['#controls-hint', '.race-hud__controls-hint'],
  ['#overlay', '.menu-overlay'],
  ['#countdown', '.race-countdown'],
  ['#results', '.race-results'],
  ['#leaderboard', '.race-leaderboard'],
  ['#records', '.race-records'],
  ['#settings', '.car-settings'],
  ['#touch-controls', '.touch-ui'],
  ['#menu-shell', '.menu-overlay__shell'],
  ['#menu-tab-toggle', '.menu-overlay__tab-toggle'],
  ['#event-tab', '.menu-overlay__event-tab'],
  ['#challenges-tab', '.menu-overlay__challenges-tab'],
  ['#challenge-mode-toggle', '.menu-overlay__challenge-mode-toggle'],
  ['#challenge-preview', '.menu-overlay__challenge-preview'],
  ['#track-code-input', '.menu-overlay__track-input'],
  ['#random-btn', '.menu-overlay__random-btn'],
  ['#rng-all-btn', '.menu-overlay__rng-all-btn'],
  ['#dir-toggle', '.menu-overlay__dir-toggle'],
  ['#mode-toggle', '.menu-overlay__mode-toggle'],
  ['#race-type-toggle', '.menu-overlay__race-type-toggle'],
  ['#dir-value', '.menu-overlay__dir-value'],
  ['#mode-value', '.menu-overlay__mode-value'],
  ['#race-type-value', '.menu-overlay__race-type-value'],
  ['#single-config', '.menu-overlay__single-config'],
  ['#series-config', '.menu-overlay__series-config'],
  ['#stage-list', '.menu-overlay__stage-list'],
  ['#stages-value', '.menu-overlay__stages-value'],
  ['#stages-minus', '.menu-overlay__stages-minus'],
  ['#stages-plus', '.menu-overlay__stages-plus'],
  ['#laps-value', '.menu-overlay__laps-value'],
  ['#laps-minus', '.menu-overlay__laps-minus'],
  ['#laps-plus', '.menu-overlay__laps-plus'],
  ['#laps-label', '.menu-overlay__laps-label'],
  ['#leaderboard-menu-btn', '.menu-overlay__leaderboard-btn'],
  ['#event-start-prompt', '.menu-overlay__start-prompt--event'],
  ['#challenge-start-prompt', '.menu-overlay__start-prompt--challenge'],
  ['#menu-touch-hint', '.menu-overlay__touch-hint'],
  ['#records-btn', '.menu-overlay__records-btn'],
  ['#settings-btn', '.menu-overlay__settings-btn'],
  ['#results-track-code', '.race-results__track-code'],
  ['#results-track-text', '.race-results__track-text'],
  ['#copy-track-btn', '.race-results__copy-track'],
  ['#replay-btn', '.race-results__replay'],
  ['#share-btn', '.race-results__share'],
  ['#leaderboard-btn', '.race-results__leaderboard'],
  ['#results-list', '.race-results__list'],
  ['#results-prompt', '.race-results__prompt'],
  ['#replay-hint', '.race-results__replay-hint'],
  ['#leaderboard-list', '.race-leaderboard__list'],
  ['#leaderboard-track', '.race-leaderboard__track'],
  ['#leaderboard-back', '.race-leaderboard__back'],
  ['#records-list', '.race-records__list'],
  ['#records-back', '.race-records__back'],
  ['#settings-back', '.car-settings__back'],
  ['#touch-steer-indicator', '.touch-ui__steer-track'],
  ['#touch-steer-dot', '.touch-ui__steer-dot'],
  ['#touch-gas-highlight', '.touch-ui__gas'],
  ['#touch-brake-highlight', '.touch-ui__brake'],
  ['#touch-restart-btn', '.touch-ui__restart'],
  ['#touch-camera-btn', '.touch-ui__camera'],
  ['#touch-menu-btn', '.touch-ui__menu'],
];

idToClass.sort((a, b) => b[0].length - a[0].length);
for (const [from, to] of idToClass) {
  s = s.split(from).join(to);
}

const classToClass = [
  ['.hud-box', '.race-hud__box'],
  ['.settings-bar-preview-inner', '.car-settings__preview-inner'],
  ['.settings-bar-preview', '.car-settings__preview'],
  ['.settings-bar-lower', '.car-settings__strip'],
  ['.settings-bar-divider', '.car-settings__divider'],
  ['.settings-bar-col', '.car-settings__col'],
  ['.settings-bar', '.car-settings__bar'],
  ['.settings-appearance-card', '.car-settings__appearance'],
  ['.settings-appearance-body', '.car-settings__appearance-body'],
  ['.settings-appearance-colors', '.car-settings__swatches'],
  ['.settings-appearance-patterns', '.car-settings__patterns'],
  ['.settings-pattern-label', '.car-settings__pattern-title'],
  ['.settings-lights-column', '.car-settings__lights-wrap'],
  ['.settings-lights-card', '.car-settings__lights-card'],
  ['.settings-lights-row', '.car-settings__lights-row'],
  ['.settings-slider-block', '.car-settings__slider'],
  ['.settings-section', '.car-settings__field'],
  ['.settings-camera-grid', '.car-settings__camera-rail'],
  ['.seg-control-sm', '.seg--sm'],
  ['.seg-control', '.seg'],
  ['.seg-option', '.seg__option'],
  ['.menu-tab-divider', '.menu-overlay__divider--tabs'],
  ['.menu-divider', '.menu-overlay__divider'],
  ['.menu-util-row', '.menu-overlay__util-row'],
  ['.menu-util-strip', '.menu-overlay__util'],
  ['.menu-footer', '.menu-overlay__footer'],
  ['.menu-card', '.menu-overlay__card'],
  ['.track-label', '.field-label'],
  ['.pattern-options', '.car-settings__pattern-list'],
  ['.pattern-btn', '.car-settings__pattern-btn'],
  ['.underglow-slider', '.car-settings__range'],
];

classToClass.sort((a, b) => b[0].length - a[0].length);
for (const [from, to] of classToClass) {
  s = s.split(from).join(to);
}

// Fix double replacements: .seg became part of .settings-* if any — already ordered
// .car-settings .seg__option — #settings was .car-settings
s = s.replace(/\.car-settings \.car-settings__/g, '.car-settings .');

// Undo over-replace: "seg" in "settings" — we replaced settings-bar before settings-* 
// "settings" word in class names was "settings-bar" etc - OK

fs.writeFileSync(cssPath, s);
console.log('Updated', cssPath);
