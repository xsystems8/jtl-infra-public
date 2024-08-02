import { BaseObject } from '../base-object';
import { EventListener, TickExecutionData } from './types';
import { uniqueId } from '../base';
import { BaseError } from '../Errors';
import { error, log, warning } from '../log';
import { timeCurrent } from '../utils/date-time';

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
 */
export class EventEmitter extends BaseObject {
  private readonly tickExecInterval = new Map<string, TickExecutionData>();
  private readonly listeners = new Map<string, EventListener[]>();

  constructor(args: { idPrefix: string }) {
    super(args);
  }

  subscribeOnOrderChange(handler: (order: Order) => Promise<void>, owner: BaseObject, symbol: string) {
    return this.subscribe(`onOrderChange_${symbol}`, handler, owner);
  }

  subscribeOnTick(handler: () => Promise<void>, owner: BaseObject, symbol: string, interval: number = 2000) {
    const event = `emitOnTick_${symbol}`;
    interval = Math.max(1000, interval);

    this.tickExecInterval.set(event, {
      interval,
      symbol,
      nextTick: timeCurrent() + interval,
    });

    return this.subscribe(event, handler, owner);
  }

  /**
   * Subscribe to event with listener. You can use on() instead of subscribe().
   * !important: function (listener) wouldn't be deleted even object witch has this function is destroyed (you should unsubscribe manually)
   * @param eventName - event name
   * @param handler - event handler
   * @param owner - object witch has this listener (for unsubscribing by object)
   * @returns {string} - listener id (for unsubscribing by id)
   */
  subscribe(eventName: string, handler: (data?: any) => Promise<void>, owner: BaseObject): string {
    if (!handler.name) {
      throw new BaseError('EventEmitter::subscribe() Anonymous arrow functions are not supported', { eventName });
    }
    if (!(owner instanceof BaseObject)) {
      throw new BaseError('EventEmitter::subscribe() The owner must be an instance of the BaseObject class');
    }
    if (!owner[handler.name]) {
      throw new BaseError(
        `EventEmitter::subscribe() The handler ${handler.name} must be a method of the BaseObject class`,
      );
    }

    const id = uniqueId(10);

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }

    const listeners = this.listeners.get(eventName);

    const listenerData: EventListener = {
      id,
      event: eventName,
      owner,
      handler: handler.bind(owner),
      handlerName: handler.name,
      ownerName: owner.constructor.name,
      ownerId: owner.id,
    };

    listeners.push(listenerData);

    log('EventsEmitter:subscribe', `A handler for the ${eventName} event has been registered`);

    return id;
  }

  async emitOnOrderChange(order: Order) {
    await this.emit(`onOrderChange_${order.symbol}`, order);
  }

  async emitOnTick() {
    for (const [event, execData] of this.tickExecInterval.entries()) {
      if (tms(execData.symbol) >= execData.nextTick) {
        await this.emit(event);
        execData.nextTick = tms(execData.symbol) + execData.interval;
      }
    }
  }

  /**
   * Emit event with data
   * @param eventName - event name (string)
   * @param data - data for listeners (any)
   * @returns {Promise<void>} - promise
   */
  async emit(eventName: string, data?: any): Promise<void> {
    const listeners = this.listeners.get(eventName);
    if (!listeners || !listeners.length) return;

    for (const listener of listeners) {
      try {
        await listener.handler(data);
      } catch (e) {
        error('EventEmitter:emit', e.message, { error: e, listener });
      }
    }
  }

  getListenersCount() {
    return Array.from(this.listeners.values()).reduce((acc, listeners) => acc + listeners.length, 0);
  }

  getListeners() {
    return Array.from(this.listeners.values()).flat();
  }

  /**
   * Unsubscribe from event by listener id
   * @param listenerId - listener id
   * @returns {boolean} - true if listener was found and unsubscribed
   */
  unsubscribeById(listenerId: string): boolean {
    for (const [eventName, listeners] of this.listeners.entries()) {
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i].id !== listenerId) continue;

        listeners.splice(i, 1);

        log('EventsEmitter:unsubscribe', `Listener ${listenerId} unsubscribed from event ${eventName}`);

        return true;
      }
    }

    error('EventsEmitter:unsubscribe', `Listener ${listenerId} was not found.`);

    return false;
  }

  /**
   * Unsubscribe from event by object
   * @param objectId - object id
   * @returns {number} - count of unsubscribed listeners
   */
  unsubscribeByObjectId(objectId: string): number {
    let unsubscribedIds = 0;

    for (const [eventName, listeners] of this.listeners.entries()) {
      for (let i = 0; i < listeners.length; i++) {
        if (listeners[i].ownerId !== objectId) continue;
        const listenerId = listeners[i].id;
        listeners.splice(i, 1);

        unsubscribedIds++;

        log('EventsEmitter:unsubscribeByObjectId', `Object ${objectId} unsubscribed from event ${eventName}`, {
          listenerId,
        });
      }
    }

    if (!unsubscribedIds) {
      warning('EventsEmitter:unsubscribeByObjectId', 'No listeners found', { objectId });
    }

    return unsubscribedIds;
  }
}
