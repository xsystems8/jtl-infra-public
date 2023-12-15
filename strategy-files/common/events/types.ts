export interface Task {
  name: string;
  params: Record<string, unknown>;
}

interface ListenerItem {
  listener: (data: unknown) => Promise<void> | void;
  listenerName: string;
  eventName: string;
  objName: string;
  id: number;
  objId: number | null;
}

export type Listeners = Record<string, ListenerItem[]>;
