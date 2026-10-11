'use strict';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

;(function initCursor() {
  if (reducedMotion || window.matchMedia('(hover: none)').matches) return;

  const dot  = document.createElement('div');
  const ring = document.createElement('div');
  dot.id  = 'cursor-dot';
  ring.id = 'cursor-ring';
  document.body.append(dot, ring);

  let mx = -999, my = -999;
  let rx = -999, ry = -999;
  let raf;

  document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.left  = mx + 'px';
    dot.style.top   = my + 'px';
  }, { passive: true });

  function animateRing() {
    rx = lerp(rx, mx, 0.14);
    ry = lerp(ry, my, 0.14);
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    raf = requestAnimationFrame(animateRing);
  }
  animateRing();

  const magnets = $$('a, button, .project-card, .terminal-card, .stat-pill');
  magnets.forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.remove('cursor-hover') || document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    el.addEventListener('mousedown',  () => document.body.classList.add('cursor-active'));
    el.addEventListener('mouseup',    () => document.body.classList.remove('cursor-active'));
  });
})();

$$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

const themeToggle = $('#theme-toggle');
const themeMeta   = $('meta[name="theme-color"]');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('portfolio_theme', theme);
  if (!themeToggle) return;
  const icon  = themeToggle.querySelector('.theme-toggle-icon');
  const label = themeToggle.querySelector('.theme-toggle-label');
  if (theme === 'dark') {
    if (icon)  icon.textContent  = '☾';
    if (label) label.textContent = 'Ink';
    if (themeMeta) themeMeta.setAttribute('content', '#090909');
  } else {
    if (icon)  icon.textContent  = '☀';
    if (label) label.textContent = 'Light';
    if (themeMeta) themeMeta.setAttribute('content', '#F5F4F0');
  }
}

const saved = localStorage.getItem('portfolio_theme');
const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(saved || preferred);

themeToggle?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

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

;(function initParticles() {
  if (reducedMotion) return;

  const hero = $('.hero');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'particles-canvas';
  hero.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, particles = [];
  let mouse = { x: -999, y: -999 };

  function resize() {
    W = canvas.width  = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  hero.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }, { passive: true });
  hero.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });

  const colors = ['rgba(184,90,63,0.5)', 'rgba(59,107,54,0.4)', 'rgba(180,170,150,0.3)'];

  class Particle {
    constructor() { this.reset(true); }
    reset(init = false) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : H + 8;
      this.r  = Math.random() * 1.8 + 0.4;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -(Math.random() * 0.5 + 0.15);
      this.a  = 0;
      this.ta = Math.random() * 0.5 + 0.2;
      this.life = 0;
      this.maxLife = Math.random() * 200 + 120;
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    update() {
      this.life++;
      if (this.life < 40) this.a = lerp(this.a, this.ta, 0.1);
      else if (this.life > this.maxLife - 40) this.a = lerp(this.a, 0, 0.05);

      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        const force = (100 - dist) / 100;
        this.vx += (dx / dist) * force * 0.4;
        this.vy += (dy / dist) * force * 0.4;
      }

      this.vx *= 0.98;
      this.vy *= 0.98;

      this.x += this.vx;
      this.y += this.vy;

      if (this.life > this.maxLife || this.y < -10) this.reset();
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.a;
      ctx.fillStyle   = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const N = Math.min(80, Math.floor(W * H / 8000));
  for (let i = 0; i < N; i++) particles.push(new Particle());

  function drawConnections() {
    const MAX_DIST = 100;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < MAX_DIST) {
          const alpha = ((1 - d / MAX_DIST) * 0.12).toFixed(3);
          ctx.beginPath();
          ctx.strokeStyle = `rgba(184,90,63,${alpha})`;
          ctx.lineWidth   = 0.6;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  animate();
})();

