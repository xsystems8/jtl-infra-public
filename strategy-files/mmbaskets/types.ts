export interface BasketChannelParams {
  gapPercent: number;
  hedgeTpPercent: number;
  hedgeSlPercent: number;
  tpPercent: number;
  slPercent: number;
  orderSide: OrderSide;
  getSizeType: string;
}
