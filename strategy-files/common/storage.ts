import { currentTimeString } from './utils/date-time';
import { error, log, logOnce, warning } from './log';

export class Storage {
  exceptProps = ['exceptProperties', 'classes', 'parent', 'function', 'exceptProps'];
  name = 'Storage';
  items = [];
  classes = {};
  baseClasses = {
    Array: Array,
    Date: Date,
    Map: Map,
    Set: Set,
    Object: Object,
    RegExp: RegExp,
    Error: Error,
  };
  version = '1.0.4';
  constructor(exceptProps = [], classes = []) {
    //  super();
    if (Array.isArray(exceptProps)) {
      this.exceptProps = [...this.exceptProps, ...exceptProps];
    }
    classes.forEach((_class) => {
      this.addClass(_class);
    });
  }

  addClass(_class) {
    let name = _class.name;

    if (!name) {
      throw new Error('Class name is empty');
    }

    this.classes[name] = _class;
  }

  getState(obj) {
    if (!obj) return null;

    let state = {
      _c: obj.constructor.name, // className
      _p: {}, // properties
      _v: null, //
    };

    // if (!this.classes[state._className]) {
    //   _trace('Storage::getState', 'not stored className ' + state._className, {});
    //   return state;
    // }

    // //Map and Set
    if (obj instanceof Map) {
      state._v = this.getState(Object.fromEntries(obj.entries()));
      return state;
      // return this.getState();
    }

    if (obj instanceof Set) {
      state._v = this.getState(Object.fromEntries(obj.entries()));
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

    try {
      for (let propName of Object.keys(obj)) {
        if (this.exceptProps.includes(propName)) {
          // _trace('Storage::getState', 'exceptProps ' + propName, {});
          continue;
        }
        if (typeof obj[propName] === 'function') continue;

        if (typeof obj[propName] === 'object') {
          //  _trace('Storage::getState', 'allowed ' + propName, {});
          state._p[propName] = this.getState(obj[propName]);
        } else {
          state._p[propName] = obj[propName];
        }
      }
    } catch (e) {
      error('Storage::getState', e.message);
    }

    return state;
  }

  iterator = 0;
  propName = '';
  applyState(state, obj) {
    let i = 6;
    this.iterator++;
    let className;
    try {
      if (!state || !state._c) {
        log('Storage::applyState', 'NULL _c  1', { propName: this.propName, i: i, msg: 'null' });
        return null;
      }

      if (state._c === 'Date') {
        return new Date(state._v);
      }

      if (state._c === 'Map') {
        let MapEntries = {};
        MapEntries = this.applyState(state._v, MapEntries);
        return new Map(Object.entries(MapEntries));
      }

      if (state._c === 'Set') {
        let SetEntries = {};
        SetEntries = this.applyState(state._v, SetEntries);
        return new Set(Object.entries(SetEntries));
      }

      if (state._c === 'Array') {
        return state._v;
      }

      let objProps = state._p; // properties;
      for (let propName of Object.keys(objProps)) {
        i++;
        this.iterator++;
        this.propName = propName;
        if (propName === '_p') continue;

        if (objProps[propName] && objProps[propName]._c) {
          obj[propName] = {};
          className = objProps[propName]._c;
          // Create new object by class name
          if (this.classes[className]) {
            obj[propName] = new this.classes[className]();
          } else {
            if (!this.baseClasses[className]) {
              error('Storage::applyState', 'class ' + className + ' not found', {
                i: this.iterator,
                propName: propName,
                msg: 'Use AddClass() method to add class to storage',
              });
            }
          }
          obj[propName] = this.applyState(objProps[propName], obj[propName]);
        } else {
          obj[propName] = objProps[propName];
        }
      }
    } catch (e) {
      error('Storage::applyState', e.message, { i: this.iterator, propName: this.propName, state: state });
    }

    return obj;
  }
  async restoreState(key, obj) {
    try {
      let state = await this.loadState(key);
      log('Storage::restoreState', 'sstate', { state: state });

      if (!state) {
        warning('Storage::restoreState', 'state is empty for key ' + key);
        return null;
      }
      return this.applyState(state, obj);
    } catch (e) {
      error('Storage::restoreState', e.message);
      return null;
    }
  }
  async storeState(key, obj, _classes = null, exceptProps = null) {
    try {
      let state = this.getState(obj);
      return await this.saveState(key, { updated: currentTimeString(), ...state });
    } catch (e) {
      error('Storage::storeState', e.message);
      return false;
    }
  }

  async saveState(key, state) {
    try {
      logOnce('Storage::saveState', key, state);
      // stringify state

      let strState = JSON.stringify(state);
      return await setCache(key, strState);
    } catch (e) {
      error('Storage::saveState', e.message);
      return false;
    }
  }

  async loadState(key) {
    try {
      let strState = await getCache<string>(key);
      let state = JSON.parse(strState);
      log('Storage::loadState', key, state);
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
