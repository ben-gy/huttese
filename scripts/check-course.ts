// Sanity-checks every lesson: ids resolve, exercises generate, options are distinct and include the answer.
import { ALL_LESSONS } from '../src/data/course';
import { generate, sense, checkTyped, equivalents } from '../src/lib/engine';
import { tokenize, GLYPHS } from '../src/lib/script';
import { WORDS, PHRASES } from '../src/data/vocab';

let problems = 0;
const warn = (m: string) => { problems++; console.log('✗', m); };
for (const w of [...WORDS, ...PHRASES]) if (!tokenize(w.hut).length) warn(`untokenisable: ${w.hut}`);
for (const l of ALL_LESSONS) {
  for (let run = 0; run < 30; run++) {
    const ex = generate(l, { firstTime: run % 2 === 0, speech: true });
    if (ex.length < 6) warn(`${l.id}: only ${ex.length} exercises`);
    for (const e of ex) {
      if (e.type === 'choose') {
        if (!e.options.some((o) => o.id === e.item.id)) warn(`${l.id}: answer missing`);
        if (e.options.length < 3) warn(`${l.id}: ${e.options.length} options for ${e.item.hut} (${e.prompt}->${e.show})`);
        const shown = e.options.map((o) => (e.show === 'en' ? o.en : e.show === 'pron' ? o.pron : o.hut));
        if (new Set(shown).size !== shown.length) warn(`${l.id}: duplicate options ${shown}`);
        if (e.item.kind !== 'glyph') {
          const ss = e.options.map((o) => sense(o.en));
          ss.forEach((a, i) => ss.slice(i + 1).forEach((b) => { if ([...a].some((x) => b.has(x))) warn(`${l.id}: ambiguous options ${e.options.map((o) => o.en).join(' | ')}`); }));
        }
      }
      if ((e.type === 'build' || e.type === 'spell') && !e.answer.every((a) => e.bank.includes(a))) warn(`${l.id}: bank missing answer`);
      if (e.type === 'match' && new Set(e.items.map((i) => i.id)).size !== e.items.length) warn(`${l.id}: dup match`);
    }
  }
  const sample = generate(l, { firstTime: true, speech: true });
  console.log(l.id.padEnd(18), sample.length, sample.map((e) => e.type[0] + ('prompt' in e ? e.prompt[0] : '')).join(' '));
}
// Content: each respelling must agree with its IPA (words, syllables, stressed syllable).
for (const e of [...WORDS, ...PHRASES]) {
  const pw = e.pron.replace(/[,!?]/g, '').trim().split(/\s+/);
  const iw = e.ipa.replace(/^\/|\/$/g, '').trim().split(/\s+/);
  if (pw.length !== iw.length) { warn(`${e.hut}: ${pw.length} words in "${e.pron}" but ${iw.length} in ${e.ipa}`); continue; }
  pw.forEach((w, i) => {
    const ps = w.split('-');
    const is = iw[i].replace(/ˌ/g, '.').split('.').filter(Boolean);
    if (ps.length !== is.length) return warn(`${e.hut}: "${w}" has ${ps.length} syllables, IPA "${iw[i]}" has ${is.length}`);
    if (ps.length < 2) return;
    const pStress = ps.findIndex((s) => /[A-Z]/.test(s) && s === s.toUpperCase());
    const iStress = is.findIndex((s) => s.includes('ˈ'));
    if (pStress !== iStress) warn(`${e.hut}: stress on syllable ${pStress + 1} in "${w}" but ${iStress + 1} in ${iw[i]}`);
  });
}

// Script: every glyph is drawn differently.
const paths = new Map<string, string>();
for (const g of GLYPHS) {
  if (paths.has(g.path)) warn(`glyphs ${paths.get(g.path)} and ${g.key} are identical`);
  paths.set(g.path, g.key);
}

// Answer checking.
const expectEq = (label: string, got: unknown, want: unknown) => { if (got !== want) warn(`${label}: got ${got}, want ${want}`); };
expectEq('exact', checkTyped('bo shuda', 'bo shuda'), 'right');
expectEq('capitals + punctuation', checkTyped('Inkabunga', 'inkabunga!'), 'right');
expectEq('apostrophe optional', checkTyped('kwanna', "k'wanna"), 'right');
expectEq('one-letter slip', checkTyped('pateea', 'pateesa'), 'typo');
expectEq('wrong word', checkTyped('poodoo', 'pateesa'), 'wrong');
expectEq('blank', checkTyped('  ', 'bo'), 'wrong');
const word = (hut: string) => ({ ...WORDS.find((w) => w.hut === hut)!, kind: 'word' as const });
expectEq('synonym accepted (you)', equivalents(word('uba')).includes('chuba'), true);
expectEq('synonym accepted (greetings)', equivalents(word("h'chu apenkee")).includes('bo shuda'), true);
expectEq('different meaning not accepted', equivalents(word('bantha poodoo')).includes('poodoo'), false);

const used = new Set(ALL_LESSONS.flatMap((l) => [...(l.words ?? []), ...(l.phrases ?? [])]));
const unused = [...WORDS, ...PHRASES].filter((w) => !used.has(w.id)).map((w) => w.id);
console.log('not in any lesson (dictionary only):', unused.join(', ') || 'none');
console.log(problems ? `${problems} problems` : 'all good');
process.exit(problems ? 1 : 0);
