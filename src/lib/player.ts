import type { Exercise, Item } from './types';
import { renderScript, renderGlyph, tokenize } from './script';
import { speak, sfx, canSpeak } from './audio';
import { checkTyped, equivalents, firstMeaning, shuffle } from './engine';
import { WORDS } from '../data/course';
import * as store from './progress';

const MAX_HEARTS = 5;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Handle {
  ready: () => boolean;
  check: () => { ok: boolean; typo?: boolean; answer: string };
  autoAdvance?: boolean; // intro + match manage their own completion
}

export interface PlayerOptions {
  lessonId: string;
  title: string;
  exercises: Exercise[];
  practice?: boolean;
}

export function mountPlayer(root: HTMLElement, opts: PlayerOptions) {
  const settings = store.load().settings;
  document.body.classList.toggle('no-latin', !settings.latin);

  const stage = root.querySelector<HTMLElement>('[data-stage]')!;
  const footer = root.querySelector<HTMLElement>('[data-footer]')!;
  const fill = root.querySelector<HTMLElement>('[data-fill]')!;
  const heartsEl = root.querySelector<HTMLElement>('[data-hearts]')!;
  const btn = root.querySelector<HTMLButtonElement>('[data-action]')!;
  const feedback = root.querySelector<HTMLElement>('[data-feedback]')!;

  let queue = opts.exercises.slice();
  let pos = 0;
  let hearts = MAX_HEARTS;
  let graded = 0;
  let firstTryRight = 0;
  const missed = new Set<Exercise>();
  const results: Record<string, boolean[]> = {};
  const started = Date.now();
  let handle: Handle | null = null;
  let phase: 'answer' | 'feedback' | 'done' = 'answer';
  const gradedTotal = queue.filter((e) => e.type !== 'intro').length;

  const say = (it: Item, slow = false) => {
    if (settings.speech && it.kind !== 'glyph') speak(it.pron, { slow });
  };
  const play = (fn: () => void) => settings.sound && fn();

  function setProgress() {
    const doneCount = queue.slice(0, pos).filter((e) => e.type !== 'intro' && !missedAgainLater(e)).length;
    fill.style.width = `${Math.min(100, (doneCount / Math.max(1, gradedTotal)) * 100)}%`;
    heartsEl.textContent = String(hearts);
    heartsEl.parentElement!.classList.toggle('low', hearts <= 1);
  }
  // An exercise that was missed and re-queued later shouldn't count twice towards progress.
  const missedAgainLater = (e: Exercise) => queue.indexOf(e, pos) !== -1;

  function setButton(label: string, enabled: boolean, tone: '' | 'right' | 'wrong' = '') {
    btn.textContent = label;
    btn.disabled = !enabled;
    btn.dataset.tone = tone;
  }

  function show() {
    setProgress();
    footer.dataset.state = '';
    feedback.innerHTML = '';
    phase = 'answer';
    if (pos >= queue.length) return finish();
    const ex = queue[pos];
    if (import.meta.env.DEV) (window as unknown as { __ex: Exercise }).__ex = ex; // for automated play-testing
    stage.classList.remove('enter');
    void stage.offsetWidth;
    stage.classList.add('enter');
    handle = render(ex);
    if (handle.autoAdvance) setButton(ex.type === 'intro' ? 'Continue' : 'Check', ex.type === 'intro');
    else setButton('Check', false);
    stage.querySelector<HTMLElement>('input, [data-autofocus]')?.focus();
  }

  const changed = () => {
    if (phase === 'answer' && handle) btn.disabled = !handle.ready();
  };

  function onAction() {
    const ex = queue[pos];
    if (phase === 'feedback') {
      if (hearts <= 0) return outOfHearts();
      pos++;
      return show();
    }
    if (phase === 'done') return;
    if (!handle) return;
    if (ex.type === 'intro') {
      pos++;
      return show();
    }
    if (ex.type === 'match') {
      if (handle.ready()) grade(ex, true, '');
      return;
    }
    if (!handle.ready()) return;
    const r = handle.check();
    grade(ex, r.ok, r.answer, r.typo);
  }

  function grade(ex: Exercise, ok: boolean, answer: string, typo = false) {
    phase = 'feedback';
    graded++;
    stage.querySelectorAll<HTMLElement>('button, input').forEach((b) => b.setAttribute('disabled', ''));
    const it = 'item' in ex ? ex.item : null;
    if (it) (results[it.id] ??= []).push(ok);
    if (ok) {
      if (!missed.has(ex)) firstTryRight++;
      play(sfx.right);
      footer.dataset.state = 'right';
      const praise = shuffle(['Nice!', 'Great!', 'Correct!', 'Mighty Jabba approves.', 'Wonderful!', 'Excellent!'])[0];
      feedback.innerHTML = `<strong>${typo ? 'Almost – watch the spelling:' : praise}</strong>${
        typo ? `<span>${esc(answer)}</span>` : it?.note && it.kind !== 'glyph' ? `<span class="fb-note">${esc(it.note)}</span>` : ''
      }`;
      setButton('Continue', true, 'right');
    } else {
      missed.add(ex);
      hearts--;
      play(sfx.wrong);
      footer.dataset.state = 'wrong';
      feedback.innerHTML = `<strong>Correct answer:</strong><span>${esc(answer)}</span>`;
      setButton('Got it', true, 'wrong');
      queue.push(ex); // try it again at the end, Duolingo-style
      root.querySelector('.hearts')?.classList.add('shake');
      setTimeout(() => root.querySelector('.hearts')?.classList.remove('shake'), 500);
    }
    if (it && ok && ex.type !== 'choose') say(it);
    setProgress();
    if (hearts <= 0) setButton('Continue', true, 'wrong');
  }

  function outOfHearts() {
    phase = 'done';
    footer.dataset.state = '';
    feedback.innerHTML = '';
    stage.innerHTML = `
      <div class="end">
        <div class="end-art" aria-hidden="true">💔</div>
        <h2>Out of hearts</h2>
        <p>Jabba is unimpressed. <em>“Poodoo!”</em> Give it another go – practice makes perfect.</p>
      </div>`;
    setButton('Try again', true);
    btn.onclick = () => location.reload();
    const quit = document.createElement('a');
    quit.href = '/';
    quit.className = 'btn ghost';
    quit.textContent = 'Back to path';
    footer.querySelector('.footer-inner')!.prepend(quit);
  }

  function finish() {
    phase = 'done';
    const accuracy = graded ? firstTryRight / gradedTotal : 1;
    const perfect = missed.size === 0;
    const xp = opts.practice ? 10 + firstTryRight : 10 + Math.round(gradedTotal * 0.5) + (perfect ? 5 : 0);
    const before = store.load();
    const hadStreakToday = store.todayXp(before) > 0;
    const p = store.recordLesson(opts.lessonId, Math.min(1, accuracy), xp, results);
    const secs = Math.round((Date.now() - started) / 1000);
    play(sfx.done);
    fill.style.width = '100%';
    const streakNow = store.streak(p);
    stage.innerHTML = `
      <div class="end">
        <div class="end-art" aria-hidden="true">${perfect ? '🏆' : '⭐'}</div>
        <h2>${opts.practice ? 'Practice complete!' : 'Lesson complete!'}</h2>
        <p class="end-sub">${perfect ? 'Flawless. Even Bib Fortuna is impressed.' : esc(opts.title)}</p>
        <div class="stats">
          <div class="stat xp"><span>Total XP</span><strong>+${xp}</strong></div>
          <div class="stat acc"><span>Accuracy</span><strong>${Math.round(Math.min(1, accuracy) * 100)}%</strong></div>
          <div class="stat time"><span>Time</span><strong>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</strong></div>
        </div>
        ${!hadStreakToday ? `<p class="streak-up">🔥 ${streakNow} day streak${streakNow > 1 ? '!' : ' started!'}</p>` : ''}
        ${store.todayXp(p) >= p.dailyGoal && store.todayXp(before) < p.dailyGoal ? '<p class="streak-up">🎯 Daily goal reached!</p>' : ''}
      </div>`;
    footer.dataset.state = '';
    feedback.innerHTML = '';
    setButton('Continue', true);
    btn.onclick = () => (location.href = '/');
  }

  // ---------- renderers ----------

  function speakerBtn(it: Item, big = false) {
    if (!settings.speech || !canSpeak() || it.kind === 'glyph') return '';
    return `<button type="button" class="speaker${big ? ' big' : ''}" data-say aria-label="Play pronunciation">🔊</button>${
      big ? '<button type="button" class="speaker slow" data-say-slow aria-label="Play slowly">🐌</button>' : ''
    }`;
  }

  function wireSpeaker(it: Item) {
    stage.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => say(it)));
    stage.querySelectorAll('[data-say-slow]').forEach((b) => b.addEventListener('click', () => say(it, true)));
  }

  const hutBlock = (it: Item, size = 34) =>
    `<div class="hut-block">${renderScript(it.hut, { size })}<div class="latin-sub">${esc(it.hut)}</div></div>`;

  function optionHTML(o: Item, show: string) {
    switch (show) {
      case 'en':
        return `<span class="opt-en">${esc(o.en)}</span>`;
      case 'pron':
        return `<span class="opt-pron">${esc(o.pron)}</span><span class="opt-ipa">${esc(o.ipa)}</span>`;
      case 'glyph':
        return renderGlyph(o.hut, 54);
      case 'latin':
        return `<span class="opt-latin">${esc(o.hut)}</span>`;
      default:
        return `${renderScript(o.hut, { size: 20 })}<span class="opt-hut latin-sub">${esc(o.hut)}</span>`;
    }
  }

  function answerText(it: Item, show: string) {
    if (show === 'en') return it.en;
    if (show === 'pron') return `${it.pron}  ${it.ipa}`;
    if (show === 'glyph' || show === 'latin') return `${it.hut.toUpperCase()} – ${it.en}`;
    return it.hut;
  }

  function render(ex: Exercise): Handle {
    switch (ex.type) {
      case 'intro':
        return renderIntro(ex.item);
      case 'choose':
        return renderChoose(ex);
      case 'match':
        return renderMatch(ex);
      case 'type':
        return renderType(ex.item);
      case 'build':
        return renderBuild(ex);
      case 'spell':
        return renderSpell(ex);
    }
  }

  function renderIntro(it: Item): Handle {
    if (it.kind === 'glyph') {
      const examples = WORDS.filter((w) => tokenize(w.hut).includes(it.hut)).slice(0, 3);
      stage.innerHTML = `
        <div class="intro">
          <span class="tag">New glyph</span>
          <div class="intro-glyph">${renderGlyph(it.hut, 120)}</div>
          <div class="intro-letter">${esc(it.hut)}</div>
          <p class="intro-sound">Sounds like ${esc(it.en)} <span class="ipa">${esc(it.ipa)}</span></p>
          ${
            examples.length
              ? `<div class="examples"><span>Seen in</span>${examples
                  .map((w) => `<div class="example">${renderScript(w.hut, { size: 22 })}<small>${esc(w.hut)} – ${esc(firstMeaning(w.en))}</small></div>`)
                  .join('')}</div>`
              : ''
          }
        </div>`;
    } else {
      stage.innerHTML = `
        <div class="intro">
          <span class="tag">${it.kind === 'phrase' ? 'New phrase' : 'New word'}</span>
          <div class="intro-script">${renderScript(it.hut, { size: it.hut.length > 18 ? 30 : 44 })}</div>
          <div class="intro-hut">${esc(it.hut)} ${speakerBtn(it, true)}</div>
          <div class="intro-pron"><span class="pron">${esc(it.pron)}</span><span class="ipa">${esc(it.ipa)}</span></div>
          <div class="intro-en">${esc(it.en)}</div>
          ${
            it.gloss?.length
              ? `<div class="gloss">${it.gloss.map(([h, e]) => `<div><b>${esc(h)}</b><span>${esc(e)}</span></div>`).join('')}</div>`
              : ''
          }
          ${it.note ? `<p class="intro-note">${esc(it.note)}</p>` : ''}
        </div>`;
      wireSpeaker(it);
      setTimeout(() => say(it), 250);
    }
    return { ready: () => true, check: () => ({ ok: true, answer: '' }), autoAdvance: true };
  }

  function renderChoose(ex: Extract<Exercise, { type: 'choose' }>): Handle {
    const it = ex.item;
    let prompt = '';
    if (ex.prompt === 'hut' && ex.show === 'pron')
      prompt = `<h2>How do you pronounce this?</h2><div class="prompt-card">${hutBlock(it)}</div>`;
    else if (ex.prompt === 'hut')
      prompt = `<h2>What does this mean?</h2><div class="prompt-card">${speakerBtn(it)}${hutBlock(it)}</div>`;
    else if (ex.prompt === 'en') prompt = `<h2>Select the Huttese for</h2><div class="prompt-en">“${esc(it.kind === 'phrase' ? firstMeaning(it.en) : it.en)}”</div>`;
    else if (ex.prompt === 'audio')
      prompt = `<h2>What do you hear?</h2><div class="prompt-audio">${speakerBtn(it, true)}</div>`;
    else if (ex.prompt === 'script')
      prompt = `<h2>Read the Hutt script</h2><div class="prompt-card script-only">${renderScript(it.hut, { size: 48 })}</div>`;
    else if (ex.prompt === 'glyph')
      prompt = `<h2>Which letter is this glyph?</h2><div class="prompt-card">${renderGlyph(it.hut, 110)}</div>`;
    else if (ex.prompt === 'pron')
      prompt = `<h2>Which glyph makes this sound?</h2><div class="prompt-en">${esc(it.hut.toUpperCase())} – ${esc(it.en)} <span class="ipa">${esc(it.ipa)}</span></div>`;

    stage.innerHTML = `${prompt}<div class="options ${ex.show}" role="radiogroup">${ex.options
      .map(
        (o, i) =>
          `<button type="button" class="option" role="radio" aria-checked="false" data-i="${i}"><kbd>${i + 1}</kbd>${optionHTML(o, ex.show)}</button>`,
      )
      .join('')}</div>`;
    wireSpeaker(it);
    if (ex.prompt === 'audio' || (ex.prompt === 'hut' && ex.show !== 'pron')) setTimeout(() => say(it), 300);

    let chosen = -1;
    const buttons = [...stage.querySelectorAll<HTMLButtonElement>('.option')];
    buttons.forEach((b, i) =>
      b.addEventListener('click', () => {
        chosen = i;
        buttons.forEach((x, j) => {
          x.classList.toggle('selected', j === i);
          x.setAttribute('aria-checked', String(j === i));
        });
        play(sfx.tap);
        if (ex.show === 'hut' && ex.prompt !== 'audio') say(ex.options[i]);
        changed();
      }),
    );
    return {
      ready: () => chosen >= 0,
      check: () => {
        const ok = ex.options[chosen].id === it.id;
        buttons.forEach((b, i) => {
          if (ex.options[i].id === it.id) b.classList.add('is-right');
          else if (i === chosen) b.classList.add('is-wrong');
        });
        return { ok, answer: answerText(it, ex.show) };
      },
    };
  }

  function renderMatch(ex: Extract<Exercise, { type: 'match' }>): Handle {
    const left = shuffle(ex.items);
    const right = shuffle(ex.items);
    const cell = (it: Item, side: 'l' | 'r') => {
      if (side === 'l') return ex.left === 'glyph' ? renderGlyph(it.hut, 40) : `<span>${esc(it.hut)}</span>`;
      return ex.right === 'latin' ? `<span class="opt-latin">${esc(it.hut)}</span>` : `<span>${esc(firstMeaning(it.en))}</span>`;
    };
    stage.innerHTML = `<h2>Tap the matching pairs</h2>
      <div class="match">
        <div class="col">${left.map((it) => `<button type="button" class="tile" data-side="l" data-id="${esc(it.id)}">${cell(it, 'l')}</button>`).join('')}</div>
        <div class="col">${right.map((it) => `<button type="button" class="tile" data-side="r" data-id="${esc(it.id)}">${cell(it, 'r')}</button>`).join('')}</div>
      </div>`;
    let sel: HTMLButtonElement | null = null;
    let matched = 0;
    let mistakes = 0;
    stage.querySelectorAll<HTMLButtonElement>('.tile').forEach((t) =>
      t.addEventListener('click', () => {
        if (t.classList.contains('done')) return;
        if (t.dataset.side === 'l' && ex.left === 'hut') {
          const it = ex.items.find((i) => i.id === t.dataset.id);
          if (it) say(it);
        }
        if (!sel || sel.dataset.side === t.dataset.side) {
          sel?.classList.remove('selected');
          sel = t;
          t.classList.add('selected');
          play(sfx.tap);
          return;
        }
        const a = sel;
        sel = null;
        a.classList.remove('selected');
        if (a.dataset.id === t.dataset.id) {
          a.classList.add('done');
          t.classList.add('done');
          matched++;
          play(sfx.tap);
          if (matched === ex.items.length) {
            for (const it of ex.items) (results[it.id] ??= []).push(true);
            setButton('Continue', true, 'right');
            footer.dataset.state = 'right';
            feedback.innerHTML = `<strong>${mistakes ? 'All matched!' : 'Perfect matching!'}</strong>`;
            play(sfx.right);
            phase = 'feedback';
            graded++;
            firstTryRight++;
            setProgress();
          }
        } else {
          mistakes++;
          [a, t].forEach((x) => x.classList.add('nope'));
          play(sfx.wrong);
          setTimeout(() => [a, t].forEach((x) => x.classList.remove('nope')), 450);
        }
      }),
    );
    return { ready: () => matched === ex.items.length, check: () => ({ ok: true, answer: '' }), autoAdvance: true };
  }

  function renderType(it: Item): Handle {
    stage.innerHTML = `<h2>Write this in Huttese</h2>
      <div class="prompt-en">“${esc(it.en)}”</div>
      <input class="type-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type in Huttese" aria-label="Your answer" />
      <div class="type-preview" aria-hidden="true"></div>
      <p class="hint">Hint: ${esc(it.pron)}</p>`;
    const input = stage.querySelector<HTMLInputElement>('input')!;
    const preview = stage.querySelector<HTMLElement>('.type-preview')!;
    input.addEventListener('input', () => {
      preview.innerHTML = input.value.trim() ? renderScript(input.value, { size: 26 }) : '';
      changed();
    });
    return {
      ready: () => input.value.trim().length > 0,
      check: () => {
        const targets = [it.hut, ...equivalents(it)];
        const rs = targets.map((t) => checkTyped(input.value, t));
        const r = rs.includes('right') ? 'right' : rs.includes('typo') ? 'typo' : 'wrong';
        const hit = targets[rs.indexOf(r)] ?? it.hut;
        input.classList.add(r === 'wrong' ? 'is-wrong' : 'is-right');
        return { ok: r !== 'wrong', typo: r === 'typo', answer: r === 'wrong' ? it.hut : hit };
      },
    };
  }

  function chipBoard(bank: string[], render: (t: string) => string, onChange: () => void) {
    const line = stage.querySelector<HTMLElement>('.answer-line')!;
    const bankEl = stage.querySelector<HTMLElement>('.bank')!;
    const picked: number[] = [];
    bankEl.innerHTML = bank.map((t, i) => `<button type="button" class="chip" data-i="${i}">${render(t)}</button>`).join('');
    const redraw = () => {
      line.innerHTML = picked.map((i) => `<button type="button" class="chip in" data-i="${i}">${render(bank[i])}</button>`).join('');
      bankEl.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => c.classList.toggle('used', picked.includes(+c.dataset.i!)));
      line.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) =>
        c.addEventListener('click', () => {
          if (phase !== 'answer') return;
          picked.splice(picked.indexOf(+c.dataset.i!), 1);
          play(sfx.tap);
          redraw();
        }),
      );
      onChange();
    };
    bankEl.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) =>
      c.addEventListener('click', () => {
        const i = +c.dataset.i!;
        if (picked.includes(i) || phase !== 'answer') return;
        picked.push(i);
        play(sfx.tap);
        redraw();
      }),
    );
    return () => picked.map((i) => bank[i]);
  }

  function renderBuild(ex: Extract<Exercise, { type: 'build' }>): Handle {
    const it = ex.item;
    let prompt = '';
    if (ex.direction === 'hut-en') prompt = `<h2>Translate this sentence</h2><div class="prompt-card">${speakerBtn(it)}${hutBlock(it, 28)}</div>`;
    else if (ex.direction === 'en-hut') prompt = `<h2>Say it in Huttese</h2><div class="prompt-en">“${esc(it.enBuild ?? firstMeaning(it.en))}”</div>`;
    else prompt = `<h2>Tap what you hear</h2><div class="prompt-audio">${speakerBtn(it, true)}</div>`;
    stage.innerHTML = `${prompt}<div class="answer-line" aria-label="Your answer"></div><div class="bank"></div>`;
    wireSpeaker(it);
    if (ex.direction !== 'en-hut') setTimeout(() => say(it), 300);
    const get = chipBoard(ex.bank, (t) => esc(t), changed);
    return {
      ready: () => get().length > 0,
      check: () => {
        const ok = get().join(' ') === ex.answer.join(' ');
        return { ok, answer: ex.direction === 'hut-en' ? it.enBuild ?? firstMeaning(it.en) : it.hut };
      },
    };
  }

  function renderSpell(ex: Extract<Exercise, { type: 'spell' }>): Handle {
    const it = ex.item;
    stage.innerHTML = `<h2>Spell it in Hutt script</h2>
      <div class="prompt-en">${esc(it.hut)} <span class="ipa">${esc(it.pron)}</span></div>
      <p class="hint">${esc(firstMeaning(it.en))}</p>
      <div class="answer-line glyphs" aria-label="Your answer"></div><div class="bank glyphs"></div>`;
    const get = chipBoard(ex.bank, (k) => renderGlyph(k, 34), changed);
    return {
      ready: () => get().length > 0,
      check: () => ({ ok: get().join('|') === ex.answer.join('|'), answer: `${it.hut} (${ex.answer.join(' · ')})` }),
    };
  }

  // ---------- controls ----------

  btn.addEventListener('click', () => {
    if (phase !== 'done') onAction();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (!btn.disabled) {
        e.preventDefault();
        btn.click();
      }
      return;
    }
    if (phase !== 'answer' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9) stage.querySelectorAll<HTMLButtonElement>('.option')[n - 1]?.click();
  });

  show();
}
