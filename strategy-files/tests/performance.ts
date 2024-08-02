import { global } from '../global';
import { trace } from '../log';
import { BaseObject } from '../base-object';

export class PerformanceAnalyzer extends BaseObject {
  _buffer = [];

  constructor() {
    super();
    global.events.subscribe('onStop', this.onStop, this);
  }

  async onStop() {
    global.report.tableUpdate('Performance stats', Object.values(this.stats) as Record<string, any>);
  }

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
  observeObject(obj, objName = '') {
    if (objName === '') objName = obj.constructor.name;

    const properties = Object.getOwnPropertyNames(obj); // all properties of object (
    for (const propName of properties) {
      if (typeof obj[propName] !== 'function') continue;
      const funcOriginal = obj[propName];
      obj[propName] = this.changeFunction(funcOriginal, objName, propName);
    }
  }

  observeFunction(fn, nameLib = 'base') {
    fn = this.changeFunction(fn, nameLib);
  }

  stats = {};
  isAsync(fn) {
    return fn.constructor.name === 'AsyncFunction';
  }
  changeFunction = (fn, obgName = '', funcName = '') => {
    const stats = this.stats;
    funcName = funcName === '' ? fn.name : funcName;
    if (this.isAsync(fn)) {
      trace('PerformanceAnalyzer::changeFunction', `Async function ${obgName}:${funcName} is observed`);
      return async (...args) => {
        const t1 = Date.now();
        const result = await fn(...args);
        const t2 = Date.now();

        const fullFnName = 'async ' + obgName + ':' + funcName;
        if (this.stats[fullFnName] === undefined) {
          this.stats[fullFnName] = { name: fullFnName, cnt: 1, time: t2 - t1 };
        } else {
          this.stats[fullFnName].cnt++;
          this.stats[fullFnName].time += t2 - t1;
        }

        return result;
      };
    } else {
      trace('PerformanceAnalyzer::changeFunction', `Function ${obgName}:${funcName} is observed`);
      return (...args) => {
        const t1 = Date.now();
        const result = fn(...args);
        const t2 = Date.now();

        const fullFnName = obgName + ':' + funcName;
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
