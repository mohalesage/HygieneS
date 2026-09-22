/* Hygiène Santé — catalogue (filtre/recherche), fiche produit (zoom), devis (panier local), formulaires */
(function () {
  'use strict';
  var CFG = {};
  try { CFG = JSON.parse(document.getElementById('hs-config').textContent || '{}'); } catch (e) {}
  var KEY = 'hs-devis-v1';

  function cart() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function saveCart(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} updateCounts(); }
  function updateCounts() {
    var n = cart().reduce(function (s, i) { return s + i.qte; }, 0);
    document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = n; el.hidden = n === 0; });
  }
  function addToCart(slug, nom, marque) {
    var c = cart(), it = c.find(function (i) { return i.slug === slug; });
    if (it) { it.qte++; } else { c.push({ slug: slug, nom: nom, marque: marque, qte: 1 }); }
    saveCart(c);
  }
  window.HSCart = { add: addToCart, get: cart, save: saveCart };

  /* ---------- WhatsApp : texte encodé avec la liste du devis ---------- */
  function waMessage() {
    var c = cart();
    if (!c.length) return 'Bonjour, je souhaite un devis.';
    var lines = c.map(function (i) { return '- ' + i.nom + (i.marque ? ' (' + i.marque + ')' : '') + ' × ' + i.qte; });
    return 'Bonjour, je souhaite un devis pour :\n' + lines.join('\n');
  }
  function refreshWaLinks() {
    if (!CFG.whatsapp) return;
    document.querySelectorAll('[data-wa]').forEach(function (a) {
      if (a.hasAttribute('data-wa-product')) return;                     // lien produit : texte fixe, ne pas écraser
      a.href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(waMessage());
    });
  }

  /* ---------- délégation : boutons "ajouter au devis" ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add-devis]');
    if (!b) return;
    addToCart(b.getAttribute('data-slug'), b.getAttribute('data-nom'), b.getAttribute('data-marque') || '');
    refreshWaLinks(); renderDevis();
    var t = b.textContent; b.textContent = 'Ajouté ✓'; b.disabled = true;
    setTimeout(function () { b.textContent = t; b.disabled = false; }, 1400);
  });

  /* ---------- page /devis/ ---------- */
  function renderDevis() {
    var list = document.getElementById('dq-list'); if (!list) return;
    var c = cart();
    if (!c.length) { list.innerHTML = '<p class="dq-empty">Votre demande est vide. Parcourez le catalogue et ajoutez les équipements qui vous intéressent.</p>'; return; }
    list.innerHTML = c.map(function (i, idx) {
      return '<div class="dq-row" data-idx="' + idx + '"><div style="flex:1"><div class="dq-brand">' + esc(i.marque || '') + '</div><div class="dq-name">' + esc(i.nom) + '</div></div>' +
        '<div class="dq-qty"><button type="button" data-dec aria-label="Diminuer la quantité">−</button><span>' + i.qte + '</span><button type="button" data-inc aria-label="Augmenter la quantité">+</button></div>' +
        '<button type="button" class="dq-remove" data-del aria-label="Retirer ' + esc(i.nom) + '"><svg class="icon" viewBox="0 0 24 24" style="width:18px;height:18px"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    }).join('');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  document.addEventListener('click', function (e) {
    var row = e.target.closest('.dq-row'); if (!row) return;
    var idx = +row.getAttribute('data-idx'), c = cart();
    if (e.target.closest('[data-inc]')) c[idx].qte++;
    else if (e.target.closest('[data-dec]')) { c[idx].qte--; if (c[idx].qte <= 0) c.splice(idx, 1); }
    else if (e.target.closest('[data-del]')) c.splice(idx, 1);
    else return;
    saveCart(c); refreshWaLinks(); renderDevis();
  });

  /* ---------- formulaires (devis + contact) : envoi si configuré, sinon message clair ---------- */
  function bindForm(id, type) {
    var f = document.getElementById(id); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = document.getElementById(id.replace('-form', '-note')) || document.getElementById(type + '-note');
      if (f.website && f.website.value) return;                          // piège anti-robot
      if (!f.checkValidity()) { f.reportValidity(); return; }
      var data = { type: type, nom: f.nom.value.trim(), etablissement: (f.etablissement && f.etablissement.value.trim()) || '', fonction: (f.fonction && f.fonction.value.trim()) || '',
        ville: (f.ville && f.ville.value.trim()) || '', email: f.email.value.trim(), telephone: f.telephone.value.trim(), message: f.message.value.trim(),
        produits: type === 'devis' ? cart() : [] };
      var btn = f.querySelector('button[type=submit]'), old = btn.textContent; btn.disabled = true; btn.textContent = 'Envoi…';
      fetch(CFG.endpoint || '/api/devis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (res) { showDone(f, type, res && res.numero); })
        .catch(function () {
          btn.disabled = false; btn.textContent = old;
          if (note) { note.textContent = 'L’envoi automatique n’est pas disponible ici. Écrivez-nous à ' + (CFG.email || 'contact@hygienesante.ma') + ' ou appelez le ' + (CFG.tel || '') + '.'; note.style.color = '#8a2a0f'; }
        });
    });
  }
  function showDone(f, type, numero) {
    var done = document.getElementById(type === 'devis' ? 'dq-done' : 'contact-done');
    if (done) {
      done.hidden = false;
      done.innerHTML = '<h3 class="serif">Votre demande est bien envoyée</h3><p>' + (numero ? 'Numéro de suivi : <strong>' + esc(numero) + '</strong>. ' : '') + 'Notre équipe vous répond dans les meilleurs délais.</p>';
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    f.hidden = true;
    if (type === 'devis') { saveCart([]); refreshWaLinks(); }
  }

  /* ---------- fiche produit : zoom, miniatures, visionneuse ---------- */
  function initProduct() {
    var zoom = document.querySelector('[data-zoom]'); if (!zoom) return;
    var slides = zoom.querySelectorAll('.zslide'), thumbs = document.querySelectorAll('[data-thumbs] .thumb'), cur = 0;
    function show(i) {
      cur = i;
      slides.forEach(function (s, k) { s.hidden = k !== i; });
      thumbs.forEach(function (t, k) { k === i ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current'); });
    }
    thumbs.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });
    zoom.addEventListener('mousemove', function (e) {
      var r = zoom.getBoundingClientRect();
      zoom.style.setProperty('--ox', ((e.clientX - r.left) / r.width * 100) + '%'); zoom.style.setProperty('--oy', ((e.clientY - r.top) / r.height * 100) + '%');
      zoom.classList.add('hot');
    });
    zoom.addEventListener('mouseleave', function () { zoom.classList.remove('hot'); });
    var lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = '<figure style="margin:0"><img alt=""><figcaption></figcaption></figure><button class="x" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      (slides.length > 1 ? '<button class="pv" aria-label="Précédente"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button class="nx" aria-label="Suivante"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>' : '');
    document.body.appendChild(lb);
    var li = lb.querySelector('img'), lc = lb.querySelector('figcaption');
    function open(i) { show((i + slides.length) % slides.length); var s = slides[cur]; li.src = s.getAttribute('data-full'); li.alt = s.getAttribute('data-alt'); lc.textContent = s.getAttribute('data-alt'); lb.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }
    zoom.addEventListener('click', function () { open(cur); });
    zoom.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(cur); } });
    lb.querySelector('.x').addEventListener('click', close);
    var pv = lb.querySelector('.pv'), nx = lb.querySelector('.nx');
    if (pv) pv.addEventListener('click', function () { open(cur - 1); });
    if (nx) nx.addEventListener('click', function () { open(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) { if (!lb.classList.contains('open')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft' && pv) open(cur - 1); if (e.key === 'ArrowRight' && nx) open(cur + 1); });
  }

  /* ---------- catalogue : filtre par spécialité/marque + recherche ---------- */
  function initCatalogue() {
    var grid = document.getElementById('grid'); if (!grid) return;
    var cards = [].slice.call(grid.querySelectorAll('.pcard'));
    var chips = document.getElementById('chips'), brand = document.getElementById('brand'), q = document.getElementById('q'), count = document.getElementById('count'), empty = document.getElementById('empty');
    var params = new URLSearchParams(location.search);
    var state = { d: (location.pathname.match(/\/produits\/([a-z-]+)\/?$/) || [])[1] || '', b: params.get('marque') || '', q: params.get('q') || '' };
    brand.value = state.b; q.value = state.q;
    if (params.get('focus')) setTimeout(function () { q.focus(); }, 300);
    function norm(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
    function apply() {
      var nq = norm(state.q).split(/\s+/).filter(Boolean), shown = 0;
      cards.forEach(function (c) {
        var ok = (!state.d || c.getAttribute('data-spec') === state.d) && (!state.b || c.getAttribute('data-brand') === state.b) &&
          (!nq.length || nq.every(function (w) { return norm(c.getAttribute('data-q')).indexOf(w) > -1; }));
        c.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      count.textContent = shown + (shown > 1 ? ' produits' : ' produit');
      empty.hidden = shown > 0; grid.hidden = shown === 0;
      chips.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-d') === state.d ? 'true' : 'false'); });
    }
    chips.addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (!c) return; e.preventDefault(); state.d = c.getAttribute('data-d'); history.replaceState(null, '', c.getAttribute('href')); apply(); });
    brand.addEventListener('change', function () { state.b = brand.value; apply(); });
    var t; q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { state.q = q.value.trim(); apply(); }, 120); });
    var reset = document.getElementById('reset'); if (reset) reset.addEventListener('click', function () { state = { d: state.d, b: '', q: '' }; brand.value = ''; q.value = ''; apply(); });
    apply();
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateCounts(); refreshWaLinks(); renderDevis(); initProduct(); initCatalogue();
    bindForm('devis-form', 'devis'); bindForm('contact-form', 'contact');
  });
})();
