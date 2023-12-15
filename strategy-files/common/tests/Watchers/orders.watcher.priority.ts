import { global } from '../../global';
import { Watcher } from './watcher';
import { currentTimeString, currentTime } from '../../utils/date-time';
import { trace } from '../../log';

/**
 * check execution queue of orders
 */
export class OrdersWatcherPriority extends Watcher {
  constructor() {
    super();

    global.events.subscribe('onOrderChange', this.onOrderChange, this);
    global.events.subscribe('onBeforeStop', this.checkOnOrderExecuted, this);
    registerCallback('createOrder', this.onCreateOrder);
  }

  orderInfo = {};
  onCreateOrder = (params, result) => {
    let symbol = params[0];
    let type = params[1];
    let side = params[2];
    let price = params[3];
    let amount = params[4];
    let orderParams = params[5] ?? {};

    let id = result.id;

    if (this.orderInfo[id]) {
      this.errorOnce(
        'OrdersWatcherPriority:onCreateOrder',
        'order already exists not possible to create order with the same id',
        { params, result },
      );
    }

    this.orderInfo[id] = {
      type: type,
      createTime: currentTime(),
      openTime: null,
      closeTime: null,
      cancelTime: null,
      modifyTime: null,
      symbol: symbol,
      iterator: 0,
      order: result,
    };
  };

  onOrderChange = async (order) => {
    await this.checkOrderTime(order);
  };

  checkOrderTime = async (order) => {
    let orderInfo = this.orderInfo[order.id];
    if (!orderInfo) {
      this.errorOnce('OrdersWatcherPriority:checkOrderTime', 'Order not found in orderInfo', { order });
      return;
    }
    if (order.status === 'open') {
      if (!orderInfo.openTime) {
        orderInfo.openTime = currentTime();
      } else {
        this.errorOnce('OrdersWatcherPriority:checkOrderTime', '!!!TODO check is order modify', { order });
      }
    }
    if (order.status === 'closed') orderInfo.closeTime = currentTime();
    if (order.status === 'canceled') orderInfo.cancelTime = currentTime();

    if (order.type === 'limit') {
      if (orderInfo.openTime !== orderInfo.createTime && order.status === 'open')
        this.error(
          'OrdersWatcherPriority:checkOrderTime',
          'Limit order with status = open should be sent to OnOrderChange at the same candle when it was created',
          { orderInfo: orderInfo, order: order },
        );

      if (orderInfo.openTime >= orderInfo.closeTime && order.status === 'close')
        this.error(
          'OrdersWatcherPriority:checkOrderTime',
          'Limit order with status = close could be executed only on next candles after it was open',
          { orderInfo: orderInfo, order: order },
        );
    }

    if (order.type === 'market') {
      if (orderInfo.openTime !== orderInfo.createTime && order.status === 'open')
        this.error(
          'OrdersWatcherPriority:checkOrderTime',
          'Market order with status = open should be sent to OnOrderChange at the same candle when it was created',
          { orderInfo: orderInfo, order: order },
        );

      if (orderInfo.openTime !== orderInfo.closeTime && order.status === 'close')
        this.error(
          'OrdersWatcherPriority:checkOrderTime',
          'Market order with status = close could be executed on the same candle when it was created ',
          { orderInfo: orderInfo, order: order },
        );
    }
  };

  checkOnOrderExecuted = async () => {
    for (const id in this.orderInfo) {
      let orderInfo = this.orderInfo[id];
      if (orderInfo.type === 'market') {
        if (orderInfo.openTime === null || orderInfo.closeTime === null) {
          this.error('OrdersWatcherPriority:onStop', 'onOrderChange() was not executed for market order', {
            orderInfo: orderInfo,
          });
        }
      }

      if (orderInfo.type === 'limit') {
        if (orderInfo.openTime === null) {
          this.error('OrdersWatcherPriority:onStop', 'onOrderChange() was not executed for limit order', {
            orderInfo: orderInfo,
          });
        }
      }
    }
  };
}
