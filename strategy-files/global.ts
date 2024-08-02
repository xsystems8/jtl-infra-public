import type { EventEmitter, TriggerService } from './events';
import type { Report } from './report';
import type { Exchange } from './exchange';
import type { Script } from './script';
import type { Storage } from './storage';
import type { BaseObject } from './base-object';
import { getArgBoolean, uniqueId } from './base';
import { error } from './log';

class StdGlobalVariables {
  iterator = 0;
  private _strategy: Script = null;
  private _triggers: TriggerService = null;
  private _report: Report = null;
  private _exchange: Exchange = null;
  private _events: EventEmitter = null;
  private _storage: Storage = null;
  private _isTradeAllowed = true;

  public balanceInfo = {};
  public symbolsInfo = {};
  public positionsInfo = {};
  public _objects = {};
  logOnce: Map<string, any> = new Map();
  params = {};
  logs = {};
  errorCount = 0;
  lastErrorTime = 0;

  constructor() {
    this.isTradeAllowed = getArgBoolean('isTradeAllowed', true);
  }

  public addNewObject(object: BaseObject) {
    this._objects[object.id] = object;
  }

  public removeObject(object: BaseObject) {
    if (this._objects[object.id]) {
      //check is the same object
      object['_checkIsTheSameObject_hjkiyrbjkst'] = uniqueId(10);
      if (
        object['_checkIsTheSameObject_hjkiyrbjkst'] === this._objects[object.id]['_checkIsTheSameObject_hjkiyrbjkst']
      ) {
        delete this._objects[object.id];
      } else {
        error(
          'stdGlobalVariables::removeObject',
          'Object with id ' + object.id + 'was not deleted (object is not the same in global._objects)',
        );
      }
    }
  }

  set isTradeAllowed(isTradeAllowed) {
    this._isTradeAllowed = isTradeAllowed;
  }

  get isTradeAllowed() {
    return this._isTradeAllowed;
  }

  set strategy(strategy) {
    this._strategy = strategy;
  }

  get strategy() {
    return this._strategy;
  }

  set storage(storage: Storage) {
    this._storage = storage;
  }

  get storage() {
    return this._storage;
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
export const global = new StdGlobalVariables();
