export interface ExchangeParams {
  symbol: string;
  exchange: string;
  hedgeMode?: boolean;
  prefix?: string;
}

export interface OrdersBasketParams {
  symbol?: string;
  hedgeMode?: boolean;
  exchange?: string;
  idPrefix?: string;
  id?: string;
  // TODO: что это?
  subscribeEvents?: any;
}
