import { CreateOrderTaskParams, OrderTriggerInterface, OrderTriggerTask } from './types';
import { Trigger } from '../trigger';
import { TriggerHandler, TriggerTask } from '../types';
import { currentTime, currentTimeString } from '../../../utils/date-time';
import { global } from '../../../global';
import { error } from '../../../log';
import { BaseError } from '../../../Errors';
import { BaseObject } from '../../../base-object';

const MAX_INACTIVE_TASKS = 100;

export class OrderTrigger extends Trigger implements OrderTriggerInterface {
  private readonly registeredHandlers = new Map<string, TriggerHandler>();
  private readonly activeTasks = new Map<string, OrderTriggerTask>();
  private readonly inactiveTasks = new Map<string, OrderTriggerTask>();

  private nextId = 1;
  private eventListenerId: string | null = null;

  constructor() {
    super();
  }

  registerHandler(taskName: string, handler: Function, owner: BaseObject) {
    if (typeof handler !== 'function') {
      // in typescript function.name is not defined for arrow functions
      throw new BaseError('OrderTrigger::subscribe() Arrow function is not allowed in callback', { taskName });
    }
    if (!(owner instanceof BaseObject)) {
      throw new BaseError('OrderTrigger::subscribe() The owner must be an instance of the BaseObject class');
    }
    if (!owner[handler.name] || typeof owner[handler.name] !== 'function') {
      throw new BaseError(
        `OrderTrigger::subscribe() ${handler.name} should be a function of ${owner.constructor.name}`,
      );
    }
    if (this.registeredHandlers.get(taskName)) {
      throw new BaseError(`OrderTrigger::subscribe() The handler for the task ${taskName} is already registered`, {
        taskName,
      });
    }

    this.registeredHandlers.set(taskName, { callback: handler.bind(owner), funcName: handler.name });
  }

  addTask(params: CreateOrderTaskParams): string {
    if (!params.orderId && !params.clientOrderId) {
      throw new BaseError('orderId or clientOrderId required');
    }

    const id = `order#${this.nextId++}`;

    this.activeTasks.set(id, {
      ...params,
      id,
      type: 'order',
      isActive: true,
      isTriggered: false,
      executedTimes: 0,
      lastExecuted: null,
      createdTms: currentTime(),
      created: currentTimeString(),
    });

    if (!this.eventListenerId) {
      this.eventListenerId = global.events.subscribe('onOrderChange', this.onOrderChange, this);
    }

    return id;
  }

  private async onOrderChange(order: Order) {
    for (const task of this.activeTasks.values()) {
      if (!!task.clientOrderId && task.clientOrderId !== order.clientOrderId) continue;
      if (!!task.orderId && task.orderId !== order.id) continue;
      if (order.status !== task.status) continue;

      await this.executeTask(task);
    }

    if (!this.activeTasks.size) {
      global.events.unsubscribeById(this.eventListenerId);
      this.eventListenerId = null;
    }

    this.clearInactive();
  }

  private async executeTask(task: OrderTriggerTask) {
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

      if (task.group) {
        Array.from(this.activeTasks.values())
          .filter((activeTask) => activeTask.group === task.group)
          .forEach((task) => {
            this.inactiveTasks.set(task.id, { ...task, isActive: false });
            this.activeTasks.delete(task.id);
          });
      }

      this.inactiveTasks.set(task.id, task);
      this.activeTasks.delete(task.id);
    } catch (e) {
      error(OrderTrigger.name, 'An error occurred while executing the task', {
        message: e.message,
        stack: e.stack,
        task,
      });

      if (!task.retry) {
        task.isActive = false;
        task.isTriggered = true;
        task.error = e.message;

        this.inactiveTasks.set(task.id, task);
        this.activeTasks.delete(task.id);

        return;
      }

      if (typeof task.retry === 'number') {
        task.retry -= 1;
      }

      await this.executeTask(task);
    }
  }

  cancelTask(taskId: string) {
    const task = this.activeTasks.get(taskId);

    if (!task) {
      error(OrderTrigger.name, 'An error occurred while canceling the task: Task not found', { taskId });
      return;
    }

    this.inactiveTasks.set(taskId, task);
    this.activeTasks.delete(taskId);
    this.clearInactive();
  }

  getTasksByName(taskName: string): TriggerTask[] {
    return [...this.activeTasks.values()].filter((task) => task.name === taskName);
  }

  getAllTasks(): TriggerTask[] {
    return [...this.inactiveTasks.values(), ...this.activeTasks.values()];
  }

  getActiveTasks(): TriggerTask[] {
    return Array.from(this.activeTasks.values());
  }

  getInactiveTasks(): TriggerTask[] {
    return Array.from(this.inactiveTasks.values());
  }

  cancelAll() {
    for (const task of this.activeTasks.values()) {
      this.inactiveTasks.set(task.id, task);
      this.activeTasks.delete(task.id);
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
