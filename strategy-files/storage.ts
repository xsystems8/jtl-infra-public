import { currentTimeString } from './utils/date-time';
import { error, log, trace, warning } from './log';
import { Report } from './report';
import { EventEmitter, TriggerService } from './events';
import { ReportCard } from './report/report-card';
import { ReportTable } from './report/report-table';
import { TradingViewChart } from './report/report-tv';
import { Exchange } from './exchange';
import { ReportChart } from './report/report-chart';
import { BaseObject } from './base-object';
import { getArgBoolean } from './base';

export class Storage extends BaseObject {
  exceptProps = [];
  name = 'Storage';
  items = [];
  _classes = {};
  version = '1.2.1';
  _baseClasses = {
    Array: Array,
    Date: Date,
    Map: Map,
    Set: Set,
    Object: Object,
    RegExp: RegExp,
    Error: Error,
  };

  isDebug = false;
  constructor(args) {
    super(args);
    try {
      let { exceptProps, classes } = args;
      if (exceptProps && Array.isArray(exceptProps)) {
        this.exceptProps = [...this.exceptProps, ...exceptProps];
      }
      if (classes) {
        classes.forEach((_class) => {
          this.addClass(_class);
        });
      }
    } catch (e) {
      error('Storage::constructor', e.message, { e });
    }
    this.addClass(TriggerService);
    this.addClass(EventEmitter);
    this.addClass(Exchange);
    this.addClass(Report);
    this.addClass(ReportCard);
    this.addClass(ReportTable);
    this.addClass(TradingViewChart);
    this.addClass(ReportChart);
  }

  async restoreState(key: string, obj) {
    if (await this.dropState(key)) return;

    this.restoredPropsLevel1 = [];
    this.restoredPropsLevel2 = [];

    let state = await this.loadState(key);
    this.debug('Storage::restoreState', key, { state });

    if (!state) {
      warning('Storage::restoreState', 'state is empty for key ' + key);
      return;
    }

    this.applyState(state, obj);

    log('Storage::restoreState', obj.constructor.name + ' is restored from key = ' + key, {
      restoredPropsLevel1: this.restoredPropsLevel1,
    });
  }
  async storeState(key, obj, exceptProps: string[] = [], onlyProps = []) {
    //  await this.dropState(key);
    this.getStatePropsLevel1 = [];

    if (!Array.isArray(exceptProps)) exceptProps = [];

    if (Array.isArray(onlyProps) && onlyProps.length > 0) {
      for (let prop of Object.keys(obj)) {
        if (!onlyProps.includes(prop)) {
          exceptProps.push(prop);
        }
      }
    }
    // trace('Storage::storeState', 'exceptProps', { exceptProps, onlyProps });

    let state = this.getState(obj, 0, exceptProps);
    this.debug('Storage::storeState', key, { state });
    log('Storage::storeState', obj.constructor.name + ' is stored with key = ' + key, {
      getStatePropsLevel1: this.getStatePropsLevel1,
    });
    return await this.saveState(key, { updated: currentTimeString(), ...state });
  }

  debug(event, msg, params = {}) {
    if (this.isDebug) trace(event + '-debug', msg, params);
  }
  addClass(_class) {
    let name = _class.name;

    if (!name) {
      throw new Error('Class name is empty');
    }

    this._classes[name] = _class;
  }

