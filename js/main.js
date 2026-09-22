/* Hygiène Santé — comportements communs : menus, apparitions au défilement, vidéo d'accueil, parallaxe */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Méga-menu desktop (bouton « Spécialités ») ---------- */
  var megaToggle = document.querySelector('[data-mega-toggle]');
  var megaMenu = document.querySelector('[data-mega-menu]');
  if (megaToggle && megaMenu) {
    megaToggle.addEventListener('click', function () {
      var isOpen = megaMenu.classList.toggle('open');
      megaToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!megaMenu.contains(e.target) && !megaToggle.contains(e.target)) { megaMenu.classList.remove('open'); megaToggle.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { megaMenu.classList.remove('open'); megaToggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ---------- Menu mobile (hamburger) ---------- */
  var hamburger = document.querySelector('[data-hamburger]');
  var mobileMenu = document.querySelector('[data-mobile-menu]');
  var mobileClose = document.querySelector('[data-mobile-close]');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () { mobileMenu.classList.add('open'); document.body.style.overflow = 'hidden'; });
  }
  if (mobileClose && mobileMenu) {
    mobileClose.addEventListener('click', function () { mobileMenu.classList.remove('open'); document.body.style.overflow = ''; });
  }

  /* ---------- Apparitions douces (.reveal -> .in au passage à l'écran) ---------- */
  var io = null;
  function observeReveals() {
    var els = document.querySelectorAll('.reveal:not(.in)');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || reduce) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    io = io || new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- Repli : si l'observateur ne peut pas tourner, ne jamais laisser le contenu invisible ---------- */
  addEventListener('load', function () { setTimeout(function () { document.querySelectorAll('.reveal:not(.in)').forEach(function (e) { e.classList.add('in'); }); }, 2500); });

  /* ---------- Vidéo d'accueil : chargement différé, lecture/pause ---------- */
  function heroVideo() {
    var v = document.querySelector('[data-hero-video]'), t = document.querySelector('[data-hero-toggle]');
    if (!v) return;
    var c = navigator.connection || {};
    if (reduce || innerWidth < 800 || c.saveData || /(^|-)2g$/.test(c.effectiveType || '')) return;
    v.src = v.getAttribute('data-src'); v.muted = true; v.loop = true; v.playsInline = true;
    v.addEventListener('canplay', function () {
      var p = v.play();
      if (p && p.then) p.then(function () { v.classList.add('playing'); if (t) t.classList.add('on'); }).catch(function () {});
    }, { once: true });
    v.load();
    if (t) t.addEventListener('click', function () {
      if (v.paused) { v.play(); t.setAttribute('aria-label', 'Mettre la vidéo en pause'); t.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'; }
      else { v.pause(); t.setAttribute('aria-label', 'Lire la vidéo'); t.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>'; }
    });
  }

  /* ---------- Parallaxe douce des photos de fond ---------- */
  function parallax() {
    var els = [].slice.call(document.querySelectorAll('[data-parallax]'));
    if (!els.length || reduce) return;
    var busy = false;
    function tick() {
      busy = false;
      els.forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
        var p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        el.style.transform = 'translate3d(0,' + (p * -46).toFixed(1) + 'px,0) scale(1.14)';
      });
    }
    addEventListener('scroll', function () { if (!busy) { busy = true; requestAnimationFrame(tick); } }, { passive: true }); tick();
  }

  /* ---------- Repli AVIF -> WebP si une source AVIF échoue exceptionnellement ---------- */
  document.addEventListener('error', function (e) {
    var i = e.target; if (!i || i.tagName !== 'IMG' || i.getAttribute('data-fb')) return;
    var pic = i.parentNode; if (!pic || pic.tagName !== 'PICTURE') return;
    i.setAttribute('data-fb', '1'); [].slice.call(pic.querySelectorAll('source')).forEach(function (s) { s.parentNode.removeChild(s); });
    var src = i.getAttribute('src'); i.removeAttribute('srcset'); i.removeAttribute('sizes'); i.src = ''; i.src = src;
  }, true);

  /* ---------- Photos : la vraie image remplace le flou (placeholder) une fois chargée ---------- */
  function markLoaded(img) {
    if (!img.classList || !img.classList.contains('main')) return;
    img.classList.add('ok');
    var box = img.closest('.pmedia'); if (box) box.classList.add('done');
  }
  function hydrateImages() {
    document.querySelectorAll('.pmedia img.main').forEach(function (i) { if (i.complete && i.naturalWidth) markLoaded(i); });
  }
  document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') markLoaded(e.target); }, true);
  /* Repli : si « load » n'a pas pu être capté (image déjà en cache très tôt), on ne laisse jamais la photo bloquée floue */
  addEventListener('load', function () { setTimeout(hydrateImages, 300); });

  document.addEventListener('DOMContentLoaded', function () { observeReveals(); heroVideo(); parallax(); hydrateImages(); });
})();
