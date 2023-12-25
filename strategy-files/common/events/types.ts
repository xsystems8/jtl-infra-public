export interface Task {
  name: string;
  callback: (params: Record<string, unknown>) => Promise<void> | void;
  params: Record<string, unknown>;
}

interface ListenerInfo {
  listener: (...args: any[]) => Promise<void> | void;
  listenerName: string;
  eventName: string;
  objName: string;
  id: number;
  objId: string | null;
}

export type Listeners = Record<string, ListenerInfo[]>;