;(function initTilt() {
  if (reducedMotion || window.matchMedia('(hover: none)').matches) return;

  function initCard(card) {
    let raf;
    let tx = 0, ty = 0;
    let cx = 0, cy = 0;

    card.addEventListener('mousemove', e => {
      const r   = card.getBoundingClientRect();
      const x   = (e.clientX - r.left) / r.width  - 0.5;
      const y   = (e.clientY - r.top)  / r.height - 0.5;
      tx = y * -10;
      ty = x *  10;

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
      raf = requestAnimationFrame(frame);
    }
    frame();
  }

  $$('.terminal-card, .project-card, .stat-pill').forEach(initCard);
})();

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

;(function initSimulator() {
  const data = {
    ai: {
      title: 'Generative AI / LLM Engineer',
      match: 78,
      gaps: ['Vector DBs (Chroma/Milvus)', 'LangChain & RAG Pipelines', 'LLM Evals & Guardrails'],
      steps: [
        { status: 'is-complete', dot: '✔', title: 'Phase 1: Foundations (Mastered)', desc: 'Python, Embeddings & Tokenization' },
        { status: 'is-active',   dot: '➜', title: 'Phase 2: RAG Architecture (In Progress)', desc: 'Semantic chunking, Vector indexing, Re-ranking' },
        { status: '',            dot: '○', title: 'Phase 3: Production Serving', desc: 'FastAPI async streaming, Caching, Telemetry' },
      ],
    },
    fullstack: {
      title: 'Full-Stack Web Architect',
      match: 86,
      gaps: ['Next.js SSR & Server Actions', 'Distributed Caching (Redis)', 'Docker & CI/CD Pipelines'],
      steps: [
        { status: 'is-complete', dot: '✔', title: 'Phase 1: Web Core (Mastered)', desc: 'Semantic HTML, CSS Tokens, Modern JS' },
        { status: 'is-active',   dot: '➜', title: 'Phase 2: Backend & Database (In Progress)', desc: 'Node.js, PostgreSQL schema design, Auth' },
        { status: '',            dot: '○', title: 'Phase 3: Cloud & Containerization', desc: 'Docker, Kubernetes, Edge deployment' },
      ],
    },
    ml: {
      title: 'Applied Machine Learning Engineer',
      match: 72,
      gaps: ['PyTorch Deep Learning', 'Feature Stores & Data Validation', 'Model Serving with ONNX'],
      steps: [
        { status: 'is-complete', dot: '✔', title: 'Phase 1: Math & Analytics (Mastered)', desc: 'Linear Algebra, Pandas, Exploratory Data Analysis' },
        { status: 'is-active',   dot: '➜', title: 'Phase 2: Supervised Learning (In Progress)', desc: 'Scikit-learn, XGBoost, Cross-validation' },
        { status: '',            dot: '○', title: 'Phase 3: Deep Learning & MLOps', desc: 'Neural Networks, PyTorch, MLflow tracking' },
      ],
    },
  };

  const roleBtns    = $$('.sim-role-btn');
  const roleTitle   = $('#sim-role-title');
  const matchVal    = $('#sim-match-val');
  const meterFill   = $('#sim-meter-fill');
  const gapsCont    = $('#sim-gaps');
  const stepsCont   = $('#sim-steps');

  function updateSim(key) {
    const d = data[key];
    if (!d) return;
    if (roleTitle) roleTitle.textContent = d.title;
    if (matchVal)  matchVal.textContent  = `${d.match}%`;
    if (meterFill) meterFill.style.width = `${d.match}%`;
    if (gapsCont)  gapsCont.innerHTML    = d.gaps.map(g => `<span class="sim-gap-pill">${g}</span>`).join('');
    if (stepsCont) stepsCont.innerHTML   = d.steps.map(s => `
      <div class="sim-step ${s.status}">
        <span class="step-dot" aria-hidden="true">${s.dot}</span>
        <div class="step-info"><strong>${s.title}</strong><span>${s.desc}</span></div>
      </div>`).join('');
  }

  roleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      roleBtns.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      updateSim(btn.dataset.role || 'ai');
    });
  });
})();

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

;(function initAmbientMouse() {
  if (reducedMotion) return;
  const hero = $('.hero');
  if (!hero) return;
  const glow = document.createElement('div');
  Object.assign(glow.style, {
    position: 'absolute',
    width: '500px', height: '500px',
    background: 'radial-gradient(circle, rgba(184,90,63,0.06) 0%, transparent 70%)',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: '0',
    transition: 'left 0.4s ease, top 0.4s ease',
    transform: 'translate(-50%,-50%)',
  });
  hero.style.position = 'relative';
  hero.prepend(glow);

  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    glow.style.left = `${e.clientX - r.left}px`;
    glow.style.top  = `${e.clientY - r.top}px`;
    glow.style.opacity = '1';
  }, { passive: true });
  hero.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
})();

console.log('%c akshay.portfolio v3 ✦ ', 'background:#090909;color:#E27560;font-size:14px;font-family:monospace;padding:4px 8px;border-radius:4px;font-weight:bold');
