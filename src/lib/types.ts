export interface Word {
  id: string;
  hut: string; // Huttese, latin spelling
  en: string; // English meaning(s), alternatives separated by " / "
  pron: string; // English respelling, stressed syllable in caps
  ipa: string;
  cat: string;
  note?: string;
}

export interface Phrase extends Word {
  /** Word-by-word gloss shown on the intro card, e.g. [["koona", "where"], ...] */
  gloss?: [string, string][];
  /** Short English answer used for "build the sentence" (defaults to the first `en` alternative). */
  enBuild?: string;
}

export interface Lesson {
  id: string;
  title: string;
  kind: 'glyphs' | 'words' | 'phrases';
  glyphs?: string[];
  words?: string[]; // word ids
  phrases?: string[]; // phrase ids
}

export interface Unit {
  id: string;
  title: string;
  blurb: string;
  colour: string; // css colour token name
  lessons: Lesson[];
}

/** Anything that can be quizzed: a word, phrase or glyph normalised to one shape. */
export interface Item {
  id: string;
  hut: string;
  en: string;
  pron: string;
  ipa: string;
  note?: string;
  kind: 'word' | 'phrase' | 'glyph';
  gloss?: [string, string][];
  enBuild?: string;
}

export type Exercise =
  | { type: 'intro'; item: Item }
  | {
      type: 'choose';
      item: Item;
      prompt: 'hut' | 'en' | 'audio' | 'script' | 'glyph' | 'pron';
      show: 'hut' | 'en' | 'pron' | 'glyph' | 'latin';
      options: Item[];
    }
  | { type: 'match'; items: Item[]; left: 'hut' | 'glyph'; right: 'en' | 'latin' }
  | { type: 'type'; item: Item }
  | { type: 'build'; item: Item; direction: 'hut-en' | 'en-hut' | 'audio-hut'; answer: string[]; bank: string[] }
  | { type: 'spell'; item: Item; answer: string[]; bank: string[] };
