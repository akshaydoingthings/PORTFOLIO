'use strict';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ----------------------------------------------------------
   REACT BITS CROSSHAIR CURSOR (VANILLA ADAPTATION)
   ---------------------------------------------------------- */
;(function initCrosshair() {
  if (reducedMotion || window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches) {
    return;
  }

  const canvas = document.getElementById('crosshair-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const settings = {
    color: '#EADCC9',
    thickness: 1,
    opacity: 0.52,
    lineStyle: 'solid',
    gap: 4,
    fade: 0,
    smoothing: 0.28,
    showCoordinates: false,
    targetEffect: 'lock',
    targetSelector: 'a, button, [data-crosshair-target], .project-card, .term-action-btn, .term-tab, .tech-filter-pill, .stat-pill, .interactive-human-card, .side-toc-link',
    clickPulse: true,
  };

  const toRgb = (c) => {
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    const value = String(ctx.fillStyle);
    if (value.startsWith('#')) {
      const hex = parseInt(value.slice(1, 7), 16);
      return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255, a: 1 };
    }
    const parts = value.match(/[\d.]+/g)?.map(Number) ?? [234, 220, 201, 1];
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  };

  const state = {
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    clientX: 0,
    clientY: 0,
    inside: false,
    seen: false,
    presence: 0,
    target: null,
    lock: { x: 0, y: 0, w: 0, h: 0, alpha: 0 },
    pulses: [],
  };

  const size = { w: 0, h: 0, dpr: 1 };
  let ink = toRgb(settings.color);
  let raf = 0;
  let last = 0;
  let alive = true;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    size.dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.w = rect.width;
    size.h = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * size.dpr));
    canvas.height = Math.max(1, Math.round(rect.height * size.dpr));
    wake();
  };

  const rgba = (alpha) => `rgba(${ink.r}, ${ink.g}, ${ink.b}, ${clamp(alpha * ink.a, 0, 1)})`;

  const crisp = (value, width) => {
    const device = Math.round(width * size.dpr);
    return (Math.round(value * size.dpr) + (device % 2 ? 0.5 : 0)) / size.dpr;
  };

  const segment = (x1, y1, x2, y2) => {
    ctx.strokeStyle = rgba(1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const brackets = (x, y, w, h, alpha) => {
    const arm = Math.min(14, w / 3, h / 3);
    ctx.strokeStyle = rgba(alpha);
    ctx.lineWidth = Math.max(1.5, settings.thickness);
    ctx.setLineDash([]);
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(x, y + arm);
    ctx.lineTo(x, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x + w - arm, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + arm);
    ctx.moveTo(x + w, y + h - arm);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - arm, y + h);
    ctx.moveTo(x + arm, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h - arm);
    ctx.stroke();
  };

  const draw = () => {
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    if (state.presence > 0.001) {
      ctx.globalAlpha = state.presence * settings.opacity * (1 - 0.6 * state.lock.alpha);
      ctx.lineWidth = settings.thickness;
      ctx.lineCap = 'butt';
      ctx.setLineDash([]);

      const x = crisp(state.x, settings.thickness);
      const y = crisp(state.y, settings.thickness);

      segment(0, y, Math.max(0, x - settings.gap), y);
      segment(Math.min(size.w, x + settings.gap), y, size.w, y);
      segment(x, 0, x, Math.max(0, y - settings.gap));
      segment(x, Math.min(size.h, y + settings.gap), x, size.h);
    }

    if (state.lock.alpha > 0.001) {
      const { x, y, w, h, alpha } = state.lock;
      ctx.globalAlpha = alpha * settings.opacity;
      brackets(x, y, w, h, 1);
    }

    state.pulses.forEach(pulse => {
      const t = pulse.age / 0.55;
      const eased = 1 - Math.pow(1 - t, 3);
      ctx.globalAlpha = Math.pow(1 - t, 2) * settings.opacity * 0.9;
      ctx.strokeStyle = rgba(1);
      ctx.lineWidth = Math.max(1, settings.thickness);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 3 + 26 * eased, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
  };

  const relative = () => {
    const rect = canvas.getBoundingClientRect();
    state.tx = state.clientX - rect.left;
    state.ty = state.clientY - rect.top;
    return rect;
  };

  const tick = (now) => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;

    const rect = relative();
    const follow = reducedMotion || settings.smoothing === 0 ? 1 : 1 - Math.exp(-dt / (0.008 + settings.smoothing * 0.16));
    state.x += (state.tx - state.x) * follow;
    state.y += (state.ty - state.y) * follow;

    const wanted = state.inside ? 1 : 0;
    state.presence += (wanted - state.presence) * (reducedMotion ? 1 : 1 - Math.exp(-dt / (wanted ? 0.12 : 0.25)));
    if (Math.abs(wanted - state.presence) < 0.002) state.presence = wanted;

    const lock = state.lock;
    const locked = settings.targetEffect === 'lock' && state.inside ? state.target : null;
    let goal;
    if (locked) {
      const box = locked.getBoundingClientRect();
      goal = { x: box.left - rect.left - 6, y: box.top - rect.top - 6, w: box.width + 12, h: box.height + 12 };
    } else {
      goal = { x: state.x - 10, y: state.y - 10, w: 20, h: 20 };
    }

    const snap = reducedMotion ? 1 : 1 - Math.exp(-dt / 0.085);
    lock.x += (goal.x - lock.x) * snap;
    lock.y += (goal.y - lock.y) * snap;
    lock.w += (goal.w - lock.w) * snap;
    lock.h += (goal.h - lock.h) * snap;

    const shown = locked ? 1 : 0;
    lock.alpha += (shown - lock.alpha) * (reducedMotion ? 1 : 1 - Math.exp(-dt / (shown ? 0.08 : 0.14)));
    if (Math.abs(shown - lock.alpha) < 0.002) lock.alpha = shown;

    state.pulses = state.pulses.filter(pulse => (pulse.age += dt) < 0.55);

    draw();

    const settling =
      Math.abs(state.tx - state.x) > 0.05 ||
      Math.abs(state.ty - state.y) > 0.05 ||
      state.presence !== wanted ||
      lock.alpha !== shown ||
      (locked && Math.abs(goal.w - lock.w) + Math.abs(goal.x - lock.x) + Math.abs(goal.y - lock.y) > 0.1) ||
      state.pulses.length > 0;

    if (settling) raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (raf || !alive) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const pick = (element) => {
    if (!(element instanceof Element)) return null;
    try {
      return element.closest(settings.targetSelector);
    } catch {
      return null;
    }
  };

  const retarget = (element) => {
    const next = pick(element);
    if (next === state.target) return;
    state.target = next;
  };

  const enter = () => {
    if (!state.seen) {
      state.seen = true;
      relative();
      state.x = state.tx;
      state.y = state.ty;
      state.lock.x = state.x - 10;
      state.lock.y = state.y - 10;
      state.lock.w = 20;
      state.lock.h = 20;
    }
    state.inside = true;
  };

  const leave = () => {
    state.inside = false;
    state.target = null;
    wake();
  };

  const onMove = (event) => {
    state.clientX = event.clientX;
    state.clientY = event.clientY;
    if (event.pointerType === 'touch' && event.buttons === 0) return;
    enter();
    retarget(event.target);
    wake();
  };

  const onDown = (event) => {
    onMove(event);
    if (!settings.clickPulse || reducedMotion) return;
    relative();
    state.pulses.push({ x: state.tx, y: state.ty, age: 0 });
    wake();
  };

  const onUp = (event) => {
    if (event.pointerType !== 'mouse') leave();
  };

  const onWindowOut = (event) => {
    if (!event.relatedTarget) leave();
  };

  const onScroll = () => {
    if (!state.inside) return;
    retarget(document.elementFromPoint(state.clientX, state.clientY));
    wake();
  };

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('pointerout', onWindowOut, { passive: true });

  resize();
})();

/* Year stamp */
$$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

/* Permanent dark theme */
document.documentElement.setAttribute('data-theme', 'dark');
const themeMeta = $('meta[name="theme-color"]');
if (themeMeta) themeMeta.setAttribute('content', '#08080A');

/* ----------------------------------------------------------
   SCROLL PROGRESS & BACK TO TOP
   ---------------------------------------------------------- */
const scrollProgress = $('#scroll-progress');
const backToTopBtn   = $('#back-to-top');
const progressCircle = $('#progress-circle');
const C = 2 * Math.PI * 19;

function onScroll() {
  const scrollY    = window.scrollY;
  const docH       = document.documentElement.scrollHeight - window.innerHeight;
  const progress   = docH > 0 ? clamp(scrollY / docH, 0, 1) : 0;

  if (scrollProgress) {
    scrollProgress.style.transform = `scaleX(${progress})`;
  }
  if (backToTopBtn) {
    backToTopBtn.classList.toggle('is-visible', scrollY > 380);
  }
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = String(C * (1 - progress));
  }
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

backToTopBtn?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ----------------------------------------------------------
   MOBILE NAVIGATION
   ---------------------------------------------------------- */
;(function initMobileNav() {
  const menuToggle = $('.menu-toggle');
  const siteNav    = $('#site-nav');
  if (!menuToggle || !siteNav) return;

  function toggle(force) {
    const isOpen = force !== undefined ? force : !siteNav.classList.contains('is-open');
    siteNav.classList.toggle('is-open', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    const span = menuToggle.querySelector('span');
    if (span) span.textContent = isOpen ? 'Close' : 'Menu';
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  menuToggle.addEventListener('click', () => toggle());
  siteNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => toggle(false));
  });
})();

