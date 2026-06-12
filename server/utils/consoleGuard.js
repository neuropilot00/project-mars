'use strict';

function installConsoleGuard(env = process.env, consoleRef = console) {
  if (env.NODE_ENV !== 'production') return false;

  const level = String(env.LOG_LEVEL || 'warn').toLowerCase();
  if (['debug', 'info', 'log', 'verbose'].includes(level)) return false;

  const originalLog = consoleRef.log.bind(consoleRef);
  consoleRef.log = (...args) => {
    if (String(env.LOG_LEVEL || '').toLowerCase() === 'debug') {
      originalLog(...args);
    }
  };
  return true;
}

module.exports = { installConsoleGuard };
