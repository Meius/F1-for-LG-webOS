// Attaches to the F1 TV app's pages through the TV's local web debugging port (Chrome DevTools Protocol on 127.0.0.1:9998)
// and, on every page the app loads:
//   1. adds remote-control (arrow key) navigation (nav.js),
//   2. asks F1's login for English. F1 has no login page for some languages (Swedish gives
//      "NoSuchKey ... davinci/id/1.0.2/sv/login.html"); only the language changes, the TV keeps its own browser identity.
// Written for old Node versions (webOS 5: Node 8): no async/await, no optional chaining.
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var wsLite = require('./ws-lite');

var PORT = 9998;
var NAV = fs.readFileSync(path.join(__dirname, 'nav.js'), 'utf8');
var attached = {};            // target id -> socket
var lastSeen = Date.now();    // last time an app page was open
var timer = null, logFn = function () {};

function list(cb) {
  var req = http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, function (res) {
    var d = '';
    res.on('data', function (c) { d += c; });
    res.on('end', function () { try { cb(null, JSON.parse(d)); } catch (e) { cb(e, []); } });
  });
  req.on('error', function (e) { cb(e, []); });
  req.setTimeout(3000, function () { req.abort(); });
}

function isOurs(t, appId) {
  if (t.type === 'page') return /formula1\.com/.test(t.url) || t.url.indexOf('/' + appId + '/') >= 0;
  // F1's cookie consent dialog runs in its own frame (its own debugging target): give it the navigation too
  if (t.type === 'iframe') return /^https:\/\/consent\.formula1\.com\//.test(t.url);
  return false;
}

function attach(t) {
  var ws = wsLite.connect(t.webSocketDebuggerUrl);
  attached[t.id] = ws;
  var id = 0, waiting = {};
  function send(method, params, cb) {
    id += 1;
    if (cb) waiting[id] = cb;
    ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
  }
  ws.on('error', function () {});
  ws.on('message', function (s) {
    var m; try { m = JSON.parse(s); } catch (e) { return; }
    if (m.id && waiting[m.id]) { var cb = waiting[m.id]; delete waiting[m.id]; cb(m); }
  });
  ws.on('open', function () {
    send('Page.enable');
    send('Page.addScriptToEvaluateOnNewDocument', { source: NAV });
    send('Runtime.evaluate', { expression: NAV });
    if (t.type === 'iframe') { logFn('attached consent dialog'); return; }
    send('Runtime.evaluate', { expression: 'navigator.userAgent', returnByValue: true }, function (r) {
      var ua = r && r.result && r.result.result && r.result.result.value;
      if (ua) {
        send('Network.enable');
        send('Network.setUserAgentOverride', { userAgent: ua, acceptLanguage: 'en-GB,en;q=0.9' });
      }
      send('Emulation.setLocaleOverride', { locale: 'en-GB' });
    });
    logFn('attached ' + t.url.slice(0, 90));
  });
  ws.on('close', function () { delete attached[t.id]; logFn('detached'); });
}

// Poll for the app's pages. onIdle() is called once no app page has been open for idleMs (the app was closed).
function start(appId, opts) {
  opts = opts || {};
  if (opts.log) logFn = opts.log;
  var idleMs = opts.idleMs || 120000;
  lastSeen = Date.now();
  if (timer) return;
  function tick(done) {
    list(function (err, pages) {
      if (err) logFn('debug port ' + PORT + ' not reachable: ' + err.message);
      var any = false;
      (pages || []).forEach(function (t) {
        if (!isOurs(t, appId)) return;
        any = true;
        if (!attached[t.id]) attach(t);
      });
      if (any) lastSeen = Date.now();
      else if (Date.now() - lastSeen > idleMs && opts.onIdle) { stop(); opts.onIdle(); }
      if (done) done(err, any);
    });
  }
  timer = setInterval(tick, 2000);
  tick(opts.onFirstTick);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  Object.keys(attached).forEach(function (k) { try { attached[k].close(); } catch (e) {} });
}

function status() { return { running: !!timer, attached: Object.keys(attached).length, port: PORT }; }

module.exports = { start: start, stop: stop, status: status };