/* ----------------------------------------------------------
   SCROLL SPY FOR SIDE TOC
   ---------------------------------------------------------- */
;(function initScrollSpy() {
  const links    = $$('.side-toc-link');
  const sections = [
    $('#top'), $('#about'), $('#work'), $('#contact'),
  ].filter(Boolean);

  if (!links.length || !sections.length) return;

  function spy() {
    const pos = window.scrollY + 220;
    let id = 'top';
    sections.forEach(s => {
      if (pos >= s.offsetTop && pos < s.offsetTop + s.offsetHeight) id = s.id;
    });
    links.forEach(l => l.classList.toggle('is-active', l.dataset.section === id));
  }

  window.addEventListener('scroll', spy, { passive: true });
  spy();
})();

/* ----------------------------------------------------------
   INTERSECTION REVEAL
   ---------------------------------------------------------- */
;(function initReveal() {
  const items = $$('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const obs = new IntersectionObserver((entries, o) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        o.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px' });
  items.forEach(el => obs.observe(el));
})();

/* ----------------------------------------------------------
   3D CARD TILT
   ---------------------------------------------------------- */
;(function initTilt() {
  if (reducedMotion || window.matchMedia('(hover: none)').matches) return;

  function initCard(card) {
    let tx = 0, ty = 0;
    let cx = 0, cy = 0;

    card.addEventListener('mousemove', e => {
      const r   = card.getBoundingClientRect();
      const x   = (e.clientX - r.left) / r.width  - 0.5;
      const y   = (e.clientY - r.top)  / r.height - 0.5;
      tx = y * -8;
      ty = x *  8;

      card.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
    });

    card.addEventListener('mouseleave', () => {
      tx = 0; ty = 0;
    });

    function frame() {
      cx = lerp(cx, tx, 0.1);
      cy = lerp(cy, ty, 0.1);
      card.style.transform = `perspective(800px) rotateX(${cx}deg) rotateY(${cy}deg)`;
      requestAnimationFrame(frame);
    }
    frame();
  }

  $$('.terminal-card, .project-card, .stat-pill').forEach(initCard);
})();

