import { BaseObject } from '../base-object';
import { error, log, warning } from '../log';
import { uniqueId } from '../base';
import { global } from '../global';
import { ExchangeParams } from './types';
import { OrderSide } from '../../../pre-build/environment/exchange/interface/order.interface';

export class Exchange extends BaseObject {
  symbol: string;
  hedgeMode = false;
  exchange = null;
  ownParams = ['sl', 'tp', 'ownerOrderId', 'ownerShortId', 'stopOrderType'];
  ordersById = {};
  ordersByClientId = {};

  stopOrdersByOwnerShortId = {};
  stopOrdersToOpen = {}; // {orderId: {orderId, sl, tp, }}

  prefix = '';
  nextOrderId = 0;
  constructor(params: ExchangeParams) {
    super();
    this.exchange = params.exchange;
    this.hedgeMode = params.hedgeMode ? params.hedgeMode : false;
    this.symbol = params.symbol;
    this.prefix = params.prefix ? params.prefix : uniqueId(4);

    global.events.subscribe('onOrderChange', this.onOrderChange, this);
    global.events.subscribe('onInit', this.init, this);

    return this;
  }

  init = async () => {
    log('Exchange::init', `exchange = ${this.exchange} symbol = ${this.symbol}`, {}, true);
    return true;
  };

  onOrderChange = async (order) => {
    const { ownerShortId, shortClientId } = this.parseClientId(order.clientOrderId); // if not null - this is stop order

    this.ordersById[order.id] = order;
    this.ordersByClientId[order.clientOrderId] = order.id;
    this.ordersByClientId[shortClientId] = order.id;

    //Create stop orders if order executed
    const slTpInfo = this.stopOrdersToOpen[order.id]
      ? this.stopOrdersToOpen[order.id]
      : this.stopOrdersToOpen[order.clientOrderId];
    if (slTpInfo && order.status === 'closed') {
      let { ownerOrderId, sl, tp } = slTpInfo; //
      await this.createSlTpOrders(ownerOrderId, sl, tp);
    }

    //Cancel stop orders if order canceled
    if (order.status === 'canceled' && this.stopOrdersByOwnerShortId[shortClientId]) {
      let tpId = this.stopOrdersByOwnerShortId[shortClientId].tpId;
      let slId = this.stopOrdersByOwnerShortId[shortClientId].slId;

      //TODO: special function for cancel stop loss orders
      if (slId) {
        await this.cancelOrder(slId);
      }
      if (tpId) {
        await this.cancelOrder(tpId);
      }
    }

    //Cancel stop orders if one of them executed
    if (ownerShortId && this.stopOrdersByOwnerShortId[shortClientId]) {
      let { orderId, sl, tp, slId, tpId } = this.stopOrdersByOwnerShortId[shortClientId];

      if (slId && order.id === slId) {
        await this.cancelOrder(tpId);
      }
      if (tpId && order.id === tpId) {
        await this.cancelOrder(slId);
      }
    }
  };

  /**
   * Creates a trigger order (market or limit) that is sent to the exchange when the price reaches the specified trigger price.
   * This function uses our own library for working with trigger orders.
   * It is important to note that these orders are not placed directly into the exchange's order book. Instead, they are stored locally
   * and are activated only when the market price reaches the specified trigger price.
   * Once activated, the corresponding order (market or limit) is sent to the exchange for execution.
   * @param symbol - symbol name
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price - order price (used only for limit orders)
   * @param triggerPrice - trigger price
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<{error: string}|{order: {}}|{id}|{}>}
   */
  createTriggeredOrder = async (symbol, type, side, amount, price, triggerPrice, params = {}) => {
    let triggerOrderParams = {
      symbol: symbol,
      type: type,
      side: side,
      amount: amount,
      price: price,
      triggerPrice: triggerPrice,
      params: params,
    };

    global.triggers.addTaskByPrice(triggerPrice, 'Exchange:TriggeredOrder', triggerOrderParams);
  };

  executeTriggerOrder = async (task) => {
    let taskParams = task.params;
    if (!this.isTriggerInit) {
      await this.triggersInit();
    }
    let { symbol, type, side, amount, price, params } = taskParams;

    let order = await this.createOrder(symbol, type, side, amount, price, params);

    log('Exchange::executeTriggerOrder', '', { order: order, task: task });
  };

  isTriggerInit = false;
  triggersInit = async () => {
    if (this.isTriggerInit) {
      return;
    }
    global.triggers.subscribe('Exchange:TriggeredOrder', this.executeTriggerOrder);
  };

