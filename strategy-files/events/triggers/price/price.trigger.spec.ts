import { PriceTrigger } from './price.trigger';
import { global as libGlobal } from '../../../global';
import { EventEmitter } from '../../event-emitter';
import { CreatePriceTaskParams } from './types';
import { BaseObject } from '../../../base-object';

jest.mock('../../../global');

let trigger: PriceTrigger;
let nextId = 1;

const callback = jest.fn();

const createTask = (options?: Partial<CreatePriceTaskParams>, withCallback?: boolean): CreatePriceTaskParams => ({
  name: `task #${nextId++}`,
  callbackArgs: { foo: 'bar' },
  ...(withCallback && {
    callback,
  }),
  ...options,
  triggerPrice: options?.triggerPrice ?? 100,
});

beforeEach(() => {
  global.close = jest.fn();
  callback.mockClear();
  callback.mockResolvedValue({});
  libGlobal.events = new EventEmitter();
  trigger = new PriceTrigger('ETH/USDT');
});

describe('PriceTrigger', () => {
  test('should return task id', () => {
    const id = trigger.addTask(createTask());

    expect(id).toBeDefined();
  });

  test('should trigger a handler when the price rises above the given price', async () => {
    class MockObject extends BaseObject {
      mockConstructor: Function;

      constructor() {
        super();

        this.mockConstructor = jest.fn();
        trigger.registerHandler('mockTask', this.mockConstructor, this);
      }
    }

    (global.close as jest.Mock).mockReturnValue(1);
    const mockObj = new MockObject();
    const task = createTask({ triggerPrice: 10, name: 'mockTask' });

    trigger.addTask(task);

    (global.close as jest.Mock).mockReturnValue(5);
    await libGlobal.events.emit('onTick');

    expect(mockObj.mockConstructor).not.toBeCalled();

    (global.close as jest.Mock).mockReturnValue(11);
    await libGlobal.events.emit('onTick');

    expect(mockObj.mockConstructor).toBeCalledTimes(1);
  });

  test('should trigger a callback when the price rises above the given price', async () => {
    (global.close as jest.Mock).mockReturnValue(10);

    const task1 = createTask({ triggerPrice: 20 }, true);
    const task2 = createTask({ triggerPrice: 21 }, true);

    trigger.addTask(task1);
    trigger.addTask(task2);

    (global.close as jest.Mock).mockReturnValue(25);
    await libGlobal.events.emit('onTick');
    await libGlobal.events.emit('onTick');

    expect(callback).toBeCalledTimes(2);
  });

  test('should trigger a callback when the price drops below a given price', async () => {
    (global.close as jest.Mock).mockReturnValue(10);

    const task1 = createTask({ triggerPrice: 7 }, true);
    const task2 = createTask({ triggerPrice: 6 }, true);

    trigger.addTask(task1);
    trigger.addTask(task2);

    (global.close as jest.Mock).mockReturnValue(5);
    await libGlobal.events.emit('onTick');
    await libGlobal.events.emit('onTick');

    expect(callback).toBeCalledTimes(2);
  });

  test('should not trigger callbacks until the current price has reached the trigger threshold', async () => {
    const task1 = createTask({ triggerPrice: 10 }, true);
    const task2 = createTask({ triggerPrice: 30 }, true);

    (global.close as jest.Mock).mockReturnValue(20);

    trigger.addTask(task1);
    trigger.addTask(task2);

    await libGlobal.events.emit('onTick');

    expect(callback).not.toBeCalled();
  });

  test('should be placed in inactive callbacks if one of the group of callbacks is executed', async () => {
    (global.close as jest.Mock).mockReturnValue(20);

    for (let i = 1; i < 4; i++) {
      trigger.addTask(createTask({ triggerPrice: i * 10, group: 'grouped' }, true));
    }

    (global.close as jest.Mock).mockReturnValue(33);
    await libGlobal.events.emit('onTick');

    expect(trigger.getActiveTasks().length).toEqual(0);
    expect(trigger.getInactiveTasks().length).toEqual(3);
  });

  test('should call the callback again if an error occurred and the number of attempts was passed', async () => {
    (global.close as jest.Mock).mockReturnValue(10);
    trigger.addTask(createTask({ triggerPrice: 10, retry: 3 }, true));

    callback.mockRejectedValue({ error: true });

    await libGlobal.events.emit('onTick');

    expect(callback).toBeCalledTimes(4);
  });

  test('should cancel task', async () => {
    (global.close as jest.Mock).mockReturnValue(10);
    const taskId = trigger.addTask(createTask({ triggerPrice: 10 }, true));
    trigger.cancelTask(taskId);

    await libGlobal.events.emit('onTick');

    expect(callback).not.toBeCalled();
  });

  test('should unsubscribe from global events when all tasks are completed', async () => {
    (global.close as jest.Mock).mockReturnValue(10);
    trigger.addTask(createTask({ triggerPrice: 10 }, true));

    await libGlobal.events.emit('onTick');

    expect(libGlobal.events.getListenersCount()).toEqual(0);
  });

  test('should return all tasks', async () => {
    for (let i = 0; i < 3; i++) {
      trigger.addTask(createTask({}, true));
    }

    const tasks = trigger.getAllTasks();

    expect(tasks.length).toEqual(3);
  });

  test('should return active & inactive tasks', async () => {
    (global.close as jest.Mock).mockReturnValue(15);

    for (let i = 1; i <= 3; i++) {
      trigger.addTask(createTask({ triggerPrice: i * 10 }, true));
    }

    (global.close as jest.Mock).mockReturnValue(5);
    await libGlobal.events.emit('onTick');

    const activeTasks = trigger.getActiveTasks();
    const inactiveTasks = trigger.getInactiveTasks();

    expect(activeTasks.length).toEqual(2);
    expect(inactiveTasks.length).toEqual(1);
  });

  test('should clear the list of completed tasks', async () => {
    (global.close as jest.Mock).mockReturnValue(15);

    for (let i = 0; i < 103; i++) {
      trigger.addTask(createTask({ triggerPrice: 10 }, true));
    }

    (global.close as jest.Mock).mockReturnValue(9);
    await libGlobal.events.emit('onTick');

    const inactiveTasks = trigger.getInactiveTasks();

    expect(inactiveTasks.length).toEqual(100);
  });
});
