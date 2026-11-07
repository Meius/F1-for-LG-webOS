// Minimal WebSocket client (RFC 6455) on plain Node.js `http`, for the old Node versions on webOS TVs
// (webOS 5 ships Node 8 or 12; there is no built-in WebSocket before Node 21). Text frames only, which is all the
// Chrome DevTools Protocol needs. Usage: const ws = connect(url); ws.on('open'|'message'|'close'), ws.send(str), ws.close().
'use strict';
var http = require('http');
var crypto = require('crypto');
var urlLib = require('url');
var EventEmitter = require('events').EventEmitter;

function frame(opcode, payload) {
  var len = payload.length, hdr;
  if (len < 126) { hdr = Buffer.alloc(2); hdr[1] = 0x80 | len; }
  else if (len < 65536) { hdr = Buffer.alloc(4); hdr[1] = 0x80 | 126; hdr.writeUInt16BE(len, 2); }
  else { hdr = Buffer.alloc(10); hdr[1] = 0x80 | 127; hdr.writeUInt32BE(0, 2); hdr.writeUInt32BE(len, 6); }
  hdr[0] = 0x80 | opcode;
  var mask = crypto.randomBytes(4), body = Buffer.alloc(len);
  for (var i = 0; i < len; i++) body[i] = payload[i] ^ mask[i & 3]; // clients must mask
  return Buffer.concat([hdr, mask, body]);
}

function connect(url) {
  var u = urlLib.parse(url);
  var ee = new EventEmitter();
  var sock = null, closed = false;

  ee.send = function (str) { if (sock && !closed) sock.write(frame(0x1, Buffer.from(String(str), 'utf8'))); };
  ee.close = function () {
    if (closed) return;
    closed = true;
    try { sock && sock.end(frame(0x8, Buffer.alloc(0))); } catch (e) {}
    ee.emit('close');
  };

  var req = http.request({
    host: u.hostname, port: u.port, path: u.path,
    headers: {
      Connection: 'Upgrade', Upgrade: 'websocket',
      'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Version': '13'
    }
  });

  req.on('upgrade', function (res, s, head) {
    sock = s;
    var buf = head && head.length ? head : Buffer.alloc(0), parts = [];

    function parse() {
      while (buf.length >= 2) {
        var b0 = buf[0], b1 = buf[1], op = b0 & 0x0f, fin = (b0 & 0x80) !== 0, len = b1 & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = buf.readUInt32BE(6); off = 10; }
        var masked = (b1 & 0x80) !== 0;
        if (masked) off += 4;
        if (buf.length < off + len) return;
        var payload = Buffer.from(buf.slice(off, off + len));
        if (masked) { var mk = buf.slice(off - 4, off); for (var j = 0; j < payload.length; j++) payload[j] ^= mk[j & 3]; }
        buf = buf.slice(off + len);
        if (op === 0x8) { ee.close(); return; }            // close
        if (op === 0x9) { sock.write(frame(0xA, payload)); continue; } // ping -> pong
        if (op === 0xA) continue;                           // pong
        parts.push(payload);
        if (fin) { var msg = Buffer.concat(parts).toString('utf8'); parts = []; ee.emit('message', msg); }
      }
    }

    s.on('data', function (d) { buf = Buffer.concat([buf, d]); parse(); });
    s.on('close', function () { if (!closed) { closed = true; ee.emit('close'); } });
    s.on('error', function () { if (!closed) { closed = true; ee.emit('close'); } });
    ee.emit('open');
    setImmediate(parse);
  });
  req.on('response', function () { ee.emit('error', new Error('no websocket upgrade')); ee.close(); });
  req.on('error', function (e) { ee.emit('error', e); if (!closed) { closed = true; ee.emit('close'); } });
  req.end();
  return ee;
}

module.exports = { connect: connect };
