import { global } from '../global';
import { BaseObject } from '../base-object.js';
import { currentTimeString, currentTime } from '../utils/date-time';
import { error, log, trace } from '../log';
import { Task } from './types';

/**
 * Triggers - class for create tasks triggered by price or time.
 *
 */
export class Triggers extends BaseObject {
  private _triggerPrices = [];
  private _triggerTimes = [];
  private _triggerTimesInfo = { nextId: 0, minTime: null, maxTime: null, cnt: 0 };
  private _triggerHasTimesTasks = false;

  private _triggerHasPriceTasks = false;
  private _triggerPricesInfo = { nextId: 0, downToUpMin: null, upToDownMax: null, downToUpCnt: 0, upToDownCnt: 0 };

  private tasks = {};

  constructor() {
    super();

    log('TriggerTasks::init()', 'Triggers inited');

    global.events.subscribe('onTick', this.onPriceChange, this);
    global.events.subscribe('onTick', this.onTimeChange, this);

    return this;
  }

  /**
   * subscribe - subscribe to task - callback will be called when task triggered
   * @param taskName - name of task
   * @param callback - callback function (async only)
   */
  subscribe(taskName: string, callback: (...args: unknown[]) => void) {
    log('TriggerTasks::subscribe()', 'subscribe', { task: taskName });
    if (!this.tasks[taskName]) {
      this.tasks[taskName] = [];
    }
    this.tasks[taskName].push(callback);

    //TODO clear double callbacks
    //this.tasks[task] = this.tasks[task].filter((c) => c !== callback);
  }

  //TODO create overload addTaskByPrice function with callback instead of taskName
  /**
   * Add task by price - task will be triggered when price cross triggerPrice from down to up or from up to down
   * To add linked task use params.taskLinkId - all tasks with same taskLinkId will be deleted after first task triggered
   * @param price - price for trigger
   * @param taskName - name of task
   * @param params - params for task - params will be passed to callback
   * @returns {string} - id of task - can be use it to delete task
   */
  addTaskByPrice(price: number, taskName: string, params: Record<string, unknown>): string {
    let task = { name: taskName, callback: null, params: params };
    log('TriggerTasks::addTaskByPrice()', 'addTaskByPrice ', { task: task, price: price });
    return this._setTriggerPrice(price, task);
  }

  /**
   * Add task by time - task will be triggered when the time is reached
   * To add linked task use params.taskLinkId - all tasks with same taskLinkId will be deleted after first task triggered
   * @param time - time in milliseconds
   * @param taskName - name of task
   * @param params - params for task - params will be passed to callback
   * @returns {string}
   */
  addTaskByTime(time: number, taskName: string, params: Record<string, unknown>): string {
    let task: Task = { name: taskName, callback: null, params };
    log('TriggerTasks::addTaskByTime()', 'addTaskByTime ', { task: task, time: time });
    return this._setTriggerTime(time, task);
  }

  /** NOT INCLUDE TO MANUAL
   * doItByInterval - Do task every interval milliseconds - task will be triggered every interval milliseconds
   * @param interval - interval in milliseconds
   * @param callback - callback function
   * @param params - params for task - params will be passed to callback
   * @returns {Promise<void>}
   */
  async doItByInterval(interval: number, callback: (...args: unknown[]) => void, params: Record<string, unknown>) {
    let task: Task = { name: '', callback: callback, params: params };
  }

