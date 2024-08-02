import { TriggerTask } from '../types';

export interface TimeTrigger {
  addTask: (params: CreateTimeTaskParams) => void;
}

export interface CreateTimeTaskParams {
  name: string;
  triggerTime: number;
  args?: any;
  callback?: (args?: any) => Promise<void>;
  retry?: boolean | number;
  interval?: number;
  comment?: string;
}

export interface TimeTriggerTask extends TriggerTask {
  triggerTime: number;
  interval?: number;
}
