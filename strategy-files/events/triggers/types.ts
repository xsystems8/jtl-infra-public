import { CreateOrderTaskParams as CreateOrderTaskParams } from './order/types';
import { CreatePriceTaskParams as CreatePriceTaskParams } from './price/types';
import { CreateTimeTaskParams as CreateTimeTaskParams } from './time/types';

export interface TriggerTask {
  id: string;
  name: string;
  args?: any;
  callback?: (args?: any) => Promise<void>;
  type: TaskType;
  executedTimes: number;
  retry?: boolean | number;
  isTriggered: boolean;
  isActive: boolean;
  created: string;
  lastExecuted: string | null;
  createdTms: number;
  comment?: string;
  result?: any;
  error?: string;
}

export type TaskType = 'price' | 'time' | 'order';

export interface TriggerServiceInterface {
  addTaskByOrder: (params: CreateOrderTaskParams) => string;
  addTaskByPrice: (params: CreatePriceTaskParams & { symbol: string }) => string;
  addTaskByTime: (params: CreateTimeTaskParams) => string;

  getTasksByName(taskName: string, type: TaskType): TriggerTask[];

  cancelOrderTask(taskId: string): void;
  cancelPriceTask(taskId: string, symbol: string): void;
  cancelTimeTask(taskId: string): void;

  cancelAll(): void;
  cancelAllOrderTasks(): void;
  cancelAllPriceTasks(): void;
  cancelAllTimeTasks(): void;
}

export interface TriggerHandler {
  callback: (args?: any) => Promise<unknown>;
  funcName: string;
}