/* ----------------------------------------------------------
   TERMINAL TAB & CODE SIMULATOR
   ---------------------------------------------------------- */
;(function initTerminal() {
  const tabCodeBtn   = $('#tab-code-btn');
  const tabOutputBtn = $('#tab-output-btn');
  const paneCode     = $('#pane-code');
  const paneOutput   = $('#pane-output');
  const runBtn       = $('#run-terminal-btn');
  const copyBtn      = $('#copy-terminal-btn');
  const consoleOut   = $('#terminal-console-output');

  function switchTab(tab) {
    const isCode = tab === 'code';
    tabCodeBtn?.classList.toggle('is-active', isCode);
    tabCodeBtn?.setAttribute('aria-selected', String(isCode));
    tabOutputBtn?.classList.toggle('is-active', !isCode);
    tabOutputBtn?.setAttribute('aria-selected', String(!isCode));
    if (paneCode)   { paneCode.classList.toggle('is-active', isCode);   paneCode.hidden   = !isCode; }
    if (paneOutput) { paneOutput.classList.toggle('is-active', !isCode); paneOutput.hidden = isCode; }
  }

  tabCodeBtn?.addEventListener('click',   () => switchTab('code'));
  tabOutputBtn?.addEventListener('click', () => switchTab('output'));

  copyBtn?.addEventListener('click', async () => {
    const code = paneCode?.querySelector('code')?.innerText || '';
    try {
      await navigator.clipboard.writeText(code);
      const txt  = $('#copy-text');
      const icon = $('#copy-icon');
      if (txt)  txt.textContent  = 'Copied!';
      if (icon) icon.textContent = '✓';
      setTimeout(() => {
        if (txt)  txt.textContent  = 'Copy';
        if (icon) icon.textContent = '📋';
      }, 2000);
    } catch {}
  });

  runBtn?.addEventListener('click', () => {
    switchTab('output');
    if (!consoleOut) return;

    consoleOut.innerHTML = `
      <p class="console-line"><span class="console-prompt">$</span> <span class="console-cmd">node akshay.ts</span></p>
      <p class="console-line console-muted">Compiling... ░░░░░░░░░░░░░░░</p>
    `;

    const lines = [
      { cls: 'console-success', text: '✔ Compiled akshay.ts without errors [38ms]' },
      { cls: '',                text: '  ├─ Role: Computer Science Student & Builder' },
      { cls: '',                text: '  ├─ Institution: Chandigarh University' },
      { cls: '',                text: '  ├─ Origin: Meerut, Uttar Pradesh, India' },
      { cls: '',                text: '  ├─ Core Skills: Python · React · Node.js · Machine Learning' },
      { cls: '',                text: '  ├─ Systems Shipped: IntelliGap.AI · Portfolio v3 · ML Workbench' },
      { cls: 'console-accent',  text: '  └─ Status: Available for Summer 2027 Engineering Roles' },
      { cls: 'console-muted',   text: 'exit code 0. 🚀' },
    ];

    setTimeout(() => {
      consoleOut.innerHTML = `
        <p class="console-line"><span class="console-prompt">$</span> <span class="console-cmd">node akshay.ts</span></p>
      `;
      lines.forEach((line, i) => {
        setTimeout(() => {
          const p = document.createElement('p');
          p.className = `console-line ${line.cls}`;
          p.textContent = line.text;
          consoleOut.appendChild(p);
        }, i * 90);
      });
    }, 450);
  });
})();

/* ----------------------------------------------------------
   STAT COUNTERS
   ---------------------------------------------------------- */
