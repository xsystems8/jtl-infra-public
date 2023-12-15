import { global } from '../global';

export class PerformanceAnalyzer {
  _buffer = [];

  constructor() {
    global.events.subscribe('onStop', this.onStop);
  }

  onStop = async () => {
    global.report.tableUpdate('Performance stats', Object.values(this.stats) as Record<string, any>);
  };

  _observe(obj) {
    const buffer = this._buffer;
    const properties = Object.getOwnPropertyNames(obj);
    for (const key of properties) {
      if (typeof obj[key] !== 'function') continue;
      const original = obj[key];
      obj[key] = async function (...args) {
        const t1 = Date.now();
        const result = await original.call(this, ...args);
        const t2 = Date.now();
        //  globals.report.chartAddPointAgg('Date', 'onTick', t2 - t1, 'avg');

        buffer.push({ name: `Strategy:${original.name}`, ms: t2 - t1, args });
        if (original.name === 'onTick') {
          global.report.chartAddPointAgg('Date', 'onTick', t2 - t1, 'avg');
        }
        return result;
      };
    }
  }

  bufferCount = {};
  bufferTimes = {};
  observeObject(obj, name = '') {
    if (name === '') name = obj.constructor.name;

    const properties = Object.getOwnPropertyNames(obj);
    for (const key of properties) {
      if (typeof obj[key] !== 'function') continue;
      const original = obj[key];
      obj[key] = this.changeFunction(original, name);
    }
  }

  observeFunction(fn, nameLib = 'base') {
    fn = this.changeFunction(fn, nameLib);
  }

  stats = {};

  changeFunction = (fn, obgName = '') => {
    const stats = this.stats;

    if (this.isAsync(fn)) {
      return async (...args) => {
        const t1 = Date.now();
        const result = await fn(...args);
        const t2 = Date.now();

        const fullFnName = 'async ' + obgName + ':' + fn.name;
        if (this.stats[fullFnName] === undefined) {
          this.stats[fullFnName] = { name: fullFnName, cnt: 1, time: t2 - t1 };
        } else {
          this.stats[fullFnName].cnt++;
          this.stats[fullFnName].time += t2 - t1;
        }

        return result;
      };
    } else {
      return (...args) => {
        const t1 = Date.now();
        const result = fn(...args);
        const t2 = Date.now();

        const fullFnName = obgName + ':' + fn.name;
        if (this.stats[fullFnName] === undefined) {
          this.stats[fullFnName] = { name: fullFnName, cnt: 1, time: t2 - t1 };
        } else {
          this.stats[fullFnName].cnt++;
          this.stats[fullFnName].time += t2 - t1;
        }

        return result;
      };
    }
  };
  isAsync(fn) {
    return fn.constructor.name === 'AsyncFunction';
  }
  // _observeGlobalEmitter() {
  //   const buffer = this._buffer;
  //   const emitter = globals.events;
  //   emitter.emit = async function (eventName, data) {
  //     if (this.listeners[eventName]) {
  //       for (const listener of this.listeners[eventName]) {
  //         const t1 = Date.now();
  //         await listener(data);
  //         const t2 = Date.now();
  //         buffer.push({ name: `GlobalEmitter:${eventName}:${listener.name}`, ms: t2 - t1, args: data });
  //       }
  //     }
  //   };
  // }

  async call(func, ...args) {
    const t1 = Date.now();
    const result = await func(...args);
    const t2 = Date.now();

    this._buffer.push({ name: func.name, ms: t2 - t1, args });

    return result;
  }

  getBuffer() {
    return this._buffer;
  }

  prepareReport() {}

  getData() {
    const uniqueFunc = new Set();
    this._buffer.forEach((data) => uniqueFunc.add(data.name));

    const result = [];

    Array.from(uniqueFunc).forEach((funcName) => {
      const data = this._buffer.filter(({ name }) => name === funcName);
      const sum = data.reduce((res, curr) => (res += curr.ms), 0);
      const avg = sum / data.length;
      const max = Math.max(...data.map(({ ms }) => ms));
      result.push({ name: funcName, avgExecMs: avg, maxExecMs: max, execCount: data.length });
    });

    return result;
  }
}
