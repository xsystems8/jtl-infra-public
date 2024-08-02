import { global } from './global';
import { currentTime, currentTimeString } from './utils/date-time';
const LOG_MAX_MESSAGES = 200;

export function log(event: string, msg: string, args: Record<string, any> = {}, showInConsole = false) {
  _updateLog('log', event, msg, args, showInConsole);
}

export function trace(event: string, msg: string, args: Record<string, any> = {}, showInConsole = false) {
  _updateLog('trace', event, msg, args, showInConsole);
}

export function warning(event: string, msg: string, args: Record<string, any> = {}, showInConsole = false) {
  _updateLog('error', event, 'warning ⚠️ ' + msg, args, showInConsole);
}

export function error(event: string, msg?: string, args: Record<string, any> = {}, showInConsole = false) {
  let stack;

  if (args['e'] && args['e'].stack) {
    // log('error', 'KEYS', Object.keys(args['e']), true);
    // log('error', 'Stack', args['e'].stack, true);
    // log('error', 'Context', args['e'].context, true);

    // for (let key in Object.keys(args['e'])) {
    //   log('error', key, args['e'][key], true);
    // }

    if (args['e']?.context) {
      args = { ...args['e'].context, ...args };
    }

    stack = args['e'].stack;
    args['e'] = stack.split('\n');
  } else {
    stack = new Error().stack;
    args['e'] = stack.split('\n');
  }

  global.errorCount++;

  _updateLog('error', event, msg, args);

  let time = currentTimeString();
  console.error(`${event} at ${time} ❌ ${msg} `, args);

  //TODO: разработаь алгоритм остановки скрипта при привышении количества ошибок в определенный промежуток времени
  if (isTester()) {
    if (global.errorCount > 30) {
      let errCnt = global.errorCount;
      global.errorCount = 0;
      global.strategy.forceStop('Too many errors count=' + errCnt);
    }
  } else {
    if (global.errorCount > 10) {
      let errCnt = global.errorCount;

      global.errorCount = 0;
      global.strategy.forceStop('Too many errors count =' + errCnt);
    }
    if (global.lastErrorTime + 60 * 60 * 1000 > currentTime()) {
      global.errorCount = 0;
      global.lastErrorTime = currentTime();
    }
  }
}

export function getLogs(type: string) {
  if (type === 'logOnce') {
    return Array.from(global.logOnce.values());
  }
  if (global.logs[type] === undefined) {
    global.logs[type] = [];
  }
  return global.logs[type];
}

function isMessageLogged(event: string, msg: string, ttl = 0) {
  if (global.logOnce === undefined) global.logOnce = new Map();
  let key = event + msg;
  ttl = ttl ? ttl : 86400000 * 365 * 10; // 10 years
  let nextTime = tms() + ttl;

  if (global.logOnce.has(key) === false) {
    global.logOnce.set(key, ttl);
    return false;
  } else if (global.logOnce.get(key) < tms()) {
    global.logOnce.set(key, ttl);
    return false;
  }

  return true;
}
export const logOnce = function (event, msg, args = {}, ttl = 0) {
  global.logOnce.set(event, { date: currentTimeString(), event, msg, args });
  if (global.logOnce.size > 1000) {
    global.logOnce.clear();
    log('logOnce', 'logOnce cache cleared due to size > 1000');
  }
};

// export const logOnce = function (event, msg, args = {}, ttl = 0) {
//   if (!isMessageLogged(event, msg, ttl)) {
//     log(event, msg, args);
//   }
// };

export const traceOnce = function (event, msg, args = {}, ttl = 0) {
  if (!isMessageLogged(event, msg, ttl)) {
    trace(event, msg, args);
  }
};

export const errorOnce = function (event, msg, args = {}, ttl = 0) {
  if (!isMessageLogged(event, msg, ttl)) {
    error(event, msg, args);
    return true;
  }
  return false;
};

export const warningOnce = function (event, msg, args = {}, ttl = 0) {
  if (!isMessageLogged(event, msg, ttl)) {
    warning(event, msg, args);
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

  //let argsN = Object.assign({}, args);
  let argsN = JSON.stringify(args);
  global.logs[type].push({ date: currentTimeString(), event: event, msg: msg, args: argsN });

  if (showInConsole) {
    if (type === 'log') {
      console.log(event + ' | ' + msg, args);
    }
    if (type === 'trace') {
      console.log(event + ' | ' + msg, args);
    }

    if (type === 'warning') {
      console.warn(event + ' | ' + msg, args);
    }
  }
}