  getStatePropsLevel1 = [];
  lastPropName = '';
  getState(obj, i = 0, exceptProps = []) {
    if (!obj) return null;

    let state = {
      _c: 'unknown', // className
      _p: {}, // properties
      _v: null, //
    };
    i++;

    try {
      state._c = obj.constructor.name;
    } catch (e) {
      error('', e.message + ' [state._c ]', { e, obj, lastPropName: this.lastPropName });
      return null;
    }
    // if (!this.classes[state._className]) {
    //   _trace('Storage::getState', 'not stored className ' + state._className, {});
    //   return state;
    // }

    //TODO add check class exist in this.classes if not error

    // //Map and Set
    if (obj instanceof Map) {
      state._v = this.getState(Object.fromEntries(obj.entries()), i);
      return state;
      // return this.getState();
    }

    if (obj instanceof Set) {
      state._v = this.getState(Object.fromEntries(obj.entries()), i);
      return state;
    }
    if (obj instanceof Array) {
      state._v = obj;
      return state;
    }
    if (obj instanceof Date) {
      state._v = obj.toISOString();

      return state;
    }

    for (let propName of Object.keys(obj)) {
      this.lastPropName = propName;
      if (this.exceptProps.includes(propName) || propName.charAt(0) === '_' || exceptProps.includes(propName)) {
        // if (i === 1)
        //   this.getStatePropsLevel1.push(
        //     obj?.constructor ? obj.constructor.name : 'undefined' + '.' + propName + ' - IGNORED!',
        //   );

        continue;
      }
      if (typeof obj[propName] === 'function' || obj[propName] === undefined) continue;

      if (typeof obj[propName] === 'object') {
        state._p[propName] = this.getState(obj[propName], i);
      } else {
        state._p[propName] = obj[propName];
      }

      if (i === 1) {
        try {
          this.getStatePropsLevel1.push(
            obj.constructor.name +
              '.' +
              propName +
              ':' +
              (obj[propName]?.constructor ? obj[propName].constructor.name : obj[propName]),
          );
        } catch (e) {
          error('Storage::getState', 'Fill getStatePropsLevel1 error - ' + e.message, { e, obj: obj, propName });
        }
      }
    }

    return state;
  }
  dropState = async (key) => {
    if (getArgBoolean('isDropState', false)) {
      log('Storage::dropState', 'State is dropped for key = ' + key, {}, true);
      await setCache(key, '[]');
      return true;
    }
    return false;
  };
  iterator = 0;
  propName = '';
  restoredPropsLevel1 = [];
  ignoredPropsLevel1 = [];
  restoredPropsLevel2 = [];
  private applyState(state, obj, i = 0) {
    this.iterator++;
    i++;
    let className;

    if (!state || !state._c) {
      warning('Storage::applyState', 'Wrong state ', { propName: this.propName, i: i, msg: 'null' });
      return null;
    }

    if (state._c === 'Date') {
      return new Date(state._v);
    }

    if (state._c === 'Map') {
      let MapEntries = {};
      MapEntries = this.applyState(state._v, MapEntries, i);
      return new Map(Object.entries(MapEntries));
    }

    if (state._c === 'Set') {
      let SetEntries = {};
      SetEntries = this.applyState(state._v, SetEntries, i);
      return new Set(Object.entries(SetEntries));
    }

    if (state._c === 'Array') {
      return state._v;
    }

    let objProps = state._p; // properties;
    for (let propName of Object.keys(objProps)) {
      this.iterator++;
      this.propName = propName;
      if (propName.charAt(0) === '_') {
        if (i === 1) {
          this.restoredPropsLevel1.push(obj.constructor.name + '.' + propName + ' - IGNORED!');
        }
        continue;
      }

      if (objProps[propName] && objProps[propName]._c) {
        // obj[propName] = {};
        className = objProps[propName]._c;

        if (this._classes[className]) {
          // Create new object by class name
          if (obj[propName] && obj[propName].constructor.name === className) {
            this.debug('Storage::applyState', 'NOT Create new class = ' + className);
          } else {
            obj[propName] = new this._classes[className]();
            this.debug('Storage::applyState', 'Create new class = ' + className);
          }
        } else {
          if (!this._baseClasses[className]) {
            error('Storage::applyState', 'class ' + className + ' not found  for propName = ' + propName, {
              i: this.iterator,
              propName: propName,
              msg:
                'Use AddClass() method to add class to storage. * Do not add class Promise check your code and add await before prop = ' +
                propName,
            });
          }
          obj[propName] = {};
        }

        obj[propName] = this.applyState(objProps[propName], obj[propName], i);
      } else {
        obj[propName] = objProps[propName]; //i = 9
      }
      if (i === 1) {
        if (obj[propName]) {
          this.restoredPropsLevel1.push(obj.constructor.name + '.' + propName + ': ' + obj[propName].constructor.name);
        } else {
          this.restoredPropsLevel1.push(obj.constructor.name + '.' + propName + ': ' + obj[propName]);
        }
      }
    }

    return obj;
  }

  private async saveState(key, state) {
    try {
      let strState = JSON.stringify(state);
      return await setCache(key, strState);
    } catch (e) {
      error('Storage::saveState', e.message);
      return false;
    }
  }

  private async loadState(key) {
    try {
      let strState = await getCache<string>(key);
      let state = JSON.parse(strState);
      return state;
    } catch (e) {
      error('Storage::loadState', e.message);
      return false;
    }
  }
}

export function isCircular(obj, cache = new WeakSet()) {
  if (obj && typeof obj === 'object') {
    if (cache.has(obj)) {
      return true;
    }
    cache.add(obj);

    for (let key of Object.keys(obj)) {
      if (isCircular(obj[key], cache)) {
        return true;
      }
    }
  }
  return false;
}