  //no regular expression
  getFuncName = (func: (...args: unknown[]) => void) => {
    let funcNameRegex = /function (.{1,})\(/;

    let results = funcNameRegex.exec(func.toString());
    return results && results.length > 1 ? results[1] : '';
  };

  async _doTriggeredTask(task: Task) {
    log('TriggerTasks::doTriggeredTask()', 'Task  = ' + task.name, { task: task });

    if (this.tasks[task.name]) {
      for (let callback of this.tasks[task.name]) {
        await callback(task);
      }
    }

    if (task.params.taskLinkId) {
      let taskLinkId = task.params.taskLinkId;

      for (let taskInfo of this._triggerPrices) {
        if (taskInfo?.task?.params?.taskLinkId) {
          if (taskInfo.task.params.taskLinkId === taskLinkId) {
            //     _trace('basket:doTriggeredTask', 'delete task with taskLinkId ' + taskLinkId, task);
            taskInfo.isTriggered = true; // cancel newRound task for this round
            taskInfo.comment = 'deleted by taskLinkId';

            trace('basket:doTriggeredTask', 'task delited ', this._triggerPrices);
          }
        }
      }
    }
  }

  /**
   * clearAllTask - clear all tasks.
   */
  clearAllTask = () => {
    this._triggerPrices = [];
    this._triggerTimes = [];
    this._triggerHasTimesTasks = false;
    this._triggerHasPriceTasks = false;
    this._triggerPricesInfo = { nextId: 0, downToUpMin: null, upToDownMax: null, downToUpCnt: 0, upToDownCnt: 0 };
    this._triggerTimesInfo = { nextId: 0, minTime: null, maxTime: null, cnt: 0 };
  };

  private onTimeChange = async () => {
    if (!this._triggerHasTimesTasks) {
      return;
    }

    let time = currentTime();

    if (time > this._triggerTimesInfo.minTime) {
      for (let taskInfo of this._triggerTimes) {
        if (taskInfo.isTriggered) {
          continue;
        }

        if (time > taskInfo.time) {
          taskInfo.isTriggered = true;
          await this._doTriggeredTask(taskInfo.task);
        }
      }

      this._clearTriggeredTasks();

      if (this._triggerTimes.length === 0) {
        this._triggerHasTimesTasks = false;
        this._triggerTimesInfo.minTime = null;
        this._triggerTimesInfo.maxTime = null;
        this._triggerTimesInfo.cnt = 0;
        return;
      }
      for (let taskInfo of this._triggerTimes) {
        this._triggerTimesInfo.minTime = Math.min(this._triggerTimesInfo.minTime, taskInfo.time);
      }
    }
  };

  private onPriceChange = async () => {
    if (!this._triggerHasPriceTasks) {
      return;
    }
    let price = close();

    if (price > this._triggerPricesInfo.downToUpMin || price < this._triggerPricesInfo.upToDownMax) {
      for (let taskInfo of this._triggerPrices) {
        if (taskInfo.isTriggered) {
          continue;
        }
        if (taskInfo.isDownToUp && price >= taskInfo.price) {
          await this._doTriggeredTask(taskInfo.task);
          taskInfo.isTriggered = true;
        }
        if (!taskInfo.isDownToUp && price <= taskInfo.price) {
          await this._doTriggeredTask(taskInfo.task);
          taskInfo.isTriggered = true;
        }
      }

      this._clearTriggeredTasks();

      if (this._triggerPrices.length === 0) {
        this._triggerHasPriceTasks = false;
        this._triggerPricesInfo.downToUpMin = null;
        this._triggerPricesInfo.upToDownMax = null;
        this._triggerPricesInfo.downToUpCnt = 0;
        this._triggerPricesInfo.upToDownCnt = 0;
        return;
      }
      for (let taskInfo of this._triggerPrices) {
        if (taskInfo.isDownToUp) {
          this._triggerPricesInfo.downToUpMin = Math.min(this._triggerPricesInfo.downToUpMin, taskInfo.price);
        } else {
          this._triggerPricesInfo.upToDownMax = Math.max(this._triggerPricesInfo.upToDownMax, taskInfo.price);
        }
      }
    }
  };

  private _setTriggerTime(time: number, task: Task) {
    if (time <= currentTime()) {
      error('TriggerTasks::setTriggerTime()', 'time <= currentTimeMillisec()', { task, time });
      return null;
    }

    this._triggerHasTimesTasks = true;
    let id = 't' + this._triggerPricesInfo.nextId++;
    let taskInfo = {
      id: id,
      time: time,
      created: currentTimeString(),
      task: task,
      isTriggered: false,
      comment: 'task by time',
    };

    this._triggerTimes.push(taskInfo);

    this._triggerTimesInfo.minTime = Math.min(this._triggerTimesInfo.minTime ?? time, time);
    return id;
  }

  private _clearTriggeredTasks() {
    this._triggerPrices = this._triggerPrices.filter((taskInfo) => !taskInfo.isTriggered);
    this._triggerTimes = this._triggerTimes.filter((taskInfo) => !taskInfo.isTriggered);
  }

  private _setTriggerPrice(triggerPrice: number, task: Task, isCrossDownToUp = false) {
    this._triggerHasPriceTasks = true;

    if (isNaN(triggerPrice)) {
      throw new Error('triggerPrice is NaN');
    }

    if (!isCrossDownToUp && triggerPrice > close()) {
      isCrossDownToUp = true;
    }

    // if (isCrossDownToUp === null) {
    //   if (triggerPrice < close()) {
    //     isCrossDownToUp = false;
    //   } else {
    //     isCrossDownToUp = true;
    //   }
    // }

    let id = 'p' + this._triggerPricesInfo.nextId++;
    let taskInfo = {
      id: id,
      price: triggerPrice,
      isDownToUp: isCrossDownToUp,
      created: currentTimeString(),
      createdPrice: close(),
      task: task,
      isTriggered: false,
      comment: 'task by price',
    };

    this._triggerPrices.push(taskInfo);

    //_trace('setTriggerPrice()', task.name + ' p: ' + taskInfo.price, taskInfo);

    if (isCrossDownToUp) {
      this._triggerPricesInfo.downToUpMin = Math.min(this._triggerPricesInfo.downToUpMin ?? triggerPrice, triggerPrice);

      this._triggerPricesInfo.downToUpCnt++;
    } else {
      this._triggerPricesInfo.upToDownMax = triggerPrice;
      this._triggerPricesInfo.upToDownMax = Math.max(this._triggerPricesInfo.upToDownMax, triggerPrice);
      this._triggerPricesInfo.upToDownCnt++;
    }
    return id;
  }
}
