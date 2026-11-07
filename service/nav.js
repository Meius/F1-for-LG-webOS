// Remote-control (arrow key) navigation for the F1 TV web player on an LG TV.
// Arrows move a visible focus frame between clickable things, OK clicks. In the video player: OK = pause/play,
// Left/Right = seek 10 s, Up/Down = show the player's controls and move between them.
(function () {
  if (window.__f1nav) return;
  window.__f1nav = true;

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13 };
  var SEL = 'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[role=option],[role=checkbox],[role=switch],' +
    'input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"]),[onclick]';
  var cur = null, lastRect = null, controlsMode = false;
  var IN_FRAME = window.top !== window;
  var ACCEPT = /^\s*(accept( all)?|agree|i agree|allow all|ok|got it|continue|godkänn( alla)?|acceptera( alla)?)\s*$/i;

  function preferred(list) {
    for (var i = 0; i < list.length; i++) {
      var t = (list[i].innerText || list[i].getAttribute('aria-label') || list[i].title || '').trim();
      if (ACCEPT.test(t) && inViewport(list[i].getBoundingClientRect())) return list[i];
    }
    return null;
  }

  // F1's cookie dialog is a frame from another site: while it is shown, send the remote's keys into it
  // (it has this navigation too) so it can be answered without the pointer.
  function consentFrame() {
    var fs = document.querySelectorAll('iframe');
    for (var i = 0; i < fs.length; i++) {
      if (!/consent\.formula1\.com/.test(fs[i].src || '')) continue;
      var r = fs[i].getBoundingClientRect();
      if (r.width > 150 && r.height > 80 && shownSimple(fs[i])) return fs[i];
    }
    return null;
  }
  function shownSimple(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }
  if (!IN_FRAME) {
    setInterval(function () {
      var f = consentFrame();
      if (f && document.activeElement !== f) { try { f.focus(); f.contentWindow.focus(); } catch (e) {} }
    }, 500);
  } else {
    // inside the dialog: mark its Accept button right away, so OK answers it
    var tries = 0, t = setInterval(function () {
      tries++;
      if (cur && document.contains(cur)) { clearInterval(t); return; }
      var p = preferred(candidates());
      if (p) { setFocus(p); clearInterval(t); }
      if (tries > 40) clearInterval(t);
    }, 300);
  }

  function addStyle() {
    if (document.getElementById('f1nav-style')) return;
    var s = document.createElement('style');
    s.id = 'f1nav-style';
    s.textContent = '.f1nav-focus{outline:4px solid #fff!important;outline-offset:2px!important;' +
      'box-shadow:0 0 0 8px rgba(225,6,0,.85)!important;border-radius:6px;transition:outline .1s}';
    (document.head || document.documentElement).appendChild(s);
  }

  function shown(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return false;
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    }
    return true;
  }

  // things that appeared after an OK press (menus such as "Watch live / Watch from start" built from plain elements
  // that are clickable for the mouse but not marked as buttons)
  var extras = [];

  // visible elements the page makes clickable for the mouse (cursor: pointer), taking the outermost of each
  function pointerEls() {
    var out = [], all = document.body ? document.body.getElementsByTagName('*') : [];
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (getComputedStyle(e).cursor !== 'pointer') continue;
      if (e.parentElement && getComputedStyle(e.parentElement).cursor === 'pointer') continue;
      var r = e.getBoundingClientRect();
      if (r.width < 6 || r.height < 6 || !inViewport(r)) continue;
      if (shown(e)) out.push(e);
    }
    return out;
  }

  function candidates(within) {
    extras = extras.filter(function (el) { return document.contains(el) && shown(el); });
    var list = Array.prototype.slice.call((within || document).querySelectorAll(SEL)).filter(function (el) {
      return !el.disabled && el.getAttribute('aria-hidden') !== 'true' && shown(el);
    });
    extras.forEach(function (el) { if (list.indexOf(el) < 0) list.push(el); });
    // keep the innermost clickable element (a menu item, not the menu around it)
    return list.filter(function (el) {
      return !list.some(function (o) { return o !== el && el.contains(o); });
    });
  }

  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function inViewport(r) { return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; }

  function pick(dir, list) {
    var from = cur && document.contains(cur) ? cur.getBoundingClientRect() : lastRect;
    if (!from) {
      // nothing chosen yet: an "Accept"-type button in a dialog, else the biggest visible thing below the top menu
      // (the main picture or video), not the menu
      var ok = preferred(list);
      if (ok) return ok;
      var vis = list.filter(function (el) { var r = el.getBoundingClientRect(); return inViewport(r) && (IN_FRAME || r.top > 110); });
      vis.sort(function (a, b) {
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return (rb.width * rb.height) - (ra.width * ra.height);
      });
      return vis[0] || list[0];
    }
    var c = center(from), best = null, bestScore = Infinity;
    list.forEach(function (el) {
      if (el === cur) return;
      var r = el.getBoundingClientRect(), p = center(r), dx = p.x - c.x, dy = p.y - c.y, main, side;
      if (dir === KEY.RIGHT) { if (r.left < from.right - 4 && dx <= 4) return; main = dx; side = Math.abs(dy); }
      if (dir === KEY.LEFT) { if (r.right > from.left + 4 && dx >= -4) return; main = -dx; side = Math.abs(dy); }
      if (dir === KEY.DOWN) { if (r.top < from.bottom - 4 && dy <= 4) return; main = dy; side = Math.abs(dx); }
      if (dir === KEY.UP) { if (r.bottom > from.top + 4 && dy >= -4) return; main = -dy; side = Math.abs(dx); }
      if (main <= 0) return;
      // prefer things in the same row/column: sideways distance counts heavily
      var score = main + side * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    return best;
  }

  function setFocus(el) {
    if (!el) return;
    if (cur) cur.classList.remove('f1nav-focus');
    cur = el;
    addStyle();
    el.classList.add('f1nav-focus');
    try { el.focus({ preventScroll: true }); } catch (e) {}
    // instant scroll, so the next key press measures where things really are
    var r0 = el.getBoundingClientRect();
    if (r0.top < 90 || r0.bottom > innerHeight - 20 || r0.left < 0 || r0.right > innerWidth) {
      try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' }); } catch (e) { el.scrollIntoView(); }
    }
    lastRect = el.getBoundingClientRect();
    // hover effects (previews, menus) as if the pointer was there
    ['mouseover', 'mouseenter'].forEach(function (t) {
      try { el.dispatchEvent(new MouseEvent(t, { bubbles: t === 'mouseover', cancelable: true, view: window })); } catch (e) {}
    });
  }

  function clearFocus() {
    if (cur) cur.classList.remove('f1nav-focus');
    cur = null;
  }

  function bigVideo() {
    var vs = document.querySelectorAll('video');
    for (var i = 0; i < vs.length; i++) {
      var r = vs[i].getBoundingClientRect();
      if (r.width > innerWidth * 0.6 && r.height > innerHeight * 0.6 && vs[i].readyState > 0) return vs[i];
    }
    return null;
  }

  function wakeControls(v) {
    var r = v.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.8;
    var target = document.elementFromPoint(x, y) || v;
    ['mousemove', 'mouseover', 'pointermove'].forEach(function (t) {
      try {
        var E = t.indexOf('pointer') === 0 && window.PointerEvent ? PointerEvent : MouseEvent;
        target.dispatchEvent(new E(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
      } catch (e) {}
    });
  }

  function click(el) {
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') { el.focus(); return; }
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(function (t) {
      try {
        var E = t.indexOf('pointer') === 0 && window.PointerEvent ? PointerEvent : MouseEvent;
        el.dispatchEvent(new E(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window, button: 0 }));
      } catch (e) {}
    });
    el.click();
  }

  // OK: click, then if a menu or dialog opened, move the frame into it (preferring "Watch live")
  var LIVE = /^\s*(watch live|live|watch now|play)\s*$/i;
  function activate(el) {
    var before = pointerEls(), clicked = el, page = location.href;
    click(el);
    function look() {
      if (cur !== clicked && cur && document.contains(cur)) return true; // focus already moved on
      if (location.href !== page || !document.contains(clicked)) return true; // a new page opened, not a menu
      var fresh = pointerEls().filter(function (e) { return before.indexOf(e) < 0 && e !== clicked; });
      if (!fresh.length || fresh.length > 8) return false; // nothing new, or a whole new view rather than a menu
      extras = fresh;
      var pick1 = null;
      for (var i = 0; i < fresh.length && !pick1; i++) if (LIVE.test(fresh[i].innerText || '')) pick1 = fresh[i];
      if (!pick1) {
        fresh.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
        pick1 = preferred(fresh) || fresh[0];
      }
      setFocus(pick1);
      return true;
    }
    setTimeout(function () { if (!look()) setTimeout(look, 500); }, 300);
  }

  window.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if ([KEY.LEFT, KEY.UP, KEY.RIGHT, KEY.DOWN, KEY.OK].indexOf(k) < 0) return;
    if (!IN_FRAME) {
      var cf = consentFrame();
      if (cf) { // the cookie dialog is open: it gets the keys, not the page behind it
        try { cf.focus(); cf.contentWindow.focus(); } catch (err) {}
        e.preventDefault(); e.stopImmediatePropagation();
        return;
      }
    }
    var ae = document.activeElement;
    var typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.type !== 'checkbox' && ae.type !== 'radio';
    if (typing && (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.OK)) return; // let the text field have them

    var v = bigVideo();
    if (cur && !document.contains(cur)) clearFocus();

    if (v && !controlsMode) {
      // watching: OK pauses/plays, Left/Right seek, Up/Down bring up the controls
      if (k === KEY.OK) { v.paused ? v.play() : v.pause(); wakeControls(v); }
      else if (k === KEY.LEFT || k === KEY.RIGHT) {
        var d = k === KEY.LEFT ? -10 : 10;
        try { v.currentTime = Math.max(0, v.currentTime + d); } catch (err) {}
        wakeControls(v);
      } else {
        wakeControls(v);
        controlsMode = true;
        setTimeout(function () { setFocus(pick(k, candidates())); }, 150);
      }
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }

    if (k === KEY.OK) {
      if (!cur) return;
      activate(cur);
    } else {
      if (v) wakeControls(v);
      var next = pick(k, candidates());
      if (next) setFocus(next);
      else if (v && controlsMode && (k === KEY.UP || k === KEY.DOWN)) { clearFocus(); controlsMode = false; } // off the controls: back to watching
      else window.scrollBy({ top: k === KEY.DOWN ? 300 : k === KEY.UP ? -300 : 0, behavior: 'smooth' });
    }
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  // when the pointer (Magic Remote) is used, hide the frame; arrows bring it back where the pointer was
  window.addEventListener('mousemove', function (e) {
    if (!e.isTrusted || !cur) return;
    lastRect = cur.getBoundingClientRect();
    cur.classList.remove('f1nav-focus');
    cur = null;
  }, true);

  // leaving the controls after a while of no keys, like a normal player
  var idle;
  window.addEventListener('keydown', function () {
    clearTimeout(idle);
    idle = setTimeout(function () { if (bigVideo()) { clearFocus(); controlsMode = false; } }, 6000);
  }, true);
})();
