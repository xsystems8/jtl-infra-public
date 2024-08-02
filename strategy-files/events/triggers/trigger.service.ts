import { BaseObject } from '../../base-object';
import { PriceTrigger } from './price/price.trigger';
import { CreateOrderTaskParams as CreateOrderTaskParams } from './order/types';
import { CreatePriceTaskParams as CreatePriceTaskParams } from './price/types';
import { CreateTimeTaskParams as CreateTimeTaskParams } from './time/types';
import { TaskType, TriggerServiceInterface, TriggerTask } from './types';
import { TimeTrigger } from './time/time.trigger';
import { OrderTrigger } from './order/order.trigger';
import { error } from '../../log';

export class TriggerService extends BaseObject implements TriggerServiceInterface {
  private readonly timeTrigger: TimeTrigger;
  private readonly orderTrigger: OrderTrigger;
  private readonly priceTriggers = new Map<string, PriceTrigger>();

  constructor(args: { idPrefix: string }) {
    super(args);

    this.timeTrigger = new TimeTrigger();
    this.orderTrigger = new OrderTrigger();
  }

  registerOrderHandler(taskName: string, handler: Function, owner: BaseObject) {
    this.orderTrigger.registerHandler(taskName, handler, owner);
  }

  registerPriceHandler(symbol: string, taskName: string, handler: Function, owner: BaseObject) {
    let trigger = this.priceTriggers.get(symbol);

    if (!trigger) {
      trigger = new PriceTrigger(symbol);
      this.priceTriggers.set(symbol, trigger);
    }

    trigger.registerHandler(taskName, handler, owner);
  }

  registerTimeHandler(taskName: string, handler: Function, owner: BaseObject) {
    this.timeTrigger.registerHandler(taskName, handler, owner);
  }

  addTaskByTime(params: CreateTimeTaskParams) {
    return this.timeTrigger.addTask(params);
  }

  addTaskByOrder(params: CreateOrderTaskParams) {
    return this.orderTrigger.addTask(params);
  }

  addTaskByPrice(params: CreatePriceTaskParams & { symbol: string }) {
    let trigger = this.priceTriggers.get(params.symbol);

    if (trigger) {
      return trigger.addTask(params);
    }

    trigger = new PriceTrigger(params.symbol);
    this.priceTriggers.set(params.symbol, trigger);

    return trigger.addTask(params);
  }

  getTasksByName(taskName: string, type: TaskType): TriggerTask[] {
    if (type === 'price') {
      const priceTasks = [];
      for (const priceTrigger of this.priceTriggers.values()) {
        priceTasks.concat(priceTrigger.getTasksByName(taskName));
      }

      return priceTasks;
    }

    if (type === 'order') return this.orderTrigger.getTasksByName(taskName);

    if (type === 'time') return this.timeTrigger.getTasksByName(taskName);
  }

  cancelOrderTask(taskId: string) {
    return this.orderTrigger.cancelTask(taskId);
  }

  cancelPriceTask(taskId: string, symbol: string) {
    const trigger = this.priceTriggers.get(symbol);

    if (!trigger) {
      error(TriggerService.name, 'Price trigger not found', { taskId, symbol });
      return;
    }

    return trigger.cancelTask(taskId);
  }

  cancelTimeTask(taskId: string) {
    return this.timeTrigger.cancelTask(taskId);
  }

  cancelAll() {
    this.cancelAllOrderTasks();
    this.cancelAllPriceTasks();
    this.cancelAllTimeTasks();
  }

  cancelAllOrderTasks(): void {
    this.orderTrigger.cancelAll();
  }

  cancelAllPriceTasks(): void {
    this.priceTriggers.forEach((trigger) => trigger.cancelAll());
  }

  cancelAllTimeTasks(): void {
    this.timeTrigger.cancelAll();
  }
}
