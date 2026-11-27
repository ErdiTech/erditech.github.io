/*!
 * erditech.com shared motion layer (2026-11-27). One file for every page; long-cached hashed name.
 * Vanilla part (all pages): menu, nav state, reveal fallback, Lenis smooth scroll, cursor glow, magnetic buttons,
 *   outbound curtain. Section reveals and page heroes are pure CSS (scroll-driven animations + view transitions).
 * GSAP part (only pages that need it, loaded on demand): scroll-scrubbed frame films, word-mask headings,
 *   word light-up, count-up, module card fan + tilt.
 * prefers-reduced-motion: static posters and text. Save-Data / 2g / 3g: posters only, no frame sequences.
 */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
  var small = matchMedia('(max-width: 760px)').matches;
  var conn = navigator.connection || {};
  var lite = !!conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '');
  var BASE = '/assets/js/';
  var LIBS = ['gsap-3.15.1.min.js', 'ScrollTrigger-3.15.1.min.js', 'SplitText-3.15.1.min.js'];

  /* ---------- menu ---------- */
  var btn = document.querySelector('.menu-btn'), panel = document.getElementById('mpanel');
  if (btn && panel) {
    var label = btn.querySelector('.menu-label');
    var setMenu = function (open) {
      document.body.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      label.textContent = open ? 'Close' : 'Menu';
      doc.style.overflow = open ? 'hidden' : '';
      if (window.__lenis) { open ? window.__lenis.stop() : window.__lenis.start(); }
    };
    btn.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); btn.focus(); } });
  }

  /* ---------- nav state ---------- */
  var nav = document.querySelector('.nav');
  var darks = [].slice.call(document.querySelectorAll('[data-dark]'));
  var navTick = false;
  var navState = function () {
    navTick = false;
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 40);
    var dark = false;
    for (var i = 0; i < darks.length; i++) { var r = darks[i].getBoundingClientRect(); if (r.top <= 40 && r.bottom > 40) { dark = true; break; } }
    nav.classList.toggle('on-dark', dark);
  };
  addEventListener('scroll', function () { if (!navTick) { navTick = true; requestAnimationFrame(navState); } }, { passive: true });
  navState();

  /* ---------- current section indicator (home) ---------- */
  if ('IntersectionObserver' in window) {
    var links = {};
    document.querySelectorAll('.nav-links a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var ids = Object.keys(links);
    if (ids.length) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var a = links[en.target.id]; if (!a || !en.isIntersecting) return;
          ids.forEach(function (k) { links[k].removeAttribute('aria-current'); }); a.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      ids.forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
    }
  }

  /* ---------- reveals: CSS scroll-driven animations; IntersectionObserver class for older browsers ---------- */
  var revealEls = document.querySelectorAll('.rv, .rv-list, .rv-clip');
  var cssTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  if (reduce || !('IntersectionObserver' in window)) revealEls.forEach(function (el) { el.classList.add('in'); });
  else if (!cssTimeline) {
    var rio = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    revealEls.forEach(function (el) { rio.observe(el); });
  }

  if (reduce) {
    doc.classList.add('static');
    document.querySelectorAll('.film').forEach(function (f) { f.classList.add('is-static'); });
    return;
  }
  if (lite) {
    doc.classList.add('lite');
    document.querySelectorAll('.film').forEach(function (f) { f.classList.add('is-static'); });
  }

  /* ---------- Lenis smooth scroll (desktop pointers) ---------- */
  var lenis = null;
  /* ?nolenis=1 turns smooth scrolling off (QA screenshots, debugging) */
  if (window.Lenis && !coarse && !/[?&]nolenis=1/.test(location.search)) {
    lenis = new Lenis({ duration: 1.3, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true, wheelMultiplier: 0.9, autoRaf: true });
    window.__lenis = lenis;
    document.querySelectorAll('a[href*="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href'), i = href.indexOf('#');
        var path = href.slice(0, i);
        if (i < 0 || href.length - i < 2 || (path && path !== location.pathname)) return;
        var el = document.getElementById(href.slice(i + 1));
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -80, duration: 1.6 });
        history.replaceState(null, '', href.slice(i));
      });
    });
  }

  /* ---------- tiny spring helper (no library) ---------- */
  function follower(el, ease, apply) {
    var x = 0, y = 0, tx = 0, ty = 0, running = false;
    function step() {
      x += (tx - x) * ease; y += (ty - y) * ease;
      apply(el, x, y);
      if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) requestAnimationFrame(step); else running = false;
    }
    return function (nx, ny) { tx = nx; ty = ny; if (!running) { running = true; requestAnimationFrame(step); } };
  }
  var moveTo = function (el, x, y) { el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)'; };

  /* ---------- cursor glow over dark scenes ---------- */
  if (!coarse) {
    document.querySelectorAll('[data-glow]').forEach(function (host) {
      var halo = document.createElement('div'); halo.className = 'glow-halo';
      var core = document.createElement('div'); core.className = 'glow-core';
      host.appendChild(halo); host.appendChild(core);
      var fh = follower(halo, 0.07, moveTo), fc = follower(core, 0.22, moveTo);
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        fh(x, y); fc(x, y); host.classList.add('glowing');
      });
      host.addEventListener('pointerleave', function () { host.classList.remove('glowing'); });
    });
  }

  /* ---------- magnetic buttons ---------- */
  if (!coarse) {
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var f = follower(el, 0.18, moveTo);
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        f((e.clientX - (r.left + r.width / 2)) * 0.3, (e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', function () { f(0, 0); });
    });
  }

  /* ---------- outbound page transition: curtain wipe (same-origin pages use view transitions) ---------- */
  var curtain = document.querySelector('.curtain');
  if (curtain) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === '_blank') return;
      var u;
      try { u = new URL(a.href, location.href); } catch (err) { return; }
      if (!/^https?:$/.test(u.protocol) || u.origin === location.origin) return;
      e.preventDefault();
      curtain.classList.add('on');
      setTimeout(function () { location.href = u.href; }, 420);
    });
    addEventListener('pageshow', function () { curtain.classList.remove('on'); });
  }

  /* ---------- nav hides on scroll down, returns on scroll up ---------- */
  var lastY = window.scrollY;
  addEventListener('scroll', function () {
    var y = window.scrollY, d = y - lastY;
    doc.classList.toggle('past-fold', y > innerHeight * 0.6);
    if (Math.abs(d) > 6 && nav && !document.body.classList.contains('menu-open')) { var hid = false; nav.classList.toggle('hide', hid); doc.classList.toggle('nav-hidden', hid); }
    lastY = y;
  }, { passive: true });

  /* ---------- hold hero headlines until the webfonts are in (max 900 ms): no fallback-font flash ---------- */
  if (document.fonts && document.fonts.ready) {
    var fr = function () { doc.classList.add('fonts-in'); };
    document.fonts.ready.then(fr); setTimeout(fr, 900);
  } else doc.classList.add('fonts-in');

  /* ---------- custom cursor: dot + ring; grows on links, "View" on images ---------- */
  if (!coarse && matchMedia('(pointer: fine)').matches) {
    var dot = document.createElement('div'), ring = document.createElement('div');
    dot.className = 'cur-dot'; ring.className = 'cur-ring'; ring.innerHTML = '<span>View</span>';
    document.body.appendChild(dot); document.body.appendChild(ring);
    doc.classList.add('has-cursor');
    var fd = follower(dot, 0.5, moveTo), fr = follower(ring, 0.16, moveTo), ringLabel = ring.firstChild;
    addEventListener('pointermove', function (e) {
      if (!doc.classList.contains('cur-on')) doc.classList.add('cur-on');
      fd(e.clientX, e.clientY); fr(e.clientX, e.clientY);
      var t = e.target.closest ? e.target.closest('a, button, summary, [data-cursor]') : null;
      var view = t && (t.matches('[data-cursor]') || t.querySelector('img, picture'));
      ringLabel.textContent = (t && t.getAttribute('data-cursor')) || 'View';
      doc.classList.toggle('cur-view', !!view);
      doc.classList.toggle('cur-link', !!t && !view);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { doc.classList.add('cur-hide'); });
    document.addEventListener('pointerenter', function () { doc.classList.remove('cur-hide'); });
  }

  /* ---------- tables: each cell carries its column name, so phones can show rows as cards ---------- */
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 200); };
  function labelTables(root) {
    root.querySelectorAll('table').forEach(function (t) {
      var heads = [].map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
      if (!heads.length) return;
      var rows = t.querySelectorAll('tbody tr'), k = 0;
      (function batch() {   /* 40 rows per idle slice: no long task on big data tables */
        for (var e = Math.min(rows.length, k + 40); k < e; k++)
          [].forEach.call(rows[k].children, function (td, i) { if (heads[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i]); });
        if (k < rows.length) idle(batch, { timeout: 2000 });
      })();
    });
  }
  document.querySelectorAll('.prose, .tool-page').forEach(function (r) {
    idle(function () { labelTables(r); }, { timeout: 3000 });
    if (r.classList.contains('tool-page') && window.MutationObserver) {
      var pend = false;
      new MutationObserver(function () { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; labelTables(r); }); }).observe(r, { childList: true, subtree: true });
    }
  });

  /* tables that fit their column may let the header stick to the page (CSS: .fits) */
  if (matchMedia('(min-width: 1400px)').matches) {
    var fits = function (t) { return t.scrollWidth <= t.clientWidth + 1; };
    document.querySelectorAll('.prose .tbl').forEach(function (t) {
      if (!fits(t)) return;
      t.classList.add('fits');
      var w = t.closest('.wrap');
      if (w && [].every.call(w.querySelectorAll('.tbl'), fits) && w.scrollWidth <= w.clientWidth + 1) w.classList.add('fits');
    });
  }

  /* looping decorations (marquee, mesh, caret, live dot, scroll cue) run only while on screen: no idle repaints */
  if ('IntersectionObserver' in window) {
    var loopIO = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('paused', !e.isIntersecting); }); });
    document.querySelectorAll('.marquee, .contact-wrap, .term, .film-stage, .stream').forEach(function (el) { loopIO.observe(el); });
  }

  /* ---------- back to top (after two screens) ---------- */
  var top = document.querySelector('.to-top');
  if (top) {
    addEventListener('scroll', function () { top.classList.toggle('show', window.scrollY > innerHeight * 2); }, { passive: true });
    top.addEventListener('click', function () { lenis ? lenis.scrollTo(0, { duration: 1.6 }) : scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ---------- character reveal for the big footer mark ---------- */
  document.querySelectorAll('.foot-mark').forEach(function (m) {
    var i = 0;
    m.querySelectorAll('*').forEach(function () {});
    var walker = document.createTreeWalker(m, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.textContent.split('').forEach(function (c) {
        if (c === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
        var s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = c; frag.appendChild(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, io) { if (es[0].isIntersecting) { m.classList.add('in'); io.disconnect(); } }, { threshold: 0.3 }).observe(m);
    else m.classList.add('in');
  });

  /* ---------- scrambled decode for small labels (on view) and nav links (on hover) ---------- */
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#*';
  function scramble(el) {
    if (el.__busy) return;
    var final = el.__text || (el.__text = el.textContent), len = final.length, f = 0, total = Math.min(26, 10 + len);
    el.__busy = true;
    (function step() {
      var out = '';
      for (var i = 0; i < len; i++) {
        var c = final[i];
        out += (c === ' ' || i < (f / total) * len) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (++f <= total) requestAnimationFrame(step); else { el.textContent = final; el.__busy = false; }
    })();
  }
  var scrambleEls = [].slice.call(document.querySelectorAll('.kick, .film .caps, .badge, .phero .crumbs span:last-child')).filter(function (el) { return el.children.length === 0; });
  if ('IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { scramble(en.target); sio.unobserve(en.target); } }); }, { threshold: 1 });
    scrambleEls.forEach(function (el) { sio.observe(el); });
  }
  document.querySelectorAll('.nav-links a').forEach(function (a) { a.addEventListener('pointerenter', function () { if (!a.children.length) scramble(a); }); });

  /* ---------- typewriter with a keyboard that presses along ---------- */
  document.querySelectorAll('[data-type]').forEach(function (term) {
    var line = term.querySelector('.line'), keys = term.querySelectorAll('.keys kbd'), text = term.getAttribute('data-type');
    var map = {};
    keys.forEach(function (k) { map[(k.getAttribute('data-k') || k.textContent).toLowerCase()] = k; });
    function press(c) {
      var k = map[c.toLowerCase()] || (c === ' ' ? map.space : null) || map.any;
      if (!k) return;
      if (k === map.any) k.textContent = c;
      k.classList.add('down'); setTimeout(function () { k.classList.remove('down'); }, 110);
    }
    function run() {
      var i = 0; line.innerHTML = '<b>$</b> <span></span><i class="caret"></i>';
      var out = line.querySelector('span');
      (function tick() {
        if (i >= text.length) { setTimeout(function () { if (map.enter) { map.enter.classList.add('down'); setTimeout(function () { map.enter.classList.remove('down'); }, 160); } }, 300); return; }
        var c = text[i++]; out.textContent += c; press(c);
        setTimeout(tick, c === ' ' ? 140 : 55 + Math.random() * 70);
      })();
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, io) { if (es[0].isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.6 }).observe(term);
  });

  /* ---------- copy buttons + toast ---------- */
  var toast = null;
  function say(msg) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toast.__t); toast.__t = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var txt = b.getAttribute('data-copy'), lbl = b.querySelector('span');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
        b.classList.add('ok'); if (lbl) lbl.textContent = 'Copied ✓'; say('Copied: ' + txt);
        setTimeout(function () { b.classList.remove('ok'); if (lbl) lbl.textContent = 'Copy'; }, 1600);
      }).catch(function () { say(txt); });
    });
  });

  /* ---------- lazy videos: sources attach one screen before view, play only while visible ---------- */
  document.querySelectorAll('video[data-lazy-video]').forEach(function (v) {
    if (lite || !('IntersectionObserver' in window)) return;
    var armed = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting && !armed) {
          armed = true;
          v.querySelectorAll('source[data-src]').forEach(function (s) { s.src = s.getAttribute('data-src'); });
          v.load();
        }
      });
    }, { rootMargin: '100% 0px' }).observe(v);
    new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting && armed) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } else v.pause(); });
    }, { threshold: 0.15 }).observe(v);
  });

  /* ---------- wide tables: fade hint on the right until scrolled to the end ---------- */
  document.querySelectorAll('.tbl, .tool-page .tablewrap').forEach(function (t) {
    var chk = function () { t.classList.toggle('end', t.scrollLeft + t.clientWidth >= t.scrollWidth - 4); };
    t.addEventListener('scroll', chk, { passive: true }); chk();
  });

  /* ---------- images: blurred placeholder until decoded ---------- */
  document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
    if ((img.complete && img.naturalWidth) || /logo/.test(img.src)) return;
    img.classList.add('lq');
    img.addEventListener('load', function () { img.classList.add('ok'); }, { once: true });
    img.addEventListener('error', function () { img.classList.add('ok'); }, { once: true });
  });

  /* ---------- marquee speeds up with scroll velocity and flips with direction ---------- */
  var tracks = [].slice.call(document.querySelectorAll('.marquee-track'));
  if (tracks.length && tracks[0].getAnimations) {
    var my = window.scrollY, vel = 0, dir = 1, mRun = false;
    addEventListener('scroll', function () { var y = window.scrollY; vel = y - my; if (vel) dir = vel > 0 ? 1 : -1; my = y; if (!mRun) { mRun = true; requestAnimationFrame(mTick); } }, { passive: true });
    var mTick = function () {
      var rate = dir * (1 + Math.min(6, Math.abs(vel) / 12));
      tracks.forEach(function (t) { t.getAnimations().forEach(function (a) { a.playbackRate += (rate - a.playbackRate) * 0.12; }); });
      vel *= 0.9;
      if (Math.abs(vel) > 0.2 || tracks.some(function (t) { return t.getAnimations().some(function (a) { return Math.abs(a.playbackRate - dir) > 0.02; }); })) requestAnimationFrame(mTick); else mRun = false;
    };
  }

  /* ---------- live echo under search inputs (characters bounce as you type) ---------- */
  document.querySelectorAll('form.f input[type="text"], form.f input:not([type]), form.f input[type="number"]').forEach(function (inp) {
    var echo = document.createElement('span'); echo.className = 'echo'; echo.setAttribute('aria-hidden', 'true');
    inp.insertAdjacentElement('afterend', echo);
    var prev = '';
    inp.addEventListener('input', function () {
      var v = inp.value;
      if (v.length > prev.length && v.indexOf(prev) === 0) { var s = document.createElement('span'); s.textContent = v.slice(prev.length); echo.appendChild(s); }
      else { echo.textContent = ''; v.split('').forEach(function (c) { var s = document.createElement('span'); s.textContent = c; s.style.animation = 'none'; echo.appendChild(s); }); }
      prev = v;
    });
  });

  /* ---------- button feedback: tick when an action succeeds, shake when input is missing ---------- */
  document.querySelectorAll('[data-feedback]').forEach(function (b) {
    b.addEventListener('click', function () {
      var need = b.getAttribute('data-needs'), field = need && document.getElementById(need);
      if (field && !field.value.trim()) { field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake'); return; }
      var old = b.textContent; b.classList.add('done'); b.textContent = '✓ ' + old;
      setTimeout(function () { b.classList.remove('done'); b.textContent = old; }, 1200);
    });
  });

  /* ---------- 404: point the laser ---------- */
  var l404 = document.querySelector('.laser-404');
  if (l404) {
    var host = l404.parentElement, ln = l404.querySelector('line'), pt = l404.querySelector('circle'), tx = l404.querySelector('text');
    var aim = function (x, y) {
      var r = host.getBoundingClientRect(), ox = r.width, oy = r.height;
      ln.setAttribute('x1', ox); ln.setAttribute('y1', oy); ln.setAttribute('x2', x); ln.setAttribute('y2', y);
      pt.setAttribute('cx', x); pt.setAttribute('cy', y);
      tx.setAttribute('x', x + 14); tx.setAttribute('y', y - 12); tx.textContent = 'no target';
    };
    var hr = host.getBoundingClientRect(); aim(hr.width * 0.62, hr.height * 0.34);
    host.addEventListener('pointermove', function (e) { var r = host.getBoundingClientRect(); aim(e.clientX - r.left, e.clientY - r.top); });
  }

  /* ---------- GSAP part, only where needed ---------- */
  var needs = document.querySelector('.film, [data-split], [data-lightup], [data-count], .pcard');
  if (!needs) return;
  function load(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = BASE + src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function boot() {
    load(LIBS[0]).then(function () { return Promise.all([load(LIBS[1]), load(LIBS[2])]); }).then(gsapPart).catch(function () {
      document.querySelectorAll('.film').forEach(function (f) { f.classList.add('is-static'); });
    });
  }
  // after first paint: the poster (LCP) and text never wait for animation code
  if (document.readyState === 'complete') setTimeout(boot, 0); else addEventListener('load', function () { setTimeout(boot, 0); });

  function gsapPart() {
    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, SplitText = window.SplitText;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    if (lenis) lenis.on('scroll', ScrollTrigger.update);

    /* film: scroll-scrubbed frame sequence */
    function pad(n, w) { return String(n).padStart(w, '0'); }
    function film(sec) {
      var stage = sec.querySelector('.film-stage');
      var canvas = sec.querySelector('.film-canvas');
      var layers = [].slice.call(sec.querySelectorAll('[data-in]'));
      var ctx = canvas.getContext('2d', { alpha: false });
      var pattern = (small && sec.dataset.framesM) || sec.dataset.frames;
      var count = +((small && sec.dataset.nM) || sec.dataset.n);
      var frames = new Array(count), cur = -1, want = 0, started = false;
      var zoom = sec.querySelector('.film-zoom');
      function size() {
        var dpr = Math.min(devicePixelRatio || 1, small ? 2 : 1.5);
        canvas.width = Math.round(stage.clientWidth * dpr);
        canvas.height = Math.round(stage.clientHeight * dpr);
        cur = -1; draw(want);
      }
      function nearest(i) {
        for (var d = 0; d < count; d++) {
          var a = frames[i - d], b = frames[i + d];
          if (a && a.complete && a.naturalWidth) return a;
          if (b && b.complete && b.naturalWidth) return b;
        }
        return null;
      }
      function draw(i) {
        want = i;
        if (i === cur) return;
        var img = nearest(i);
        if (!img) return;
        var cw = canvas.width, ch = canvas.height;
        var s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        var fx = small ? 0.5 : +(sec.dataset.focus || 0.5);
        ctx.drawImage(img, (cw - dw) * fx, (ch - dh) / 2, dw, dh);
        cur = (img === frames[i]) ? i : -1;
        if (!sec.classList.contains('live')) sec.classList.add('live');
      }
      function loadFrame(i) {
        if (frames[i]) return;
        var img = new Image();
        img.decoding = 'async';
        img.onload = function () { if (Math.abs(i - want) < 4) { cur = -1; draw(want); } };
        img.src = pattern.replace('{i}', pad(i + 1, 3));
        frames[i] = img;
      }
      function start() {
        if (started) return; started = true;
        loadFrame(0);
        for (var i = 0; i < count; i += 6) loadFrame(i);
        var rest = function () { for (var j = 0; j < count; j++) loadFrame(j); };
        'requestIdleCallback' in window ? requestIdleCallback(rest, { timeout: 1500 }) : setTimeout(rest, 400);
      }
      // frames start loading one screen before the film enters the viewport
      var pcUrl = sec.dataset.pc, pcView = null, lastP = 0;
      if (!pcUrl) new IntersectionObserver(function (es, io) { if (es[0].isIntersecting) { start(); io.disconnect(); } }, { rootMargin: '100% 0px' }).observe(sec);
      /* real lidar point cloud (desktop, no Save-Data): loads after the page, only once the hero is on screen;
         parsing runs in a worker; phones and Save-Data keep the rendered poster with a light parallax */
      var netInfo = navigator.connection, lowData = !!(netInfo && netInfo.saveData);
      if (pcUrl && !small && !lowData && window.Worker) {
        var pcCanvas = sec.querySelector('.pc-canvas'), rd = sec.querySelector('.pc-readout b');
        var go = function () {
          import('/assets/js/pc/pc.js').then(function (mod) {
            return mod.mount(pcCanvas, { url: pcUrl, onReadout: function (d) { if (rd) rd.textContent = d.toFixed(1); } });
          }).then(function (v) { pcView = v; v.setProgress(lastP); sec.classList.add('pc-live'); doc.dataset.pc = v.backend; })
            .catch(function () { sec.classList.add('pc-fail'); });
        };
        new IntersectionObserver(function (es, io) {
          if (!es[0].isIntersecting) return; io.disconnect();
          'requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 1200 }) : setTimeout(go, 300);
        }).observe(sec);
      }

      function setLayers(p) {
        layers.forEach(function (el) {
          var a = +el.dataset.in, b = +el.dataset.out, f = 0.05, o = 0;
          if (p >= a && p <= b) o = Math.min(1, (p - a) / f, (b - p) / f);
          if (a === 0 && p < f) o = 1;
          if (b >= 1 && p > b - f) o = 1;
          var y = (1 - o) * (p < a + f ? 40 : -40);
          el.style.opacity = o.toFixed(3);
          el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
          el.style.visibility = o < 0.02 ? 'hidden' : 'visible';
        });
      }
      addEventListener('resize', size, { passive: true });
      size();
      var bar = sec.querySelector('.film-progress i');
      ScrollTrigger.create({
        trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true,
        onUpdate: function (st) {
          var p = st.progress; lastP = p;
          if (pcView) pcView.setProgress(p); else if (count) draw(Math.min(count - 1, Math.round(p * (count - 1))));
          setLayers(p);
          if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
          if (zoom) {
            var z = Math.max(0, (p - 0.55) / 0.45);
            zoom.style.transform = 'scale(' + (0.6 + z * 0.4).toFixed(3) + ')';
            zoom.style.letterSpacing = (0.3 - z * 0.32).toFixed(3) + 'em';
          }
        }
      });
    }
    if (!lite) document.querySelectorAll('.film:not(.is-static)').forEach(film);

    /* headings: GSAP SplitText lines with masks; autoSplit re-splits on resize / font load */
    document.querySelectorAll('[data-split]').forEach(function (h) {
      SplitText.create(h, { type: 'lines', mask: 'lines', autoSplit: true, aria: 'auto',
        onSplit: function (self) {
          return gsap.from(self.lines, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08,
            scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
        } });
    });

    /* tagline: words light up with scroll */
    document.querySelectorAll('[data-lightup]').forEach(function (p) {
      SplitText.create(p, { type: 'words', autoSplit: true, aria: 'auto',
        onSplit: function (self) {
          return gsap.fromTo(self.words, { opacity: small ? 1 : 0.16 }, { opacity: 1, stagger: 0.1, ease: 'none',
            scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 40%', scrub: true } });
        } });
    });

    /* module cards: pinned horizontal track on desktop; cards skew with scroll velocity */
    var hs = document.querySelector('.hscroll');
    if (hs && !small && matchMedia('(min-width: 961px)').matches) {
      hs.classList.add('pinned');
      var track = hs.querySelector('.bento');
      var dist = function () { return Math.max(0, track.scrollWidth - hs.querySelector('.wrap').clientWidth + 80); };
      var skewTo = gsap.quickTo(track.children, 'skewX', { duration: 0.5, ease: 'power3.out' });
      gsap.to(track, { x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: hs, start: 'top 12%', end: function () { return '+=' + Math.round(dist() * 0.5); }, pin: true, scrub: 0.6, invalidateOnRefresh: true,
          /* scroll snap: the track settles on a card edge when the wheel stops */
          snap: { snapTo: function (v) { var d = dist() || 1, pts = [].map.call(track.children, function (c) { return Math.min(1, c.offsetLeft / d); }); pts.push(1); return gsap.utils.snap(pts, v); },
                  duration: { min: 0.25, max: 0.7 }, delay: 0.12, ease: 'power2.inOut' },
          onUpdate: function (st) { skewTo(gsap.utils.clamp(-8, 8, st.getVelocity() / -260)); } } });
    }

    /* module cards: rise in a fan, tilt on hover */
    var cards = gsap.utils.toArray('.pcard');
    if (cards.length) {
      gsap.set(cards, { y: 80, opacity: 0, rotate: function (i) { return (i % 2 ? 2 : -2); } });
      ScrollTrigger.batch(cards, { start: 'top 90%', once: true,
        onEnter: function (b) { gsap.to(b, { y: 0, opacity: 1, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 }); } });
      if (!coarse) cards.forEach(function (c) {
        var img = c.querySelector('.ph img');
        var rx = gsap.quickTo(c, 'rotationX', { duration: 0.6, ease: 'power3.out' }), ry = gsap.quickTo(c, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        c.addEventListener('pointermove', function (e) {
          var r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          ry(px * 6); rx(-py * 6);
          c.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%'); c.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
          if (img) gsap.to(img, { x: px * 18, y: py * 14, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
        });
        c.addEventListener('pointerleave', function () { rx(0); ry(0); if (img) gsap.to(img, { x: 0, y: 0, duration: 0.8, ease: 'power3.out' }); });
      });
    }

    /* count-up (real numbers only, written in the HTML) */
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var to = +el.dataset.count, from = +(el.dataset.from || 0), o = { v: from };
      ScrollTrigger.create({ trigger: el, start: 'top 97%', once: true,
        onEnter: function () { el.textContent = from; gsap.to(o, { v: to, duration: 0.45, ease: 'expo.out', onUpdate: function () { el.textContent = Math.round(o.v); } }); } });
    });
    ScrollTrigger.refresh();
  }
})();
