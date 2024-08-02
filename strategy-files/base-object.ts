import { uniqueId } from './base';
import { global } from './global';
import { log, warning } from './log';
import { BaseError } from './Errors';

export class BaseObject {
  _id: string = '';
  _isDestroyed = false;
  _listenersId: any = [];

  constructor(args: any = {}) {
    let idPrefix = args.idPrefix ?? '';
    this.id = idPrefix + '_' + this.constructor.name + '#' + uniqueId(2);

    log('BaseObject::constructor', 'Object created with id ' + this.id, { args });

    return this;
  }

  async call(functionName: string, data?: any) {
    if (this._isDestroyed) {
      throw new BaseError('BaseObject::call this object is destroyed ');
    }
    return await this[functionName](data);
  }

  //ID is used for unsubscribing from events by object if you change id - you will not be able to unsubscribe from events
  set id(id: string) {
    if (global._objects[id]) {
      this.id = id + uniqueId(2);
      log('BaseObject::id', `ID has been changed ${id} ->${this._id}`);
      return;
    }

    if (this._id) {
      warning('BaseObject::id', `ID has been changed ${id} ->${this._id}`);
      global.removeObject(this);
    }
    this._id = id;
    global.addNewObject(this);
  }

  get id() {
    return this._id;
  }

  //  private _storageKey = '';
  // _isRestoreState = false;
  //
  // set storageKey(key: string) {
  //   this._storageKey = key;
  // }
  // get storageKey() {
  //   return this._storageKey;
  // }
  //
  // async restoreState(classes: any = null, prefix: string = null) {
  //   if (!this._isRestoreState) return;
  //
  //   if (classes) {
  //     for (let _class of classes) {
  //       global.storage.addClass(_class);
  //     }
  //   }
  //   let key = this._storageKey + (prefix ? '-' + prefix : '');
  //
  //   await global.storage.restoreState(key, this);
  // }
  //
  // async storeState(exceptProps: string[] = [], prefix: string = null) {
  //   if (!this._isRestoreState) return;
  //   let key = this._storageKey + (prefix ? '-' + prefix : '');
  //
  //   exceptProps = exceptProps ? exceptProps : [];
  //   await global.storage.storeState(key, this, exceptProps);
  // }
  //
  // async dropState(prefix: string = null) {
  //   let key = this._storageKey + (prefix ? '-' + prefix : '');
  //
  //   await global.storage.dropState(key);
  // }

  unsubscribe() {
    global.events.unsubscribeByObjectId(this._id);
  }

  public destroy() {
    //_isDestroyed - could be used to check is Object destroyed in possible linked object copies
    log('BaseObject::destroy', 'Object destroyed with id ' + this.id + ' ' + this.constructor.name);
    this._isDestroyed = true;
    global.removeObject(this);
    this.unsubscribe();

    for (let prop of Object.keys(this)) {
      if (this[prop] instanceof BaseObject) {
        this[prop].destroy();
      }
      // if (this[prop] && typeof this[prop] === 'object') {
      //   if (typeof this[prop]['destroy'] === 'function') {
      //     this[prop]['destroy']();
      //   }
      // }
    }
  }

  // subscribe(eventName: string, listener: any): number {
  //   let listenerId = global.events.subscribe(eventName, listener, this);
  //   this._listenersId.push(listenerId);
  //   return listenerId;
  // }
  // onBeforeStop = async () => {
  //   global.report.tableUpdate('Object sizes', {
  //     id: this.id,
  //     name: this.constructor.name,
  //     size: this.sizeInMB().sizeMb,
  //     length: this.sizeInMB().length,
  //   });
  // };
  //
  // sizeInMB() {
  //   const json = JSON.stringify(this);
  //   const lengthInBytes = this.estimateBytes(json);
  //   return { sizeMb: lengthInBytes / (1024 * 1024), length: json.length };
  // }
  //
  // private estimateBytes(str: string): number {
  //   let bytes = 0;
  //   for (let i = 0; i < str.length; i++) {
  //     const charCode = str.charCodeAt(i);
  //     if (charCode < 0x80) {
  //       bytes += 1;
  //     } else if (charCode < 0x800) {
  //       bytes += 2;
  //     } else if (charCode < 0xd800 || charCode >= 0xe000) {
  //       bytes += 3;
  //     } else {
  //       // Суррогатная пара
  //       bytes += 4;
  //       i++; // Переходим к следующей паре
  //     }
  //   }
  //   return bytes;
  // }
}
