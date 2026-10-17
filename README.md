# Huttese

A Duolingo-style course for Huttese, the language of Jabba the Hutt. It's a static Astro site deployed to Cloudflare as Workers static assets. There are no accounts and no backend: all progress lives in `localStorage`.

## What's in it

- **7 units, 36 lessons**: script lessons, vocabulary lessons and phrase lessons, plus a guidebook of grammar tips for each unit.
- **Exercise types**: new-word cards, multiple choice in both directions, listen-and-choose, pick the pronunciation, read the Hutt script, type the answer (forgives small typos, accepts synonyms), match pairs, build the sentence, and spell a word in glyphs.
- **Duolingo mechanics**: 5 hearts per lesson, missed questions come back at the end, XP, a daily goal, a streak, sequential unlocking, and a Practice mode built from your weakest words.
- **Phonetics**: every entry has an English respelling (stressed syllable in CAPS) and IPA. Audio uses the browser's speech synthesis, pitched down Hutt-style; nothing is shipped as audio files.
- **Hutt script**: an original phonetic glyph set (`src/lib/script.ts`) with one glyph per sound and digraph glyphs for *ch, sh, oo, ee*. It is rendered as inline SVG. The `/script` page has the full chart and a live transliterator.
- **Dictionary**: all 145 entries, searchable, with memory-strength bars. **Settings**: toggles, theme, daily goal, and export/import/reset of progress.

## Data

`src/data/vocab.ts` holds the words and phrases. Most come from Ben Burtt's *Galactic Phrase Book & Travel Guide* (2001) and film dialogue. Entries with `sure: false` come only from fan glossaries, and the dictionary flags them. `src/data/course.ts` arranges the entries into units and lessons by id.

## Commands

```bash
npm run dev       # local dev server
npm test          # sanity-check every lesson: ids resolve, no ambiguous options, banks contain answers
npm run build     # static build to dist/
npm run deploy    # build + wrangler deploy
```

Unofficial fan project. Star Wars, Jabba the Hutt and Huttese are trademarks of Lucasfilm Ltd.
