function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function runManagedTask(label, phase, task, options = {}) {
  return Promise.resolve()
    .then(task)
    .catch((error) => {
      if (options.silent) return;
      console.warn(`[${label}] ${phase} error:`, errorMessage(error));
    });
}

function scheduleTask(label, intervalMs, task, options = {}) {
  const {
    startDelayMs,
    phase = 'task',
    startPhase = 'startup',
    startedMessage,
    unref = false,
  } = options;

  if (typeof startDelayMs === 'number') {
    const startupTimer = setTimeout(() => runManagedTask(label, startPhase, task, options), startDelayMs);
    if (unref && startupTimer.unref) startupTimer.unref();
  }

  const timer = setInterval(() => runManagedTask(label, phase, task, options), intervalMs);
  if (unref && timer.unref) timer.unref();
  if (startedMessage) console.log(startedMessage);
  return timer;
}

function safeInitScheduler(label, init, initErrorMessage = 'Could not init scheduler') {
  try {
    return init();
  } catch (error) {
    console.warn(`[${label}] ${initErrorMessage}:`, errorMessage(error));
    return null;
  }
}

module.exports = {
  runManagedTask,
  safeInitScheduler,
  scheduleTask,
};
