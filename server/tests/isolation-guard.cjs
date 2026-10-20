'use strict';

// Preload for fixture tests only. Never load .env, database/mail/chain clients or
// open sockets. Tests inject their collaborators instead of reaching a service.
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const originalLoad = Module._load;
const forbidden = new Set(['dotenv', 'pg', 'ioredis', 'nodemailer', 'ethers']);
Module._load = function isolatedLoad(request, parent, isMain) {
  if (forbidden.has(String(request).split('/')[0])) {
    throw new Error('ISOLATED_TEST: inject a fixture instead of ' + request);
  }
  return originalLoad.call(this, request, parent, isMain);
};
function denyNetwork() { throw new Error('ISOLATED_TEST: network access is disabled'); }
net.Socket.prototype.connect = denyNetwork;
net.Server.prototype.listen = denyNetwork;
tls.connect = denyNetwork;
dns.lookup = denyNetwork;
dns.resolve = denyNetwork;
if (dns.promises) { dns.promises.lookup = denyNetwork; dns.promises.resolve = denyNetwork; }

function assertSafeFile(file) {
  const value = file instanceof URL ? file.pathname : String(file);
  if (path.basename(value).startsWith('.env') || /(?:^|\/)credentials(?:\/|$)/.test(value)) {
    throw new Error('ISOLATED_TEST: credential/config files are disabled');
  }
}
const readSync = fs.readFileSync;
fs.readFileSync = function guardedRead(file, ...args) {
  assertSafeFile(file);
  return readSync.call(this, file, ...args);
};
const read = fs.readFile;
fs.readFile = function guardedReadAsync(file, ...args) {
  assertSafeFile(file);
  return read.call(this, file, ...args);
};
const readPromise = fs.promises.readFile;
fs.promises.readFile = function guardedReadPromise(file, ...args) {
  assertSafeFile(file);
  return readPromise.call(this, file, ...args);
};
