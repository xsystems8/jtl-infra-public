import { BaseObject } from '../base-object.js';
import { error, log, trace, warning } from '../log';
import { Listeners } from './types';

/** Best practices for event emitter:
 event in global scope ( see ExtendedScript.ts )
 global.events = new EventsEmitter();
 Base event names:
  - onInit - when script is initialized
  - onTick - on each tick
  - onBar - on each bar
  - onOrderChange - on each order changed (open, close, cancel, etc)
  - onStop - when script is stopped (by user or by error)
  - onArgsChange - when script args are changed (by user)
*/

/**
 * Emitter - event emitter provide functionality for subscribe to events and emit events.
 * @example
 * // This example illustrates how to use EventsEmitter to calculate trade volume
 * class TradeVolume extends BaseObject {
 *   volume = 0;
 *   volumeUsd = 0;
 *   constructor() {
 *     super();
 *     global.events.subscribe('onOrderChange', this.calcVolume, this);
 *   }
 *
 * // This function will be called on each time when order changed
 *  calcVolume = async (order: Order) => {
 *     if (order.status === 'closed' && order.reduceOnly !== true) {
 *       this.volume += order.amount; // volume in base currency
 *       this.volumeUsd += order.amount * order.price; // volume in USDT
 *     }
 *   };
 * }
 *
 *
 */
export class EventEmitter extends BaseObject {
  private nextId = 0;
  private listenersByObjId: Listeners = {};
  private listeners: Listeners = {};

  constructor() {
    super();
  }

  /**
   * Emit event with data
   * @param eventName - event name (string)
   * @param data - data for listeners (any)
   * @returns {Promise<void>} - promise
   */
  async emit(eventName: string, data?: any): Promise<void> {
    if (this.listeners[eventName]) {
      for (const listenerInfo of this.listeners[eventName]) {
        await listenerInfo.listener(data);
      }
    }
  }

  //TODO: create functionality to check listener still valid (not destroyed)
  /**
   * Subscribe to event with listener. You can use on() instead of subscribe().
   * !important: function (listener) wouldn't be deleted even object witch has this function is destroyed (you should unsubscribe manually)
   * @param eventName - event name
   * @param listener - event handler
   * @param obj - object witch has this listener (for unsubscribing by object)
   * @returns {number} - listener id (for unsubscribing by id)
   *
   */
  subscribe(eventName: string, listener: (...args: any[]) => void, obj?: BaseObject): number {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    const listenerName = listener.name || 'anonymous';

    let objName = obj ? obj.constructor.name : 'global';

    let listenerInfo = {
      listener,
      listenerName,
      eventName,
      objName,
      id: this.nextId++,
      objId: obj ? obj.id : null,
    };
    this.listeners[eventName].push(listenerInfo);

    log('EventsEmitter:subscribe', 'listener ' + listenerName + ' subscribed to ' + eventName + ' of ' + objName, {
      listenerInfo: listenerInfo,
    });

    if (typeof obj === 'object' && obj) {
      // dictionary for unsubscribing by object array of listeners ids by object id
      if (!this.listenersByObjId[obj.id]) {
        this.listenersByObjId[obj.id] = [];
      }
      this.listenersByObjId[obj.id].push(listenerInfo);
    } else {
      warning(
        'EventsEmitter:subscribe',
        'listener ' + listenerName + ' subscribed to ' + eventName + ' with no object',
      );
    }

    return listenerInfo.id;
  }

  on(eventName: string, listener: (data?: unknown) => void) {
    return this.subscribe(eventName, listener);
  }

  /**
   * Unsubscribe from event by listener id
   * @param listenerId - listener id
   * @returns {boolean} - true if listener was found and unsubscribed
   */
  unsubscribeById(listenerId: number): boolean {
    for (const eventName in this.listeners) {
      for (let i = 0; i < this.listeners[eventName].length; i++) {
        if (this.listeners[eventName][i].id === listenerId) {
          trace('EventsEmitter:unsubscribe', 'listener with id = ' + listenerId + ' unsubscribed from ' + eventName, {
            l: this.listeners[eventName][i],
          });
          this.listeners[eventName].splice(i, 1);
          return true;
        }
      }
    }

    error('EventsEmitter:unsubscribe', 'listener with id = ' + listenerId + ' was not found');
    return false;
  }

  /**
   * Unsubscribe from event by object
   * @param obj - object witch has listeners
   * @returns {number} - count of unsubscribed listeners
   */
  unsubscribeByObj(obj: BaseObject): number {
    let listenersCount = 0;

    if (!obj.hasOwnProperty('id')) return;

    const listeners = this.listenersByObjId[obj.id];
    // _consoleInfo('EventsEmitter:unsubscribeByObj', ids, obj.id);

    if (listeners) {
      for (const listenerInfo of listeners) {
        if (this.unsubscribeById(listenerInfo.id)) {
          listenersCount++;
        } else {
          error('EventsEmitter:unsubscribeByObj', 'listener with id = ' + listenerInfo.id + ' was not unsubscribed', {
            listenerInfo: listenerInfo,
          });
        }
      }
    } else {
      error('EventsEmitter:unsubscribeByObj', 'listeners for object with id = ' + obj.id + ' was not found', {
        listenersByObjId: this.listenersByObjId,
        listeners: this.listeners,
      });
    }
    log(
      'EventsEmitter:unsubscribeByObj',
      'Obj ' + obj.constructor.name + ' unsubscribed from ' + listenersCount + ' listeners id=' + obj.id,
      // TODO: что такое ids?
      { ids: listeners, listenersByObjId: this.listenersByObjId },
    );

    return listenersCount;
  }
}
