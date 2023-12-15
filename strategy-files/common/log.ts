import { global } from './global';
import { currentTimeString } from './utils/date-time';
const LOG_MAX_MESSAGES = 200;

export function log(event: string, msg: string, args: Record<string, any> = {}, showInConsole = false) {
  _updateLog('log', event, msg, args, showInConsole);
}

export function trace(event: string, msg: string, args: Record<string, any> = {}, showInConsole = false) {
  _updateLog('trace', event, msg, args, showInConsole);
}

export function warning(event: string, msg: string, args: Record<string, any> = {}, showInConsole = false) {
  error(event, '⚠️ ' + msg, args, showInConsole);
}

export function error(event: string, msg?: string, args: Record<string, any> = {}, showInConsole = false) {
  let stack;
  if (args['e'] && args['e'].stack) {
    stack = args['e'].stack;
    args['e'] = stack.split('\n');
  } else {
    stack = new Error().stack;

    args['e'] = stack.split('\n');
  }

  global.errorCount++;
  _updateLog('error', event, msg, args);

  let time = currentTimeString();
  console.error(`${event} at ${time} ❌ ${msg}  \nTrace: \n` + stack);

  if (global.errorCount > 100) {
    throw new Error('_error() Too many errors ');
  }
}

export function getLogs(type) {
  if (global.logs[type] === undefined) {
    global.logs[type] = [];
  }
  return global.logs[type];
}

function _isMessageLogged(event: string, msg: string, ttl = 0) {
  if (global.logOnce === undefined) global.logOnce = new Map();
  let key = event + msg;

  if (global.logOnce.has(key) === false) {
    global.logOnce.set(key, true);
    return false;
  }
  return true;
}

export const logOnce = function (event, msg, args = {}) {
  if (!_isMessageLogged(event, msg)) {
    log(event, msg, args);
  }
};

export const traceOnce = function (event, msg, args = {}) {
  if (!_isMessageLogged(event, msg, args)) {
    trace(event, msg, args);
  }
};

export const errorOnce = function (event, msg, args = {}) {
  if (!_isMessageLogged(event, '❌ ' + msg, args)) {
    error(event, msg, args);
    return true;
  }
  return false;
};

export const warningOnce = function (event, msg, args = {}) {
  if (!_isMessageLogged(event, '⚠️ ' + msg, args)) {
    error(event, '⚠️ ' + msg, args);
  }
};

export function debugLog(...args: any[]) {
  console.log({ date: currentTimeString(), ...args });

  log('debugLog', '', { ...args });
}

type LogType = 'log' | 'trace' | 'warning' | 'error';

function _updateLog(type: LogType, event: string, msg: string, args: Record<string, any> = {}, showInConsole = false) {
  if (global.logs[type] === undefined) {
    global.logs[type] = [];
  }
  if (global.logs[type].length > LOG_MAX_MESSAGES + 50) {
    global.logs[type].slice(-LOG_MAX_MESSAGES);
  }

  global.logs[type].push({ date: currentTimeString(), event: event, msg: msg, args: args });

  if (showInConsole) {
    if (type === 'log') {
      console.log(event + ' | ' + msg, args);
    }
    if (type === 'trace') {
      console.trace(event + ' | ' + msg, args);
    }

    if (type === 'warning') {
      console.warn(event + ' | ' + msg, args);
    }
  }
}
