import { BaseObject } from '../base-object';
import { error, log } from '../log';
import { uniqueId } from '../base';
import { global } from '../global';
import { ExchangeParams } from './types';

/**
 * Exchange class for working with orders on exchange
 * In this class realized next features:
 * Triggered orders
 * Automate cancel stop orders if one of them executed
 * @params {ExchangeParams} params - params for create exchange
 * @params {string} params.exchange - exchange name (binance, bybit, binanceusdm, binanceusdm-testnet)
 * @params {string} params.symbol - symbol name
 * @params {boolean} params.hedgeMode - hedge mode flag (true or false)
 * @params {string} params.prefix - prefix for client order id (for example: 'prefix-M5' or 'prefix-S21-M5')
 * @returns {Exchange}
 *
 */
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

  onOrderChange = async (order: Order) => {
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
      log('Exchange::onOrderChange', 'slTpInfo', { slTpInfo: slTpInfo });
      await this.createSlTpByOwnerOrder(ownerOrderId, sl, tp);
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
      let { slId, tpId } = this.stopOrdersByOwnerShortId[shortClientId]; //{ orderId, sl, tp, slId, tpId }

      if (slId && order.id === slId) {
        await this.cancelOrder(tpId);
      }
      if (tpId && order.id === tpId) {
        await this.cancelOrder(slId);
      }
    }
    log('Exchange::onOrderChange', '', { order: order });
  };

  // ------------- Triggered orders ----------------
  // note: This function uses our own library for working with trigger orders.
  // It is important to note that these orders are not placed directly into the exchange's order book. Instead, they are stored locally
  // and are activated only when the market price reaches the specified trigger price.
  // Once activated, the corresponding order (market or limit) is sent to the exchange for execution.
  /**
   * Creates a trigger order (market or limit) that is sent to the exchange when the price reaches the specified trigger price.
   * @param symbol - symbol name
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price - order price (used only for limit orders)
   * @param triggerPrice - trigger price
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<void>}
   */
  createTriggeredOrder = async (
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    triggerPrice: number,
    params = {},
  ): Promise<void> => {
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
  private triggersInit = async () => {
    if (this.isTriggerInit) {
      return;
    }
    global.triggers.subscribe('Exchange:TriggeredOrder', this.executeTriggerOrder);
  };
  // ------------- Triggered orders end----------------

  /**
   * Create order on exchange
   * @param symbol - symbol name if not set, use this.symbol
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price -  order price
   * @param params - if params['sl'] or params['tp'] set, stop orders will be created automatically by this order.
   * @returns {Promise<Order>}
   *
   */
  createOrder = async (
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    params: Record<string, any> = {},
  ): Promise<Order> => {
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
      await this.createSlTpByOwnerOrder(params.clientOrderId, params['sl'], params['tp']);
    }
    let orderParams = this.changeParamsByExchange(params);
    let order = await createOrder(symbol, type, side, amount, price, orderParams);
    // Ask: ask(), Bid: bid()
    const marketInfo = { lastPrice: close(), ask: ask(), bid: bid() };
    let args = { symbol: symbol, type: type, side: side, amount: amount, price: price, orderParams: orderParams };

    if (!order.id) {
      error('Exchange::createOrder', 'order not created', {
        marketInfo: marketInfo,
        order: order,
        params: params,
        args: args,
      });
      return order;
    }

    log('Exchange::createOrder', '', { marketInfo: marketInfo, order: order, params: params, args: args });
    return order;
  };

  /**
   * Create reduce only order (close position)
   * @param symbol - symbol name
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price -  order price
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  createReduceOrder = async (
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    params = {},
  ): Promise<Order> => {
    return this.createOrder(symbol, type, side, amount, price, { ...params, reduceOnly: true });
  };

  /**
   * createSlTpByOwnerOrder - Create stop loss and take profit orders by owner order id
   * if owner order not executed yet, stop orders params saved and stop orders will be created when owner order executed (status = 'closed')
   * Also if one of stop orders executed, another will be canceled look at onOrderChange function
   * @note - stop orders could be only market type
   * @note - also you can use params = {sl: yourSl, tp:yourTp} in create order functions (createOrder, buyMarket, sellMarket, buyLimit, sellLimit ...)
   * @param ownerOrderId - owner order id
   * @param sl - stop loss price > 0 otherwise stop loss order will not be created
   * @param tp - take profit price > 0 otherwise take profit order will not be created
   * @returns {Promise<{slOrder: Order, tpOrder: Order}>}
   */
  createSlTpByOwnerOrder = async (
    ownerOrderId: string,
    sl: number,
    tp: number,
  ): Promise<{ slOrder: Order; tpOrder: Order }> => {
    //
    if (!this.stopOrdersToOpen[ownerOrderId]) {
      this.stopOrdersToOpen[ownerOrderId] = { ownerOrderId: ownerOrderId, sl: sl, tp: tp };
      log('Exchange::createSlTpByOwnerOrder', 'Stop orders params saved', {
        ownerOrderId: ownerOrderId,
        sl: sl,
        tp: tp,
      });
    }

    let orderToClose = this.getOrderById(ownerOrderId);

    //If order not executed yet, save stop orders params and return
    if (!orderToClose || orderToClose.status !== 'closed') return;

    error('Exchange::createSlTpByOwnerOrder', 'Stop orders params saved', {
      orderToClose: orderToClose,
      sl: sl,
      tp: tp,
    });

    let symbol = orderToClose.symbol;
    let sideToClose = orderToClose.side as OrderSide;
    let amount = orderToClose.amount;

    let ownerShortId = this.getShortClientId(orderToClose.clientOrderId);

    let tpOrder: Order, slOrder: Order;

    //TODO: investigate possibility to create stop orders with limit type
    const stopOrderType = 'market';

    if (sl > 0) {
      slOrder = await this.createStopLossOrder(symbol, stopOrderType, sideToClose, amount, sl, {
        ownerShortId: ownerShortId,
      });

      log('Exchange::createSlTpByOwnerOrder', 'Stop loss order created ', {
        order: slOrder,
        ownerShortId: ownerShortId,
      });
    }

    if (tp > 0) {
      tpOrder = await this.createTakeProfitOrder(symbol, stopOrderType, sideToClose, amount, tp, {
        ownerShortId: ownerShortId,
      });

      log('Exchange::createSlTpByOwnerOrder', 'Take profit order created', {
        order: tpOrder,
        ownerShortId: ownerShortId,
      });
    }

    this.stopOrdersByOwnerShortId[ownerShortId] = {
      orderId: ownerOrderId,
      sl: sl,
      tp: tp,
      slId: slOrder?.id,
      tpId: tpOrder?.id,
    };

    return { slOrder: tpOrder, tpOrder: tpOrder };
  };

  //------ Stop loss and take profit section --------
  //!important: if you crate stop loss order using createStopLossOrder and createTakeProfitOrder together.
  //In this case, both could be executed. If you want to cancel one of them, you need to cancel another manually.
  //Use createSlTpByOwnerOrder function for create stop loss and take profit orders by owner order id with auto cancel another stop order if one of them executed.

  /**
   * Create stop loss order (close position)
   * @param symbol - symbol name if not set, use this.symbol
   * @param type - 'market' or 'limit'
   * @param sideToClose - 'buy' or 'sell' - side of order to close @note: (if you want to close buy order, you need pass 'buy' to this param so stop loss order will be sell order)
   * @param amount  - order amount
   * @param triggerPrice - trigger price (stop loss price)
   * @param params - params for createOrder function (see createOrder function)
   * @note - stop loss order could be only market type
   * @returns {Promise<Order>}
   *
   */
  createStopLossOrder = async (
    symbol: string,
    type: OrderType,
    sideToClose: OrderSide,
    amount: number,
    triggerPrice: number,
    params = {},
  ): Promise<Order> => {
    //
    params = { ...params, stopLossPrice: triggerPrice, reduceOnly: true };

    let side: OrderSide = sideToClose === 'buy' ? 'sell' : 'buy';

    let order = await this.createOrder(symbol, type, side, amount, triggerPrice, params);
    log('Exchange::createStopLossOrder', 'stop order created', { order: order, params: params });
    return order;
  };

  /**
   * Create take profit order (close position)
   * @param symbol - symbol name if not set, use this.symbol
   * @param type - 'market' or 'limit'
   * @param sideToClose - 'buy' or 'sell' - side of order to close @note: (if you want to close buy order, you need pass 'buy' to this param so stop loss order will be sell order)
   * @param amount - order amount
   * @param triggerPrice - trigger price (take profit price)
   * @param params - params for createOrder function (see createOrder function)
   */
  createTakeProfitOrder = async (
    symbol: string,
    type: OrderType,
    sideToClose: OrderSide,
    amount: number,
    triggerPrice: number,
    params = {},
  ) => {
    params = { stopLossPrice: triggerPrice, reduceOnly: true, ...params };

    let side: OrderSide = sideToClose === 'buy' ? 'sell' : 'buy';

    let order = await this.createOrder(symbol, type, side, amount, triggerPrice, params);
    log('Exchange::createTakeProfitOrder', 'stop order created', { order: order, params: params });
    return order;
  };

  /**
   * cancelOrder - Cancel order by id
   * @param orderId - order id
   * @param symbol - symbol name if not set, use this.symbol
   * @returns {Promise<Order>}
   *
   */
  cancelOrder = async (orderId: string, symbol = ''): Promise<Order> => {
    log('exchange:cancelOrder ', '', { orderId: orderId, symbol: symbol });
    if (!symbol) {
      symbol = this.symbol;
    }
    return await cancelOrder(orderId, symbol);
  };

  private changeParamsByExchange = (params) => {
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

  /**
   * buyMarket - Create market buy order
   * @param symbol - symbol name if not set, use this.symbol
   * @param amount - order amount
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   *
   */
  buyMarket = async (symbol: any, amount: number, sl = 0, tp = 0, params = {}): Promise<Order> => {
    if (sl > 0 || tp > 0) {
      params = { ...params, sl: sl, tp: tp };
    }

    return this.createOrder(symbol, 'market', 'buy', amount, 0, params);
  };

  /**
   * sellMarket - Create market sell order
   * @param symbol - symbol name if not set, use this.symbol
   * @param amount - order amount
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   *
   */
  sellMarket = async (symbol: any, amount: number, sl = 0, tp = 0, params = {}) => {
    if (sl > 0 || tp > 0) {
      params = { ...params, sl: sl, tp: tp };
    }

    return this.createOrder(symbol, 'market', 'sell', amount, 0, params);
  };

  /**
   * buyLimit - Create limit buy order
   * @param symbol - symbol name if not set, use this.symbol
   * @param amount - order amount
   * @param price - order execution price
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   */
  buyLimit = async (symbol: any, amount: number, price: number, sl = 0, tp = 0, params = {}) => {
    if (sl > 0 || tp > 0) {
      params = { ...params, sl: sl, tp: tp };
    }

    return this.createOrder(symbol, 'limit', 'buy', amount, price, params);
  };

  /**
   * sellLimit - Create limit sell order
   * @param symbol - symbol name if not set, use this.symbol
   * @param amount - order amount
   * @param price - order execution price
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   *
   */
  sellLimit = async (symbol: any, amount: number, price: number, sl = 0, tp = 0, params = {}) => {
    if (sl > 0 || tp > 0) {
      params = { ...params, sl: sl, tp: tp };
    }

    return this.createOrder(symbol, 'limit', 'sell', amount, price, params);
  };

  /**
   * modifyOrder - Modify order by id (change price, amount)
   * @param id - order id
   * @param symbol - symbol name if not set, use this.symbol
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price -  order price
   */
  modifyOrder = async (id: string, symbol: string, type: OrderType, side: OrderSide, amount: number, price: number) => {
    let order = await modifyOrder(id, symbol, type, side, amount, price);

    let args = { id: id, symbol: symbol, type: type, side: side, amount: amount, price: price };
    log('Exchange::modifyOrder', '', { args: args, order: order });
    return order;
  };

  /**
   * getOrderById - Get order by id or client order id
   * @param orderId - order id or client order id
   * @returns {Order | null}
   *
   */
  getOrderById = (orderId: string): Order | null => {
    let order = this.ordersById[orderId];

    if (order) {
      return order;
    }

    order = this.ordersById[this.ordersByClientId[orderId]];

    if (order) {
      return order;
    }
    return null;
  };

  /**
   * Generate client order id for exchange orders
   * @param type - market, limit
   * @param isReduce - reduce only order flag
   * @param ownerShortId - order id owner of this stop order
   * @returns {string} - client order id (for example: 'prefix-S21-M5')
   */
  private generateClientId = (type, isReduce = false, ownerShortId = null) => {
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

  /**
   * Parse client order id to parts (prefix, shortClientId, ownerShortId)
   * @param clientOrderId - client order id (for example: 'prefix-S21-M5' or 'prefix-M5')
   * @returns {{prefix: *, shortClientId: *, ownerShortId: *}}
   *
   */
  private parseClientId(clientOrderId: string): { prefix: any; shortClientId: any; ownerShortId: any } {
    let result = clientOrderId.split('-');

    //_log('Exchange::parseClientId', '', { clientOrderId: clientOrderId, result: result });
    return {
      prefix: result[0] ? result[0] : null,
      shortClientId: result[1] ? result[1] : null,
      ownerShortId: result[2] ? result[2] : null,
    };
  }

  /**
   * Get short client order id (for example: 'M5' or 'S21-M5')
   * @param clientOrderId - client order id (for example: 'prefix-S21-M5' or 'prefix-M5')
   * @returns {string}  - short client order id (for example: 'M5' or 'S21-M5')
   */
  private getShortClientId(clientOrderId: string): string {
    return this.parseClientId(clientOrderId).shortClientId;
  }
}
