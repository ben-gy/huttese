import type { Lesson, Unit } from '../lib/types';
import { WORDS, PHRASES, GRAMMAR } from './vocab';

export { WORDS, PHRASES, GRAMMAR };

const g = (id: string, title: string, glyphs: string[]): Lesson => ({ id, title, kind: 'glyphs', glyphs });
const w = (id: string, title: string, words: string[]): Lesson => ({ id, title, kind: 'words', words });
const p = (id: string, title: string, phrases: string[]): Lesson => ({ id, title, kind: 'phrases', phrases });

export interface UnitWithTips extends Unit {
  tips: { title: string; text: string }[];
}

const tip = (title: string) => {
  const t = GRAMMAR.find((x) => x.title === title)!;
  return { title: t.title, text: t.text };
};

export const UNITS: UnitWithTips[] = [
  {
    id: 'u1',
    title: 'First Words',
    blurb: 'Read your first Hutt glyphs and greet His Excellency properly.',
    colour: 'hutt',
    tips: [
      tip('-a endings'),
      tip('no please / thank you'),
      {
        title: 'Reading the respellings',
        text: 'Pronunciations are written as English-style respellings: the syllable in CAPITALS is stressed. “BOH SHOO-dah” = boh SHOO-dah. Vowels are mostly pure, as in Spanish: a = ah, e = eh, i/ee = ee, o = oh, u/oo = oo. In short closed syllables the respellings use English short vowels instead (shag, chik, BUN-kee).',
      },
    ],
    lessons: [
      g('script-vowels', 'Glyphs: the vowels', ['a', 'e', 'i', 'o', 'u']),
      w('greetings', 'Greetings', ['bo-shuda', 'h-chu-apenkee', 'achuta', 'chowbaso', 'mee-jewz-ku']),
      g('script-stops', 'Glyphs: b d p t k g', ['b', 'd', 'p', 't', 'k', 'g']),
      w('yes-no', 'Yes, no & wow', ['tagwa', 'nobata', 'nagoola', 'chut-chut', 'inkabunga']),
      p('first-phrases', 'Cantina chatter', ['koona-t-chuta', 'hi-chuba-da-naga', 'han-ma-bukee']),
    ],
  },
  {
    id: 'u2',
    title: 'People of the Palace',
    blurb: 'Pronouns, friends, bosses and the riff-raff of Jabba’s court.',
    colour: 'blue',
    tips: [tip('jee / jee-jee'), tip('ma + noun')],
    lessons: [
      g('script-sonorants', 'Glyphs: m n l s h r', ['m', 'n', 'l', 's', 'h', 'r']),
      w('pronouns', 'I, you & we', ['jee', 'jee-jee', 'uba', 'chuba', 'ma', 'hoohah']),
      w('friends', 'Friends & bosses', ['pateesa', 'lorda', 'peedunkee', 'bukee', 'cheeka', 'cheekta']),
      w('court', 'The court', ['murishani', 'ulwan', 'ootmian', 'jeedai', 'droi', 'wooky']),
      p('peace', 'Making friends', ['dolpee-kikyuna', 'nee-dolya-pukee-toba', 'koose-cheekta-nei']),
    ],
  },
  {
    id: 'u3',
    title: 'Counting Like a Hutt',
    blurb: 'Hutts count in eights. Master the numbers before you haggle.',
    colour: 'amber',
    tips: [
      tip('base-8 counting'),
      {
        title: 'One glyph, one sound',
        text: 'The digraphs ch, sh, oo and ee each get a single glyph, so Hutt script stays phonetic: every glyph is one sound.',
      },
    ],
    lessons: [
      g('script-digraphs', 'Glyphs: ch sh oo ee', ['ch', 'sh', 'oo', 'ee']),
      w('numbers-1', 'Numbers 0–4', ['nobo', 'bo', 'dopa', 'duba', 'fwanna']),
      w('numbers-2', 'Numbers 5–9', ['k-wanna', 'keeta', 'goba', 'hunto', 'beeska']),
      g('script-jwy', 'Glyphs: j w y', ['j', 'w', 'y']),
      w('numbers-3', 'Numbers 10–13', ['boboba', 'goboba', 'joboba', 'soboba']),
      w('numbers-4', 'Big numbers', ['koboba', 'foboba', 'donocha', 'jujumon']),
    ],
  },
  {
    id: 'u4',
    title: 'Mos Espa Market',
    blurb: 'Money, bargains and snacks. Watto does not take Republic credits.',
    colour: 'violet',
    tips: [
      {
        title: 'Tatooine money',
        text: '16 wupiupi = 1 trugut, and 4 truguts (64 wupiupi) = 1 peggat. Wupiupi is the same in singular and plural.',
      },
    ],
    lessons: [
      g('script-rest', 'Glyphs: f v z c q x', ['f', 'v', 'z', 'c', 'q', 'x']),
      w('money', 'Money', ['wupiupi', 'trugut', 'peggat', 'moulee-rah', 'che-copah']),
      w('trading', 'Trading', ['bargon', 'wamma', 'dwana', 'bedwana', 'makacheesa']),
      w('food', 'Food & drink', ['yocola', 'gocola', 'yafullkee', 'smak-telia', 'patogga', 'waffmula']),
      w('deals', 'Shady deals', ['nibobo', 'gopptula', 'buttmalia', 'lickmoomoo', 'kayfoundo', 'hotsa']),
      p('haggling', 'Haggling', ['kava-che-copah', 'wanta-dah-moolee-rah', 'bargon-wan-chee-kospah']),
    ],
  },
  {
    id: 'u5',
    title: 'Questions & Commands',
    blurb: 'Ask who, what and where – then bark orders like a crime lord.',
    colour: 'blue',
    tips: [tip('question word first')],
    lessons: [
      w('questions', 'Question words', ['haku', 'konchee', 'kava', 'joppay', 'coo']),
      w('actions-1', 'Get moving', ['bolla', 'boska', 'yatuka', 'doopee', 'koose', 'naga']),
      w('actions-2', 'Everyday verbs', ['stuka', 'tinka', 'hopa', 'panwa', 'winkee', 'kyotopa']),
      w('actions-3', 'Dangerous verbs', ['killee', 'nee-choo', 'moocha', 'cheeska', 'keepuna', 'rundee']),
      p('commands', 'Orders from the throne', ['hagwa-doopee', 'ap-xmasi-keepuna', 'coona-tee-tocky-malia', 'nudd-chaa']),
    ],
  },
  {
    id: 'u6',
    title: 'Jabba’s Insults',
    blurb: 'The most useful part of any Huttese course. Use responsibly.',
    colour: 'red',
    tips: [
      {
        title: 'Poodoo',
        text: 'Poodoo (“fodder”) is the all-purpose Huttese swear word. Calling someone bantha poodoo (bantha fodder) says they’re no better than animal feed. It is often thought to mean dung – it doesn’t.',
      },
    ],
    lessons: [
      w('insults-1', 'Classic insults', ['poodoo', 'bantha-poodoo', 'sleemo', 'wermo', 'koochoo', 'stupa']),
      w('insults-2', 'Advanced rudeness', ['kung', 'e-chu-ta', 'sleemo-poy', 'cheeskar-nok', 'loca', 'goola']),
      p('insult-phrases', 'Trash talk', ['wee-now-kong-bantha-poodoo', 'cha-skrunee-da-pat-sleemo', 'kee-baatu-baatu', 'no-bata-tu-tu']),
    ],
  },
  {
    id: 'u7',
    title: 'The Boonta Eve Classic',
    blurb: 'Ships, blasters and podraces across the Outer Rim.',
    colour: 'hutt',
    tips: [],
    lessons: [
      w('galaxy', 'The galaxy', ['bunky-dunko', 'doma-toma', 'planeeto', 'pankpa', 'd-emperiolo-teesaw']),
      w('gear', 'Gear', ['wanga', 'blastoh', 'wankee', 'pawa', 'tee-tocky']),
      w('podrace', 'Race day', ['choppa-chawa', 'hodrudda', 'shag', 'chik-youngee', 'magoosa']),
      w('palace-life', 'Palace life', ['na-yoka', 'howdunga', 'hunka-be']),
      p('famous-lines', 'Famous lines', ['kaa-bazza-kundee-hodrudda', 'soong-peetch-alay', 'keel-ee-calleya-ku-kah']),
      p('more-lines', 'Last words', ['kee-hasa-do-blastoh', 'dopo-me-goola', 'gi-shatta-gasha']),
    ],
  },
];

export const ALL_LESSONS: Lesson[] = UNITS.flatMap((u) => u.lessons);

export const unitOf = (lessonId: string) => UNITS.find((u) => u.lessons.some((l) => l.id === lessonId))!;

export function wordById(id: string) {
  const w = WORDS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown word id: ${id}`);
  return w;
}
export function phraseById(id: string) {
  const p = PHRASES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown phrase id: ${id}`);
  return p;
}

export const lessonIcon = (l: Lesson) => (l.kind === 'glyphs' ? '✎' : l.kind === 'phrases' ? '💬' : '★');
