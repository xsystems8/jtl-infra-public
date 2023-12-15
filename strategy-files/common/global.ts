// import { Report } from './report/report.js';
// import { Triggers } from './events/triggers';
// import { Exchange } from './exchange/exchange';
// import { EventsEmitter } from './events/events-emitter';
// export const global = {
//   iterator: 0,
//   strategy: null,
//   trigger: new Triggers(),
//   report: new Report(),
//   exchange: new Exchange(),
//   events: new EventsEmitter(),
//
//   params: {},
//   sp: null,
//   basket: null,
//   logs: {},
//   logOnce: undefined,
// };

// export const global = {
//   iterator: 0,
//   strategy: null,
//   trigger: null,
//   report: null,
//   exchange: null,
//   events: null,
//   params: {},
//   sp: null,
//   basket: null,
//   logs: {},
//   logOnce: undefined,
//   errorCount: 0,
// };

import type { EventsEmitter } from './events/events-emitter';
import type { Triggers } from './events/triggers';
import type { Report } from './report/report';
import type { Exchange } from './exchange/exchange';
import { ExtendedScript } from './script/extended-script';

class stdGlobalVariables {
  iterator = 0;
  private _strategy: ExtendedScript = null;
  private _triggers: Triggers = null;
  private _report: Report = null;
  private _exchange: Exchange = null;
  private _events: EventsEmitter = null;
  params = {};
  sp = null;
  basket = null;
  logs = {};
  logOnce = undefined;
  errorCount = 0;

  constructor() {}

  set strategy(strategy) {
    this._strategy = strategy;
  }

  get strategy() {
    return this._strategy;
  }

  set events(events) {
    if (this._events) {
      throw new Error('EventsEmitter already set with id ' + this._events?.id);
    }
    this._events = events;
  }

  get events() {
    return this._events;
  }

  set triggers(trigger) {
    if (this._triggers) {
      throw new Error('Triggers already set with id ' + this._triggers?.id);
    }
    this._triggers = trigger;
  }

  get triggers() {
    return this._triggers;
  }

  set report(report) {
    if (this._report) {
      throw new Error('Report already set with id ' + this._report?.id);
    }
    this._report = report;
  }

  get report(): Report {
    return this._report;
  }

  set exchange(exchange) {
    if (this._exchange) {
      throw new Error('stdGlobalVariables:exchange Exchange already set with id ' + this._exchange?.id);
    }
    this._exchange = exchange;
  }

  get exchange(): Exchange {
    return this._exchange;
  }

  getClassName(obj: object) {
    return obj?.constructor?.name;
  }

  isObject(obj: object) {
    return typeof obj === 'object';
  }
}
export const global = new stdGlobalVariables();