;(function initCounters() {
  const stats = $$('.stat-number');
  let done = false;

  function animate() {
    if (done) return;
    done = true;
    stats.forEach(el => {
      const target = parseInt(el.dataset.count || '0', 10);
      const dur = 1400;
      const start = performance.now();
      (function tick(now) {
        const t = clamp((now - start) / dur, 0, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(ease * target));
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = String(target);
      })(start);
    });
  }

  const rail = $('.about-stats-rail');
  if (rail && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { animate(); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(rail);
  } else {
    animate();
  }
})();

/* ----------------------------------------------------------
   TECH FILTER
   ---------------------------------------------------------- */
;(function initTechFilter() {
  const pills = $$('.tech-filter-pill');
  const cards = $$('.project-card');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      const tech = pill.dataset.tech || 'all';
      cards.forEach(card => {
        if (tech === 'all') {
          card.classList.remove('is-dimmed', 'is-matched');
        } else {
          const techs = (card.dataset.tech || '').split(' ');
          if (techs.includes(tech)) {
            card.classList.remove('is-dimmed');
            card.classList.add('is-matched');
          } else {
            card.classList.add('is-dimmed');
            card.classList.remove('is-matched');
          }
        }
      });
    });
  });
})();

/* ----------------------------------------------------------
   HERO TYPOGRAPHY HOVER
   ---------------------------------------------------------- */
;(function initHeroWords() {
  if (reducedMotion) return;
  const h1 = $('.hero h1');
  if (!h1) return;

  h1.addEventListener('mouseenter', () => {
    h1.style.textShadow = '0 0 60px var(--glow)';
  });
  h1.addEventListener('mouseleave', () => {
    h1.style.textShadow = '';
  });
})();

/* ----------------------------------------------------------
   SMART STICKY HEADER
   ---------------------------------------------------------- */
;(function initSmartHeader() {
  const header = $('[data-header]');
  if (!header) return;
  let lastY = 0;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y > 100) {
        if (y > lastY + 5) {
          header.style.transform = 'translateY(-100%)';
          header.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1)';
        } else if (y < lastY - 5) {
          header.style.transform = 'translateY(0)';
        }
      } else {
        header.style.transform = 'translateY(0)';
      }
      lastY = y;
      ticking = false;
    });
    ticking = true;
  }, { passive: true });
})();

/* ----------------------------------------------------------
   SECTION RULE GLOW
   ---------------------------------------------------------- */
;(function initRuleGlow() {
  if (reducedMotion || !('IntersectionObserver' in window)) return;
  const rules = $$('.section-rule');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
      }
    });
  }, { threshold: 0.5 });
  rules.forEach(r => obs.observe(r));
})();

/* ----------------------------------------------------------
   CARD SPOTLIGHT
   ---------------------------------------------------------- */
;(function initSpotlight() {
  $$('.project-card, .terminal-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--mouse-x', '-9999px');
      card.style.setProperty('--mouse-y', '-9999px');
    });
  });
})();

/* ----------------------------------------------------------
   TECH TEXT INTERACTIVE SIGNATURE (PORTED FROM TECHTEXT.JSX)
   ---------------------------------------------------------- */