  createOrder = async (
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    params: Record<string, any> = {},
  ) => {
    //type 'market' or 'limit' or 'STOP_LOSS' or 'STOP_LOSS_LIMIT' or 'TAKE_PROFIT' or 'TAKE_PROFIT_LIMIT' or 'STOP'
    if (!symbol) {
      symbol = this.symbol;
    }

    if (side !== 'buy' && side !== 'sell') {
      error('Exchange::createOrder', 'side must be buy or sell', { side: side });
      return { error: 'side must be buy or sell' };
    }

    if (this.hedgeMode) {
      params['positionSide'] = side === 'buy' ? 'long' : 'short';

      if (params['reduceOnly']) {
        params['positionSide'] = side === 'buy' ? 'short' : 'long';
      }
    }

    params.clientOrderId = this.generateClientId(type, params['reduceOnly'] ?? false, params['ownerShortId'] ?? null);

    if (params['sl'] || params['tp']) {
      await this.createSlTpOrders(params.clientOrderId, params['sl'], params['tp']);
    }

    let orderParams = this.changeParamsByExchange(params);
    let order = await createOrder(symbol, type, side, amount, price, orderParams);

    let args = { symbol: symbol, type: type, side: side, amount: amount, price: price, orderParams: orderParams };
    if (!order.id) {
      error('Exchange::createOrder', 'order not created', { order: order, params: params, args: args });
      return order;
    }

    log('Exchange::createOrder', '', { order: order, params: params, args: args });
    return order;
  };

  createReduceOrder = async (symbol, type, side, amount, price, params = {}) => {
    params['reduceOnly'] = true;

    let order = this.createOrder(symbol, type, side, amount, price, params);

    return order;
  };

  createSlTpOrders = async (ownerOrderId: string, sl: number, tp: number) => {
    if (!this.stopOrdersToOpen[ownerOrderId]) {
      this.stopOrdersToOpen[ownerOrderId] = { ownerOrderId: ownerOrderId, sl: sl, tp: tp };
    }

    let orderToClose = this.getOrderById(ownerOrderId);

    //If order not executed yet, save stop orders params and return
    if (!orderToClose || orderToClose.status === 'closed') return;

    let symbol = orderToClose.symbol;
    let sideToClose = orderToClose.side as OrderSide;
    let amount = orderToClose.amount;

    let ownerShortId = this.getShortClientId(orderToClose.clientOrderId);

    let tpOrder: Order, slOrder: Order;

    //TODO: add to tester stop orders with type = market  (market not works with triggerPrice/stopPrice)
    // for now type = limit in tester
    const stopOrderType = isTester() ? 'limit' : 'market';

    if (sl > 0) {
      slOrder = await this.createStopLossOrder(symbol, stopOrderType, sideToClose, amount, sl, {
        ownerShortId: ownerShortId,
      });

      log('Exchange::createStopOrders', 'stop loss order created', { order: slOrder });
    }

    if (tp > 0) {
      tpOrder = await this.createTakeProfitOrder(symbol, stopOrderType, sideToClose, amount, tp, {
        ownerShortId: ownerShortId,
      });

      log('Exchange::createStopOrders', 'take profit order created', { order: tpOrder });
    }

    this.stopOrdersByOwnerShortId[ownerShortId] = {
      orderId: ownerOrderId,
      sl: sl,
      tp: tp,
      slId: slOrder.id,
      tpId: tpOrder.id,
    };

    return { slOrder: tpOrder, tpOrder: tpOrder };
  };

  createStopLossOrder = async (
    symbol: string,
    type: OrderType,
    sideToClose: OrderSide,
    amount: number,
    triggerPrice: number,
    params: Record<string, unknown> = {},
  ) => {
    params.stopLossPrice = triggerPrice;
    // params.reduceOnly = true;
    let side: OrderSide = sideToClose === 'buy' ? 'sell' : 'buy';

    let order = await this.createOrder(symbol, type, side, amount, triggerPrice, params);
    log('Exchange::createStopLossOrder', 'stop order created', { order: order, params: params });
    return order;
  };

  createTakeProfitOrder = async (
    symbol: string,
    type: OrderType,
    sideToClose: OrderSide,
    amount: number,
    triggerPrice: number,
    params: Record<string, unknown> = {},
  ) => {
    params.takeProfitPrice = triggerPrice;
    // params.reduceOnly = true;
    let side: OrderSide = sideToClose === 'buy' ? 'sell' : 'buy';

    let order = await this.createOrder(symbol, type, side, amount, triggerPrice, params);
    log('Exchange::createTakeProfitOrder', 'stop order created', { order: order, params: params });
    return order;
  };

