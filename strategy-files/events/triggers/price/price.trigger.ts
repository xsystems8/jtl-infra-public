import { Trigger } from '../trigger';
import { TriggerHandler, TriggerTask } from '../types';
import { CreatePriceTaskParams, PriceTriggerDirection, PriceTriggerInterface, PriceTriggerTask } from './types';
import { currentTime, currentTimeString } from '../../../utils/date-time';
import { error, log } from '../../../log';
import { global } from '../../../global';
import { BaseObject } from '../../../base-object';
import { BaseError } from '../../../Errors';

const MAX_INACTIVE_TASKS = 100;

export class PriceTrigger extends Trigger implements PriceTriggerInterface {
  private readonly registeredHandlers = new Map<string, TriggerHandler>();
  private readonly upperPriceTasks = new Map<string, PriceTriggerTask>();
  private readonly lowerPriceTasks = new Map<string, PriceTriggerTask>();
  private readonly inactiveTasks = new Map<string, PriceTriggerTask>();

  private upperMinPrice: number | null = null;
  private lowerMaxPrice: number | null = null;

  private eventListenerId: string | null = null;
  private nextId = 1;

  constructor(private readonly symbol: string) {
    super();
  }

  registerHandler(taskName: string, handler: Function, owner: BaseObject) {
    if (typeof handler !== 'function') {
      // in typescript function.name is not defined for arrow functions
      throw new BaseError('PriceTrigger::subscribe() Arrow function is not allowed in callback', { taskName });
    }
    if (!(owner instanceof BaseObject)) {
      throw new BaseError('PriceTrigger::subscribe() The owner must be an instance of the BaseObject class');
    }
    if (!owner[handler.name] || typeof owner[handler.name] !== 'function') {
      throw new BaseError(
        `PriceTrigger::subscribe() ${handler.name} should be a function of ${owner.constructor.name}`,
      );
    }
    if (this.registeredHandlers.get(taskName)) {
      throw new BaseError(`PriceTrigger::subscribe() The handler for the task ${taskName} is already registered`, {
        taskName,
      });
    }

    this.registeredHandlers.set(taskName, { callback: handler.bind(owner), funcName: handler.name });
  }

  addTask(params: CreatePriceTaskParams): string {
    if (isNaN(params.triggerPrice)) {
      throw new Error('triggerPrice is NaN');
    }

    const id = `price#${this.nextId++}`;
    const currentPrice = close(this.symbol);
    let direction = PriceTriggerDirection.Up;

    if (currentPrice > params.triggerPrice) {
      direction = PriceTriggerDirection.Down;
    }

    const task: PriceTriggerTask = {
      ...params,
      symbol: this.symbol,
      id,
      type: 'price',
      direction,
      executedTimes: 0,
      isActive: true,
      isTriggered: false,
      created: currentTimeString(),
      createdTms: currentTime(),
      lastExecuted: null,
    };

    switch (direction) {
      case PriceTriggerDirection.Up:
        this.upperMinPrice = this.upperMinPrice
          ? Math.min(this.upperMinPrice, params.triggerPrice)
          : params.triggerPrice;
        this.upperPriceTasks.set(id, task);
        break;
      case PriceTriggerDirection.Down:
        this.lowerMaxPrice = this.lowerMaxPrice
          ? Math.max(this.lowerMaxPrice, params.triggerPrice)
          : params.triggerPrice;
        this.lowerPriceTasks.set(id, task);
    }

    if (!this.eventListenerId) {
      // this.eventListenerId = global.events.subscribe('onTick', this.onTick, this);
      this.eventListenerId = global.events.subscribeOnTick(this.onTick, this, this.symbol);
    }

    log(PriceTrigger.name, 'New task registered', { task: params });

    return id;
  }

  private async onTick() {
    const currentPrice = close(this.symbol);

    if (currentPrice > this.lowerMaxPrice && currentPrice < this.upperMinPrice) return;

    if (this.upperMinPrice && currentPrice >= this.upperMinPrice) {
      for (const task of this.upperPriceTasks.values()) {
        if (task.triggerPrice > currentPrice) continue;
        await this.executeTask(task);
      }

      this.upperMinPrice = Array.from(this.upperPriceTasks.values()).reduce<null | number>((res, task) => {
        if (!res) {
          res = task.triggerPrice;
          return res;
        }

        if (res > task.triggerPrice) res = task.triggerPrice;
        return res;
      }, null);
    } else {
      for (const task of this.lowerPriceTasks.values()) {
        if (task.triggerPrice < currentPrice) continue;
        await this.executeTask(task);
      }

      this.lowerMaxPrice = Array.from(this.lowerPriceTasks.values()).reduce<null | number>((res, task) => {
        if (!res) {
          res = task.triggerPrice;
          return res;
        }

        if (res < task.triggerPrice) res = task.triggerPrice;
        return res;
      }, null);
    }

    if (!this.lowerPriceTasks.size && !this.upperPriceTasks.size) {
      global.events.unsubscribeById(this.eventListenerId);
      this.eventListenerId = null;
    }

    this.clearInactive();
  }