;(function initTechText() {
  const container = document.getElementById('tech-text-container');
  const canvas = document.getElementById('tech-text-canvas');
  if (!container || !canvas) return;

  const ctx = canvas.getContext('2d');
  const scratch = document.createElement('canvas');
  const scratchCtx = scratch.getContext('2d');
  if (!ctx || !scratchCtx) return;

  const LABEL_FONT = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const FALLOFF_STEPS = 8;
  const SPRING = 320;
  const DAMPING = 22;

  const approach = (current, target, dt, seconds) => current + (target - current) * (1 - Math.exp(-dt / seconds));

  const hexToRgb = (hex) => {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const n = parseInt(h.slice(0, 6), 16);
    return Number.isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  const rgba = (hex, alpha) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const noise = (...values) => {
    let h = 2166136261;
    for (const value of values) {
      h = Math.imul(h ^ (value | 0), 16777619);
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
    }
    return (h >>> 0) / 4294967296;
  };

  const signed = (value) => (value > 0 ? `+${value}` : value < 0 ? `-${-value}` : '0');

  const settings = {
    text: 'AKSHAY KUMAR',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontWeight: 600,
    fontSize: 220,
    letterSpacing: -0.05,
    color: '#ffffff',
    accentColor: '#ffffff',
    reach: 220,
    softness: 0.7,
    dashLength: 4,
    dashGap: 2,
    strokeWidth: 1.5,
    lineStyle: 'dashed',
    reveal: 'letter',
    specks: 15,
    selection: true,
    labels: true,
    draggable: true,
    sweep: true,
    speed: 1,
  };

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let width = 1;
  let height = 1;
  let dpr = 1;
  let raf = 0;
  let last = performance.now();
  let visible = true;
  let alive = true;
  let layoutKey = '';
  let requestedFont = '';
  let word = null;
  let glyphs = [];
  let presence = 0;
  let clock = 0;
  let pulse = 0;
  let placed = false;
  let dragging = -1;
  const pointer = { x: 0, y: 0, inside: false };
  const grab = { x: 0, y: 0 };
  const lens = { x: 0, y: 0 };
  const frame = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, index: -1 };

  const refreshFonts = () => {
    layoutKey = '';
    wake();
  };

  const family = (s) => s.fontFamily || getComputedStyle(container).fontFamily || 'sans-serif';
  const fontFor = (s, size) => `${s.fontWeight} ${size}px ${family(s)}`;

  const setFont = (target, s, size) => {
    target.font = fontFor(s, size);
    if ('letterSpacing' in target) target.letterSpacing = `${s.letterSpacing * size}px`;
    target.textAlign = 'left';
    target.textBaseline = 'alphabetic';
  };

  const sprite = (s, view, glyph, stroke) => {
    const pad = Math.ceil(s.strokeWidth * 2 + 4);
    const left = glyph.box.x1 - pad;
    const top = glyph.box.y1 - pad;
    const w = glyph.box.x2 - glyph.box.x1 + pad * 2;
    const h = glyph.box.y2 - glyph.box.y1 + pad * 2;
    const image = document.createElement('canvas');
    image.width = Math.max(1, Math.ceil(w * dpr));
    image.height = Math.max(1, Math.ceil(h * dpr));
    const c = image.getContext('2d');
    if (!c) return { image, left, top };
    c.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
    setFont(c, s, view.size);
    if (stroke) {
      c.lineJoin = 'round';
      c.lineWidth = s.strokeWidth * 2;
      c.lineCap = 'butt';
      c.strokeStyle = s.color;
      if (s.lineStyle !== 'solid') c.setLineDash([Math.max(1, s.dashLength), Math.max(1, s.dashGap)]);
      c.strokeText(glyph.char, glyph.x, view.baseline);
      c.setLineDash([]);
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000000';
      c.fillText(glyph.char, glyph.x, view.baseline);
      c.globalCompositeOperation = 'source-over';
    } else {
      c.fillStyle = s.color;
      c.fillText(glyph.char, glyph.x, view.baseline);
    }
    return { image, left, top };
  };

  const ensureLayout = (s) => {
    const key = [
      s.text,
      family(s),
      s.fontWeight,
      s.fontSize,
      s.letterSpacing,
      s.color,
      s.dashLength,
      s.dashGap,
      s.strokeWidth,
      s.lineStyle,
      width,
      height,
      dpr
    ].join('|');
    if (key === layoutKey && word) return word;
    layoutKey = key;
    const wanted = fontFor(s, 64);
    if (document.fonts && wanted !== requestedFont) {
      requestedFont = wanted;
      document.fonts.load(wanted, s.text).then(refreshFonts, refreshFonts);
    }

    const probe = scratchCtx;
    setFont(probe, s, s.fontSize);
    let m = probe.measureText(s.text);
    const boxLeftInit = m.actualBoundingBoxLeft !== undefined ? m.actualBoundingBoxLeft : 0;
    const boxRightInit = m.actualBoundingBoxRight !== undefined ? m.actualBoundingBoxRight : m.width;
    const boxAscentInit = m.actualBoundingBoxAscent !== undefined ? m.actualBoundingBoxAscent : (s.fontSize * 0.8);
    const boxDescentInit = m.actualBoundingBoxDescent !== undefined ? m.actualBoundingBoxDescent : (s.fontSize * 0.2);

    const fit = Math.min(
      1,
      (width * 0.94) / Math.max(boxLeftInit + boxRightInit, 1),
      (height * 0.74) / Math.max(boxAscentInit + boxDescentInit, 1)
    );
    const size = Math.max(16, s.fontSize * fit);
    setFont(probe, s, size);
    m = probe.measureText(s.text);
    const boxLeft = m.actualBoundingBoxLeft !== undefined ? m.actualBoundingBoxLeft : 0;
    const boxRight = m.actualBoundingBoxRight !== undefined ? m.actualBoundingBoxRight : m.width;
    const boxAscent = m.actualBoundingBoxAscent !== undefined ? m.actualBoundingBoxAscent : (size * 0.8);
    const boxDescent = m.actualBoundingBoxDescent !== undefined ? m.actualBoundingBoxDescent : (size * 0.2);

    const inkWidth = boxLeft + boxRight;
    const inkHeight = boxAscent + boxDescent;
    const x = (width - inkWidth) / 2 + boxLeft;
    const baseline = (height - inkHeight) / 2 + boxAscent;
    const next = {
      size,
      baseline,
      left: x - boxLeft,
      right: x + boxRight,
      top: baseline - boxAscent,
      bottom: baseline + boxDescent
    };
    word = next;

    const chars = Array.from(s.text);
    const previous = glyphs;
    glyphs = [];
    let prefix = '';
    chars.forEach((char, i) => {
      prefix += char;
      const own = probe.measureText(char);
      const ownLeft = own.actualBoundingBoxLeft !== undefined ? own.actualBoundingBoxLeft : 0;
      const ownRight = own.actualBoundingBoxRight !== undefined ? own.actualBoundingBoxRight : own.width;
      const ownAscent = own.actualBoundingBoxAscent !== undefined ? own.actualBoundingBoxAscent : (size * 0.8);
      const ownDescent = own.actualBoundingBoxDescent !== undefined ? own.actualBoundingBoxDescent : (size * 0.2);

      const gx = x + probe.measureText(prefix).width - own.width;
      if (!char.trim()) return;
      const base = {
        char,
        x: gx,
        box: {
          x1: gx - ownLeft,
          y1: baseline - ownAscent,
          x2: gx + ownRight,
          y2: baseline + ownDescent
        }
      };
      const kept = previous[glyphs.length];
      glyphs.push({
        ...base,
        offset: kept?.char === char ? kept.offset : { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        outline: 0,
        index: i,
        fill: sprite(s, next, base, false),
        dashes: sprite(s, next, base, true)
      });
    });
    dragging = -1;
    frame.index = -1;
    return next;
  };

  const glyphAt = (x, y) => {
    if (!word || y < word.top - 24 || y > word.bottom + 24) return -1;
    let best = -1;
    let bestDistance = Infinity;
    glyphs.forEach((glyph, i) => {
      const x1 = glyph.box.x1 + glyph.offset.x;
      const x2 = glyph.box.x2 + glyph.offset.x;
      const d = x < x1 ? x1 - x : x > x2 ? x - x2 : 0;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    return bestDistance < 28 ? best : -1;
  };

  const falloff = (target, cx, cy, radius, strength, softness) => {
    const inner = Math.min(1, Math.max(0, 1 - softness));
    const gradient = target.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
    if (inner > 0.995) {
      gradient.addColorStop(0.995, `rgba(0, 0, 0, ${strength})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      return gradient;
    }
    for (let i = 0; i <= FALLOFF_STEPS; i++) {
      const t = i / FALLOFF_STEPS;
      const eased = t * t * (3 - 2 * t);
      gradient.addColorStop(inner + (1 - inner) * t, `rgba(0, 0, 0, ${strength * (1 - eased)})`);
    }
    return gradient;
  };

  const blit = (target, art, dx, dy, originX, originY) => {
    target.drawImage(
      art.image,
      Math.round((art.left + dx) * dpr - originX),
      Math.round((art.top + dy) * dpr - originY)
    );
  };

  const drawReveal = (s) => {
    const radius = s.reach * dpr;
    const cx = lens.x * dpr;
    const cy = lens.y * dpr;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = falloff(ctx, cx, cy, radius, presence, s.softness);
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = 'source-over';

    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(canvas.width, Math.ceil(cx + radius));
    const y1 = Math.min(canvas.height, Math.ceil(cy + radius));
    if (x1 <= x0 || y1 <= y0) return;
    const w = x1 - x0;
    const h = y1 - y0;
    if (scratch.width < w || scratch.height < h) {
      scratch.width = Math.max(scratch.width, w);
      scratch.height = Math.max(scratch.height, h);
    }
    scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
    scratchCtx.globalCompositeOperation = 'source-over';
    scratchCtx.clearRect(0, 0, w, h);
    for (const glyph of glyphs) blit(scratchCtx, glyph.dashes, glyph.offset.x, glyph.offset.y, x0, y0);
    scratchCtx.globalCompositeOperation = 'destination-in';
    scratchCtx.fillStyle = falloff(scratchCtx, cx - x0, cy - y0, radius, 1, s.softness);
    scratchCtx.fillRect(0, 0, w, h);
    scratchCtx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = presence;
    ctx.drawImage(scratch, 0, 0, w, h, x0, y0, w, h);
    ctx.globalAlpha = 1;
  };

  const crisp = (value) => (Math.round(value * dpr) + 0.5) / dpr;

  const perimeterPoint = (distance, w, h) => {
    let d = ((distance % (2 * (w + h))) + 2 * (w + h)) % (2 * (w + h));
    if (d < w) return [frame.x1 + d, frame.y1, 0, -1];
    d -= w;
    if (d < h) return [frame.x2, frame.y1 + d, 1, 0];
    d -= h;
    if (d < w) return [frame.x2 - d, frame.y2, 0, 1];
    d -= w;
    return [frame.x1, frame.y2 - d, -1, 0];
  };

  const drawSpecks = (s, a) => {
    const w = frame.x2 - frame.x1;
    const h = frame.y2 - frame.y1;
    if (w < 2 || h < 2) return;
    const perimeter = 2 * (w + h);
    const seed = frame.index + 1;
    const grid = 3;

    for (let k = 0; k < s.specks; k++) {
      const period = 0.5 + noise(seed, k, 11) * 1.2;
      const t = pulse / period + noise(seed, k, 17);
      const cycle = Math.floor(t);
      const life = t - cycle;
      if (life > 0.7) continue;
      const [px, py, nx, ny] = perimeterPoint(noise(seed, k, cycle) * perimeter, w, h);
      const pick = noise(seed, k, cycle, 2);
      const size = pick < 0.46 ? 2 : pick < 0.7 ? 3 : pick < 0.84 ? 5 : pick < 0.94 ? 8 : 11;
      const large = size >= 8;
      const out = (large ? 9 : 4) + Math.floor(noise(seed, k, cycle, 1) * 5) * grid;
      const x = frame.x1 + Math.round((px + nx * out - frame.x1) / grid) * grid;
      const y = frame.y1 + Math.round((py + ny * out - frame.y1) / grid) * grid;
      const tone = noise(seed, k, cycle, 3);
      const blink = life < 0.06 || (life > 0.32 && life < 0.36) ? 0.35 : 1;
      const alpha = a * (large ? 0.3 + 0.4 * tone : 0.3 + 0.6 * tone) * blink;
      const left = Math.round(x - size / 2);
      const top = Math.round(y - size / 2);
      if (tone < 0.26 || (large && tone < 0.78)) {
        ctx.strokeStyle = rgba(s.accentColor, alpha);
        ctx.strokeRect(left + 0.5, top + 0.5, size, size);
        if (large && tone > 0.5) {
          ctx.fillStyle = rgba(s.accentColor, alpha);
          ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
        }
      } else {
        ctx.fillStyle = rgba(s.accentColor, alpha);
        ctx.fillRect(left, top, size, size);
      }
    }

    for (let j = 0; j < 2; j++) {
      const head = (pulse * 0.42 * s.speed + j * 0.5) * perimeter;
      for (let i = 0; i < 4; i++) {
        const [x, y] = perimeterPoint(head - i * 6, w, h);
        const size = i === 0 ? 3 : 2;
        ctx.fillStyle = rgba(s.accentColor, a * [0.95, 0.55, 0.32, 0.16][i]);
        ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
      }
    }
  };

  const drawFrame = (s) => {
    const glyph = glyphs[frame.index];
    if (!glyph || frame.alpha < 0.01) return;
    const a = frame.alpha;
    const x1 = crisp(frame.x1);
    const y1 = crisp(frame.y1);
    const x2 = crisp(frame.x2);
    const y2 = crisp(frame.y2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const moved = Math.hypot(glyph.offset.x, glyph.offset.y);
    if (moved > 1) {
      const hx = (glyph.box.x1 + glyph.box.x2) / 2;
      const hy = (glyph.box.y1 + glyph.box.y2) / 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + glyph.offset.x, hy + glyph.offset.y);
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(s.accentColor, 0.45 * a);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.rect(Math.round(hx) - 2, Math.round(hy) - 2, 4, 4);
      ctx.fillStyle = rgba(s.accentColor, 0.7 * a);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.rect(x1, y1, x2 - x1, y2 - y1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(s.accentColor, 0.5 * a);
    ctx.stroke();

    ctx.beginPath();
    for (const [cx, cy] of [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2]
    ]) {
      ctx.rect(Math.round(cx) - 2, Math.round(cy) - 2, 5, 5);
    }
    ctx.fillStyle = rgba(s.accentColor, 0.95 * a);
    ctx.fill();

    if (s.specks > 0) {
      ctx.lineWidth = 1;
      drawSpecks(s, a);
    }

    if (!s.labels) return;
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = rgba(s.accentColor, 0.62 * a);
    const label =
      moved > 1
        ? `${signed(Math.round(glyph.offset.x))}, ${signed(Math.round(-glyph.offset.y))}`
        : `${glyph.char}  ${Math.round(glyph.box.x2 - glyph.box.x1)} × ${Math.round(glyph.box.y2 - glyph.box.y1)}`;
    ctx.fillText(label, Math.round(frame.x1), Math.round(frame.y1) - 7);
  };

  const tick = (now) => {
    raf = 0;
    const s = settings;
    if (!s) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const view = ensureLayout(s);

    const sweeping = s.sweep && !reducedMotion && !pointer.inside && dragging < 0;
    if (sweeping) clock += dt * s.speed;
    pulse += dt;
    let targetX = pointer.x;
    let targetY = pointer.y;
    if (sweeping) {
      targetX = view.left + (view.right - view.left) * (0.5 - 0.5 * Math.cos(clock * 0.45));
      targetY = view.top + (view.bottom - view.top) * (0.45 + 0.1 * Math.sin(clock * 0.8));
    }
    const active = pointer.inside || sweeping || dragging >= 0;
    if (active && !placed) {
      lens.x = targetX;
      lens.y = targetY;
    }
    if (active) {
      const lag = pointer.inside ? 0.05 : 0.22;
      lens.x = approach(lens.x, targetX, dt, lag);
      lens.y = approach(lens.y, targetY, dt, lag);
    }
    placed = active;
    presence = approach(presence, s.reveal === 'area' && active && dragging < 0 ? 1 : 0, dt, 0.16);

    let moving = false;
    glyphs.forEach((glyph, i) => {
      if (i === dragging) {
        glyph.offset.x = approach(glyph.offset.x, pointer.x - grab.x, dt, 0.03);
        glyph.offset.y = approach(glyph.offset.y, pointer.y - grab.y, dt, 0.03);
        glyph.velocity.x = 0;
        glyph.velocity.y = 0;
        moving = true;
        return;
      }
      const { offset, velocity } = glyph;
      if (Math.abs(offset.x) < 0.05 && Math.abs(offset.y) < 0.05 && Math.hypot(velocity.x, velocity.y) < 0.5) {
        offset.x = 0;
        offset.y = 0;
        velocity.x = 0;
        velocity.y = 0;
        return;
      }
      velocity.x += (-SPRING * offset.x - DAMPING * velocity.x) * dt;
      velocity.y += (-SPRING * offset.y - DAMPING * velocity.y) * dt;
      offset.x += velocity.x * dt;
      offset.y += velocity.y * dt;
      moving = true;
    });

    const focus = dragging >= 0 ? dragging : active ? glyphAt(lens.x, lens.y) : -1;
    if (focus >= 0 && s.selection) {
      const glyph = glyphs[focus];
      const bx1 = glyph.box.x1 + glyph.offset.x - 6;
      const by1 = glyph.box.y1 + glyph.offset.y - 6;
      const bx2 = glyph.box.x2 + glyph.offset.x + 6;
      const by2 = glyph.box.y2 + glyph.offset.y + 6;
      if (frame.index < 0 || frame.alpha < 0.02) {
        frame.x1 = bx1;
        frame.y1 = by1;
        frame.x2 = bx2;
        frame.y2 = by2;
      }
      const glide = focus === dragging ? 0.02 : 0.08;
      frame.x1 = approach(frame.x1, bx1, dt, glide);
      frame.y1 = approach(frame.y1, by1, dt, glide);
      frame.x2 = approach(frame.x2, bx2, dt, glide);
      frame.y2 = approach(frame.y2, by2, dt, glide);
      frame.index = focus;
    }
    frame.alpha = approach(frame.alpha, focus >= 0 && s.selection ? 1 : 0, dt, 0.1);

    glyphs.forEach((glyph, i) => {
      const target = s.reveal === 'letter' && i === focus && i !== dragging ? 1 : 0;
      glyph.outline = approach(glyph.outline, target, dt, 0.09);
      if (Math.abs(glyph.outline - target) > 0.002) moving = true;
      else glyph.outline = target;
    });

    if (s.draggable) container.style.cursor = dragging >= 0 ? 'grabbing' : focus >= 0 && pointer.inside ? 'grab' : '';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const glyph of glyphs) {
      const moved = Math.hypot(glyph.offset.x, glyph.offset.y);
      if (moved > 1) {
        ctx.globalAlpha = Math.min(1, moved / 24) * 0.55;
        blit(ctx, glyph.dashes, 0, 0, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    for (const glyph of glyphs) {
      if (glyph.outline < 0.999) {
        ctx.globalAlpha = 1 - glyph.outline;
        blit(ctx, glyph.fill, glyph.offset.x, glyph.offset.y, 0, 0);
      }
      if (glyph.outline > 0.001) {
        ctx.globalAlpha = glyph.outline;
        blit(ctx, glyph.dashes, glyph.offset.x, glyph.offset.y, 0, 0);
      }
      ctx.globalAlpha = 1;
    }
    if (presence > 0.001) drawReveal(s);
    drawFrame(s);

    const settling =
      moving ||
      Math.abs(presence - (s.reveal === 'area' && active && dragging < 0 ? 1 : 0)) > 0.002 ||
      (frame.alpha > 0.01 && frame.alpha < 0.99);
    if ((active || settling) && visible && alive) raf = requestAnimationFrame(tick);
  };

  const wake = () => {
    if (raf || !visible || !alive) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    layoutKey = '';
    wake();
  };

  const locate = (e) => {
    const rect = container.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  };
  const onMove = (e) => {
    locate(e);
    pointer.inside = true;
    wake();
  };
  const onLeave = () => {
    if (dragging >= 0) return;
    pointer.inside = false;
    wake();
  };
  const onDown = (e) => {
    locate(e);
    pointer.inside = true;
    const s = settings;
    if (s?.draggable && (e.pointerType !== 'mouse' || e.button === 0)) {
      const index = glyphAt(pointer.x, pointer.y);
      if (index >= 0) {
        dragging = index;
        grab.x = pointer.x - glyphs[index].offset.x;
        grab.y = pointer.y - glyphs[index].offset.y;
        try { container.setPointerCapture?.(e.pointerId); } catch (_) {}
      }
    }
    wake();
  };
  const onUp = (e) => {
    if (dragging >= 0) {
      dragging = -1;
      try { container.releasePointerCapture?.(e.pointerId); } catch (_) {}
      const rect = container.getBoundingClientRect();
      pointer.inside =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    }
    wake();
  };

  container.addEventListener('pointermove', onMove, { passive: true });
  container.addEventListener('pointerenter', onMove, { passive: true });
  container.addEventListener('pointerdown', onDown, { passive: true });
  container.addEventListener('pointerup', onUp, { passive: true });
  container.addEventListener('pointercancel', onUp, { passive: true });
  container.addEventListener('pointerleave', onLeave, { passive: true });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  });
  intersectionObserver.observe(container);

  if (document.fonts) document.fonts.ready.then(refreshFonts, refreshFonts);

  resize();
})();

console.log('%c akshay.portfolio ✦ ', 'background:#08080A;color:#D4A5A5;font-size:14px;font-family:monospace;padding:4px 8px;border-radius:4px;font-weight:bold');

