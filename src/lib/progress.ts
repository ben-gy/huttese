/**
 * All learner state lives in localStorage – there are no accounts and no backend.
 * Every read/write is guarded so private windows or blocked storage still work (progress just won't stick).
 */

const KEY = 'huttese:v1';

export interface LessonRecord {
  done: number; // times completed
  best: number; // best accuracy 0..1
  last: string; // ISO date
}

export interface WordStat {
  right: number;
  wrong: number;
  seen: string; // ISO date last seen
}

export interface Progress {
  xp: number;
  dailyGoal: number;
  days: Record<string, number>; // 'YYYY-MM-DD' -> xp earned that day
  lessons: Record<string, LessonRecord>;
  words: Record<string, WordStat>;
  settings: { sound: boolean; speech: boolean; latin: boolean; theme?: '' | 'light' | 'dark' };
}

const fresh = (): Progress => ({
  xp: 0,
  dailyGoal: 30,
  days: {},
  lessons: {},
  words: {},
  settings: { sound: true, speech: true, latin: true },
});

export function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw);
    const base = fresh();
    return { ...base, ...p, settings: { ...base.settings, ...(p.settings ?? {}) } };
  } catch {
    return fresh();
  }
}

export function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable – keep going in memory */
  }
}

export function update(fn: (p: Progress) => void): Progress {
  const p = load();
  fn(p);
  save(p);
  return p;
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function exportJSON(): string {
  return JSON.stringify(load(), null, 2);
}

export function importJSON(text: string): boolean {
  try {
    const p = JSON.parse(text);
    if (typeof p !== 'object' || p === null || typeof p.xp !== 'number') return false;
    save({ ...fresh(), ...p });
    return true;
  } catch {
    return false;
  }
}

export function today(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Consecutive days (ending today, or yesterday if today has no XP yet) with any XP. */
export function streak(p: Progress): number {
  const d = new Date();
  if (!p.days[today(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (p.days[today(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function todayXp(p: Progress): number {
  return p.days[today()] ?? 0;
}

export function recordLesson(id: string, accuracy: number, xp: number, wordResults: Record<string, boolean[]>) {
  return update((p) => {
    const t = today();
    p.xp += xp;
    p.days[t] = (p.days[t] ?? 0) + xp;
    const prev = p.lessons[id];
    p.lessons[id] = {
      done: (prev?.done ?? 0) + 1,
      best: Math.max(prev?.best ?? 0, accuracy),
      last: new Date().toISOString(),
    };
    for (const [w, results] of Object.entries(wordResults)) {
      const s = p.words[w] ?? { right: 0, wrong: 0, seen: '' };
      for (const ok of results) ok ? s.right++ : s.wrong++;
      s.seen = new Date().toISOString();
      p.words[w] = s;
    }
  });
}

/** 0 (weak) .. 1 (strong). Decays a little with time since last seen. */
export function strength(s: WordStat | undefined): number {
  if (!s) return 0;
  const total = s.right + s.wrong;
  const acc = (s.right + 1) / (total + 2);
  const volume = Math.min(1, s.right / 6);
  const days = (Date.now() - Date.parse(s.seen || '0')) / 86_400_000;
  const decay = Math.max(0.4, 1 - days / 30);
  return acc * volume * decay;
}
