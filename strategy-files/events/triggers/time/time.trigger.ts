import { global } from '../../../global';
import { Trigger } from '../trigger';
import { error, log } from '../../../log';
import { currentTime, currentTimeString } from '../../../utils/date-time';
import { CreateTimeTaskParams, TimeTriggerTask } from './types';
import { BaseObject } from '../../../base-object';
import { BaseError } from '../../../Errors';
import { TriggerHandler, TriggerTask } from '../types';

const MAX_INACTIVE_TASKS = 100;

export class TimeTrigger extends Trigger implements TimeTrigger {
  private readonly registeredHandlers = new Map<string, TriggerHandler>();
  private readonly activeTasks = new Map<string, TimeTriggerTask>();
  private readonly inactiveTasks = new Map<string, TimeTriggerTask>();

  private eventListenerId: string | null = null;
  private nextId: number = 1;

  private minTriggerTime: number;

  registerHandler(taskName: string, handler: Function, owner: BaseObject) {
    if (typeof handler !== 'function') {
      // in typescript function.name is not defined for arrow functions
      throw new BaseError('TimeTrigger::subscribe() Arrow function is not allowed in callback', { taskName });
    }
    if (!(owner instanceof BaseObject)) {
      throw new BaseError('TimeTrigger::subscribe() The owner must be an instance of the BaseObject class');
    }
    if (!owner[handler.name] || typeof owner[handler.name] !== 'function') {
      throw new BaseError(`TimeTrigger::subscribe() ${handler.name} should be a function of ${owner.constructor.name}`);
    }
    if (this.registeredHandlers.get(taskName)) {
      throw new BaseError(`TimeTrigger::subscribe() The handler for the task ${taskName} is already registered`, {
        taskName,
      });
    }

    this.registeredHandlers.set(taskName, { callback: handler.bind(owner), funcName: handler.name });
  }

  addTask(params: CreateTimeTaskParams): string {
    const { triggerTime } = params;

    if (triggerTime <= currentTime()) {
      error(TimeTrigger.name, 'Error adding a task. The trigger time cannot be less than the current time', {
        args: arguments,
      });
      return null;
    }

    const id = `time#${this.nextId++}`;

    this.minTriggerTime = this.minTriggerTime ? Math.min(triggerTime, this.minTriggerTime) : triggerTime;

    this.activeTasks.set(id, {
      ...params,
      id,
      type: 'time',
      isTriggered: false,
      isActive: true,
      created: currentTimeString(),
      createdTms: currentTime(),
      lastExecuted: null,
      executedTimes: 0,
      result: null,
    });

    if (!this.eventListenerId) {
      this.eventListenerId = global.events.subscribe('onTick', this.onTick, this);
    }

    log(TimeTrigger.name, 'New task registered', { task: params });

    return id;
  }

  private async onTick() {
    if (!this.minTriggerTime || this.minTriggerTime > currentTime()) return;

    for (const task of this.activeTasks.values()) {
      if (currentTime() < task.triggerTime) continue;
      await this.executeTask(task);
    }

    const activeTasks = Array.from(this.activeTasks.values());

    this.minTriggerTime = activeTasks.reduce<number | null>((res, task) => {
      if (!res) return task.triggerTime;

      if (res > task.triggerTime) {
        res = task.triggerTime;
      }

      return res;
    }, null);

    if (!this.minTriggerTime) {
      global.events.unsubscribeById(this.eventListenerId);
      this.eventListenerId = null;
    }

    this.clearInactive();
  }

  private async executeTask(task: TimeTriggerTask) {
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
      task.lastExecuted = currentTimeString();
      task.executedTimes++;
      task.isTriggered = true;

      if (!task.interval) {
        task.isActive = false;

        this.inactiveTasks.set(task.id, task);
        this.activeTasks.delete(task.id);

        return;
      }
    } catch (e) {
      error(TimeTrigger.name, 'An error occurred while executing the task', {
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
      error(TimeTrigger.name, 'An error occurred while canceling the task: Task not found', { taskId });
      return;
    }

    this.inactiveTasks.set(taskId, task);
    this.activeTasks.delete(taskId);
    this.clearInactive();
  }

  getTasksByName(taskName: string): TriggerTask[] {
    return [...this.activeTasks.values()].filter((task) => task.name === taskName);
  }

  getAllTasks(): TimeTriggerTask[] {
    return [...this.inactiveTasks.values(), ...this.activeTasks.values()];
  }

  getActiveTasks(): TimeTriggerTask[] {
    return Array.from(this.activeTasks.values());
  }

  getInactiveTasks(): TimeTriggerTask[] {
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
