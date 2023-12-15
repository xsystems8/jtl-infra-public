import { global } from '../../global';
import { Watcher } from './watcher';
import { checkOrderStructure } from '../helpers';
import { currentTimeString, currentTime } from '../../utils/date-time';

/**
 * Check order execution and order structure
 *
 */
export class OrdersWatcher extends Watcher {
  orderInfoById = {};
  orderById = {};

  constructor() {
    super();

    //globals.events.subscribe('onOrderChange', this.updateOrderInfo, this);
    global.events.subscribe('onOrderChange', this.checkOrder, this);
    global.events.subscribe('onTickEnded', this.onTickEnded, this);
  }

  checkOrder = async (order) => {
    if (!this.orderById[order.id]) {
      this.orderById[order.id] = [];
    }

    //  let orderInfo = this.orderInfoById[order.id];

    this.orderById[order.id].push(order);

    if (order.order === 'limit' && order.status === 'open') {
      //place task to check limit order execution on order.price
      // TODO: неправильно передаются аргументы
      global.triggers.addTaskByPrice(order.price, this.checkLimitExecuted, order, { taskLinkId: order.id });
    }

    this.updateOrderInfo(order);

    //check order structure
    this.addErrors(checkOrderStructure(order));
  };

  //
  limitOrdersToCheck = [];
  checkLimitExecuted = async (task) => {
    let order = task.params;
    //all orders will be checked at the end of the tick in onTickEnded
    this.limitOrdersToCheck.push(order);
  };

  onTickEnded = async (candle) => {
    if (this.limitOrdersToCheck.length > 0) {
      for (let order of this.limitOrdersToCheck) {
        let id = order.id;
        let lastOrder = this.orderById[id][this.orderById[id].length - 1];

        if (lastOrder.status !== 'close' && lastOrder.status !== 'canceled') {
          this.errorOnce('checkLimitExecuted', 'Limit order not executed at ' + order.price, {
            order: order,
            lastOrder: lastOrder,
            candle: candle,
          });
        }
      }
    }
  };

  updateOrderInfo(order) {
    if (!this.orderInfoById[order.id]) {
      this.orderInfoById[order.id] = {
        type: order.type,
      };
    }
    let orderInfo = this.orderInfoById[order.id];

    if (order.status === 'open') {
      if (orderInfo.openTime) {
        //TODO check if order was changed
        this.errorOnce('updateOrderInfo', 'Order came twice to onOrderChange with the same status = ' + order.status, {
          comment: '!!!it could because order was changed',
          orderInfo: orderInfo,
          order: order,
        });
      }
      orderInfo.openTime = order.timestamp;
    }

    if (order.status === 'filled') {
      orderInfo.filledTime = order.timestamp;
    }

    if (order.status === 'closed') {
      if (orderInfo.closedTime) {
        this.errorOnce('updateOrderInfo', 'Order came twice to onOrderChange with the same status = ' + order.status, {
          orderInfo: orderInfo,
          order: order,
        });
      }
      orderInfo.closedTime = order.timestamp;
    }

    if (order.status === 'canceled') {
      if (orderInfo.canceledTime) {
        this.errorOnce('updateOrderInfo', 'Order came twice to onOrderChange with the same status = ' + order.status, {
          orderInfo: orderInfo,
          order: order,
        });
      }
      orderInfo.canceledTime = order.timestamp;
    }

    if (order.status === 'rejected') {
      if (orderInfo.rejectedTime) {
        this.errorOnce('updateOrderInfo', 'Order came twice to onOrderChange with the same status = ' + order.status, {
          orderInfo: orderInfo,
          order: order,
        });
      }
      orderInfo.rejectedTime = order.timestamp;
    }
  }
}
