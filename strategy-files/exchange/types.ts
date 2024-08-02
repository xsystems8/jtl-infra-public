export interface ExchangeParams {
  symbol: string;
  exchange: string;
  hedgeMode?: boolean;
  prefix?: string;
  leverage?: number;
  triggerType?: TriggerType;
}

export interface OrdersBasketParams {
  symbol?: string;
  hedgeMode?: boolean;
  exchange?: string;
  idPrefix?: string;
  id?: string;
}

export type TriggerType = 'exchange' | 'script';

export interface StopOrderData {
  ownerOrderClientId: string;
  slOrderId?: string;
  tpOrderId?: string;
}

export interface CreateTriggerOrderByTaskParams {
  type: OrderType;
  side: OrderSide;
  amount: number;
  price: number;
  params: Record<string, unknown>;
}

export interface StopOrderQueueItem {
  ownerOrderId: string;
  sl?: number;
  tp?: number;
  prefix: string;
}