  private async executeTask(task: PriceTriggerTask) {
    if (!task.callback && !this.registeredHandlers.get(task.name)) {
      throw new BaseError(`There is no registered handler or callback for the task`, { taskName: task.name });
    }

    try {
      if (task.callback) {
        task.result = await task.callback(task.args);
      } else {
        const handler = this.registeredHandlers.get(task.name);
        task.result = await handler.callback(task.args);
      }
      task.isTriggered = true;
      task.isActive = false;
      task.executedTimes++;
      task.lastExecuted = currentTimeString();

      this.inactiveTasks.set(task.id, task);

      if (task.group) {
        Array.from(this.upperPriceTasks.values())
          .filter((activeTask) => activeTask.group === task.group)
          .forEach((task) => {
            this.inactiveTasks.set(task.id, { ...task, isActive: false });
            this.upperPriceTasks.delete(task.id);
          });

        Array.from(this.lowerPriceTasks.values())
          .filter((activeTask) => activeTask.group === task.group)
          .forEach((task) => {
            this.inactiveTasks.set(task.id, { ...task, isActive: false });
            this.lowerPriceTasks.delete(task.id);
          });
      }

      if (task.direction === PriceTriggerDirection.Up) {
        this.upperPriceTasks.delete(task.id);
        return;
      }

      this.lowerPriceTasks.delete(task.id);
    } catch (e) {
      error(PriceTrigger.name, 'An error occurred while executing the task', {
        message: e.message,
        stack: e.stack,
        task,
      });

      if (!task.retry) {
        task.isActive = false;
        task.isTriggered = true;
        task.error = e.message;

        this.inactiveTasks.set(task.id, task);

        if (task.direction === PriceTriggerDirection.Up) {
          this.upperPriceTasks.delete(task.id);
          return;
        }

        this.lowerPriceTasks.delete(task.id);
      }

      if (typeof task.retry === 'number') {
        task.retry -= 1;
      }

      await this.executeTask(task);
    }
  }

  cancelTask(taskId: string) {
    const task = this.upperPriceTasks.get(taskId) ?? this.lowerPriceTasks.get(taskId);

    if (!task) {
      error(PriceTrigger.name, 'An error occurred while canceling the task: Task not found', { taskId });
      return;
    }

    this.inactiveTasks.set(taskId, task);
    this.upperPriceTasks.delete(task.id);
    this.lowerPriceTasks.delete(task.id);
    this.clearInactive();
  }

  getTasksByName(taskName: string): TriggerTask[] {
    return [...this.lowerPriceTasks.values(), ...this.upperPriceTasks.values()].filter(
      (task) => task.name === taskName,
    );
  }

  getAllTasks(): TriggerTask[] {
    return [...this.inactiveTasks.values(), ...this.lowerPriceTasks.values(), ...this.upperPriceTasks.values()];
  }

  getActiveTasks(): TriggerTask[] {
    return [...this.lowerPriceTasks.values(), ...this.upperPriceTasks.values()];
  }

  getInactiveTasks(): TriggerTask[] {
    return Array.from(this.inactiveTasks.values());
  }

  cancelAll() {
    for (const task of this.lowerPriceTasks.values()) {
      this.inactiveTasks.set(task.id, task);
      this.lowerPriceTasks.delete(task.id);
    }

    for (const task of this.upperPriceTasks.values()) {
      this.inactiveTasks.set(task.id, task);
      this.upperPriceTasks.delete(task.id);
    }

    this.clearInactive();
  }

  private clearInactive() {
    if (this.inactiveTasks.size < MAX_INACTIVE_TASKS) return;

    Array.from(this.inactiveTasks.values())
      .sort((a, b) => b.createdTms - a.createdTms)
      .slice(0, -100)
      .forEach((task) => this.inactiveTasks.delete(task.id));
  }
}
