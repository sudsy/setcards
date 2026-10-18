// Loads alphaTab and the app's browser-free modules into Node for testing.
import * as alphaTab from '@coderline/alphatab';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require('../../js/analysis.js');
require('../../js/chords.js');
require('../../demo.js');

export const SM = globalThis.SM;
export { alphaTab };

// Parses alphaTex (alphaTab's text format) into a score.
export function scoreFromTex(tex) {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(tex, new alphaTab.Settings());
  return importer.readScore();
}

// Sections as the app derives them: [{ name, start, end }] from the score's markers.
export function partsFromMarkers(score) {
  const marks = [];
  score.masterBars.forEach((mb, i) => { if (mb.section) marks.push({ name: mb.section.text, start: i }); });
  return marks.map((m, i) => ({ ...m, end: i + 1 < marks.length ? marks[i + 1].start - 1 : score.masterBars.length - 1 }));
}

// A one-track bass song from bar strings, with optional section names per bar index.
export function bassSong(bars, sections = {}, extra = '') {
  const body = bars.map((b, i) => (sections[i] ? `\\section "${sections[i]}" ` : '') + b).join(' |\n');
  return scoreFromTex(`\\title "Test" ${extra}\n.\n\\track "Bass"\n\\staff {tabs}\n\\tuning (G2 D2 A1 E1)\n\\instrument 33\n${body} |`);
}