  cancelOrder = async (orderId, symbol = '') => {
    log('exchange:cancelOrder ', '', { orderId: orderId, symbol: symbol });

    return await cancelOrder(orderId, symbol);
  };
  changeParamsByExchange = (params) => {
    let result = {};
    let allowed = {
      positionSide:
        this.hedgeMode &&
        (this.exchange === 'binance' || this.exchange === 'binanceusdm' || this.exchange === 'binanceusdm-testnet'),
      positionIdx: this.exchange === 'bybit' && this.hedgeMode,
      timeInForce: true,
      leverage: true,
      clientOrderId: true,
      stopPrice: true,
      triggerPrice: true,
      reduceOnly: !params.stopLossPrice && !params.takeProfitPrice, // binance generate error if reduceOnly = true and stopPrice or triggerPrice set
      takeProfitPrice: true,
      stopLossPrice: true,
    };

    if (this.exchange === 'bybit') {
      params['positionIdx'] = params['positionSide'] === 'long' ? '1' : '2';
    }

    for (let key in params) {
      if (allowed[key]) {
        result[key] = params[key];
      }
    }
    log('changeParamsByExchange', '', { params: params, result: result });
    return result;
  };

  buyMarket = async (symbol: any, amount: number, sl = 0, tp = 0, params = {}) => {
    if (sl > 0 || tp > 0) {
      params = { ...params, sl: sl, tp: tp };
    }

    let order = await this.createOrder(symbol, 'market', 'buy', amount, 0, params);

    return order;
  };

  sellMarket = async (symbol: any, amount: number, sl = 0, tp = 0, params = {}) => {
    if (sl > 0 || tp > 0) {
      params = { ...params, sl: sl, tp: tp };
    }

    let order = await this.createOrder(symbol, 'market', 'sell', amount, 0, params);

    return order;
  };

  buyLimit = async (symbol: any, amount: number, price: number, sl = 0, tp = 0, params = {}) => {
    if (sl > 0 || tp > 0) {
      params = { ...params, sl: sl, tp: tp };
    }

    let order = await this.createOrder(symbol, 'limit', 'buy', amount, price, params);

    return order;
  };

  sellLimit = async (symbol: any, amount: number, price: number, sl = 0, tp = 0, params = {}) => {
    if (sl > 0 || tp > 0) {
      params = { ...params, sl: sl, tp: tp };
    }

    let order = await this.createOrder(symbol, 'limit', 'sell', amount, price, params);

    return order;
  };

  getOrderById = (orderId): Order | null => {
    let order = this.ordersById[orderId];

    if (order) {
      return order;
    }

    order = this.ordersById[this.ordersByClientId[orderId]];

    if (order) {
      return order;
    }
    // _warning('Exchange::getOrderById', 'order not found', {
    //   orderId: orderId,
    //   orderIdByClientId: this.ordersByClientId[orderId],
    //   orderById: this.ordersById[orderId],
    //   orderbyClientId: this.ordersById[this.ordersByClientId[orderId]],
    // });
    return null;
  };

  /**
   * Generate client order id for exchange orders
   * @param type - market, limit
   * @param isReduce - reduce only order flag
   * @param ownerShortId - order id owner of this stop order
   * @returns {string} - client order id (for example: 'prefix-S21-M5')
   */
  generateClientId = (type, isReduce = false, ownerShortId = null) => {
    let id = '';

    if (type === 'market') {
      id = 'M';
    }
    if (type === 'limit') {
      id = 'L';
    }
    if (isReduce) {
      id = ownerShortId ? 'S' : 'R';
    }

    id = this.prefix + '-' + id + this.nextOrderId++;

    if (ownerShortId) {
      return id + '-' + ownerShortId;
    }
    return id;
  };

  parseClientId(clientOrderId) {
    let result = clientOrderId.split('-');

    //_log('Exchange::parseClientId', '', { clientOrderId: clientOrderId, result: result });
    return {
      prefix: result[0] ? result[0] : null,
      shortClientId: result[1] ? result[1] : null,
      ownerShortId: result[2] ? result[2] : null,
    };
  }

  getShortClientId(clientOrderId) {
    return this.parseClientId(clientOrderId).shortClientId;
  }
}
