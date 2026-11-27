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
  if (window.Lenis && !coarse) {
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
      new IntersectionObserver(function (es, io) { if (es[0].isIntersecting) { start(); io.disconnect(); } }, { rootMargin: '100% 0px' }).observe(sec);
      function setLayers(p) {
        layers.forEach(function (el) {
          var a = +el.dataset.in, b = +el.dataset.out, f = 0.07, o = 0;
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
          var p = st.progress;
          draw(Math.min(count - 1, Math.round(p * (count - 1))));
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
          return gsap.fromTo(self.words, { opacity: 0.16 }, { opacity: 1, stagger: 0.1, ease: 'none',
            scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 40%', scrub: true } });
        } });
    });

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
          ry(px * 8); rx(-py * 8);
          c.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%'); c.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
          if (img) gsap.to(img, { x: px * 18, y: py * 14, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
        });
        c.addEventListener('pointerleave', function () { rx(0); ry(0); if (img) gsap.to(img, { x: 0, y: 0, duration: 0.8, ease: 'power3.out' }); });
      });
    }

    /* count-up (real numbers only, written in the HTML) */
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var to = +el.dataset.count, from = +(el.dataset.from || 0), o = { v: from };
      ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true,
        onEnter: function () { el.textContent = from; gsap.to(o, { v: to, duration: 1.8, ease: 'expo.out', onUpdate: function () { el.textContent = Math.round(o.v); } }); } });
    });
    ScrollTrigger.refresh();
  }
})();
