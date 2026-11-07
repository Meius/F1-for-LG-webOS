// Background service of the F1 for LG webOS app. The app calls /start when it opens; the service then attaches to the app's pages
// (see injector.js) and keeps itself alive until the app has been closed for two minutes.
'use strict';
var Service = require('webos-service');
var fs = require('fs');
var path = require('path');
var injector = require('./injector');

var SERVICE_ID = require('./package.json').name;       // e.g. io.github.meius.f1tv.service
var APP_ID = SERVICE_ID.replace(/\.service$/, '');      // e.g. io.github.meius.f1tv
var LOG = '/tmp/' + APP_ID + '.log';

function log(s) {
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 50000) fs.writeFileSync(LOG, '');
    fs.appendFileSync(LOG, new Date().toISOString().replace('T', ' ').slice(0, 19) + ' ' + s + '\n');
  } catch (e) {}
}

var service = new Service(SERVICE_ID);
var keepAlive = null;

function holdOpen() {
  if (keepAlive) return;
  // a dynamic service is stopped when idle; an activity keeps it running while the app is open
  service.activityManager.create('keepAlive', function (activity) { keepAlive = activity; });
}

function letGo() {
  if (!keepAlive) return;
  service.activityManager.complete(keepAlive, function () {});
  keepAlive = null;
  log('app closed, service may stop');
}

service.register('start', function (message) {
  holdOpen();
  var answered = false;
  function answer(err, found) {
    if (answered) return;
    answered = true;
    // give the first connection a moment to set things up before the app opens F1 TV
    setTimeout(function () {
      var st = injector.status();
      message.respond({ returnValue: true, attached: st.attached, debugPort: !err, page: !!found });
    }, 600);
  }
  if (injector.status().running) return answer(null, true);
  injector.start(APP_ID, { log: log, idleMs: 120000, onIdle: letGo, onFirstTick: answer });
  log('started');
});

service.register('status', function (message) {
  var st = injector.status();
  message.respond({ returnValue: true, running: st.running, attached: st.attached, version: readVersion() });
});

function readVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version; } catch (e) { return ''; }
}
