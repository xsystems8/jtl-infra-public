import { uniqueId } from '../base';
import { global } from '../global';
import { longProfit, shortProfit } from './heplers';
import { isZero, normalize } from '../utils/numbers';
import { BaseObject } from '../base-object.js';
import { currentTime, timeToString } from '../utils/date-time';
import { debugLog, error, errorOnce, log } from '../log';
import { OrdersBasketParams } from './types';

export class OrdersBasketV1 extends BaseObject {
  posCount = 0;

  _ordersById;
  orderNextId = 0;
  _historyOrdersById;
  orderLastTimeUpdated = 0;
  ordersCount = 0;
  _stopOrdersByOwnerId = {};

  _posSlot = {};

  _idPrefix = ''; // unique prefix id for orders [real trading]

  symbol = '';

  profit = 0;
  drawdown = 0;
  version = '1.1.9';
  fee = 0;

  isOrderCreateProcessing = false;
  isLoggingEnabled = true;
  volume = 0;
  constructor(params: OrdersBasketParams = {}) {
    super();
    this.log('ob:constructor', `version ${this.version}) `, params);

    this._ordersById = new Map();
    this._historyOrdersById = new Map();

    this.symbol = params.symbol ?? global.strategy.symbol ?? 'BTCUSDT';

    this.hedgeMode = params.hedgeMode ?? true;
    this.exchange = params.exchange ?? 'binance';

    if (!isTester() && !params.idPrefix) {
      this._idPrefix = uniqueId(4) + '.';
    }
    if (params.idPrefix) {
      this._idPrefix += params.idPrefix + '.';
    }

    this.id = params.id ?? uniqueId(4);

    params.subscribeEvents = params.subscribeEvents ?? true;
    this.params = params;
    return this;
  }

  //in case events emitter is disabled. onOrderChange should be called manually
  onOrderChange = async (order) => {
    //_updatePosSlot should be called before _updateOrders
    await this._updatePosSlot(order);
    await this._updateOwnOrder(order);
  };

  async init() {
    this.log('init', 'OrdersBasket( ' + this.id + ') is initialized ');

    if (this.params.subscribeEvents) {
      //_updatePosSlot should be called before _updateOrders
      global.events.subscribe('onOrderChange', this._updatePosSlot, this);
      global.events.subscribe('onOrderChange', this._updateOwnOrder, this);
      //  globals.events.subscribe('onBeforeTick', this.historyCollector, this);
    }

    // let maxId = 0;
    // //find max id in orders already placed on exchange and set orderNextId
    // //to prevent client id collision with orders placed on exchange
    // orders.forEach((order) => {
    //   //clientOrderId: "test.O0"
    //   let orderId = order.clientOrderId.split('.')[1]; // O0, C1, O2
    //   if (orderId) {
    //     const intId = parseInt(orderId.replace(/\D/g, ''));
    //     maxId = Math.max(maxId, intId);
    //   }
    // });
    //
    // this.orderNextId = maxId + 1;
    // this.log('ob:init', 'maxId ', { maxId: maxId, orderNextId: this.orderNextId });
    return this;
  }

  log = (event, msg, params) => {
    if (this.isLoggingEnabled) {
      log(this.orderNextId + ' | ' + event, msg, params);
    }
  };

  getOrderById = (ownOrderId) => {
    if (this._ordersById.has(ownOrderId)) {
      return this._ordersById.get(ownOrderId);
    }

    if (this._historyOrdersById.has(ownOrderId)) {
      return this._historyOrdersById.get(ownOrderId);
    }

    log('ob:getOrderById', `Error order id(${ownOrderId}) not exist`);

    return undefined;
  };

  closeAllPositions = async (params = {}) => {
    let posSlot;
    if (this.isHedged) {
      posSlot = this.getPosSlot('long');
      if (posSlot.size > 0) {
        await this.sellMarket(posSlot.size, 0, 0, { ...params, reduceOnly: true });
      }
      posSlot = this.getPosSlot('short');
      if (posSlot.size > 0) {
        await this.buyMarket(posSlot.size, 0, 0, { ...params, reduceOnly: true });
      }
    } else {
      posSlot = this.getPosSlot('both');
      if (posSlot.size > 0) {
        if (posSlot.side === 'long') {
          await this.sellMarket(posSlot.size, 0, 0, { ...params, reduceOnly: true });
        }
        if (posSlot.side === 'short') {
          await this.buyMarket(posSlot.size, 0, 0, { ...params, reduceOnly: true });
        }
      }
    }
  };

  registerOnOpenPosition(callback) {
    this.onOpenPositionCallBack = callback;
  }
  registerOnClosePosition(callback) {
    this.onClosePositionCallBack = callback;
  }

  _changeParamsByExchange = (params) => {
    let result = {};
    let allowed = ['timeInForce', 'reduceOnly'];
    if (this.exchange === 'binance' || this.exchange === 'binanceusdm') {
      if (this.hedgeMode) {
        allowed = ['positionSide', 'timeInForce', 'leverage', 'clientOrderId', 'stopPrice'];
      } else {
        allowed = ['timeInForce', 'reduceOnly', 'leverage', 'clientOrderId', 'stopPrice'];
      }
    }

    for (let key in params) {
      if (allowed.includes(key)) {
        result[key] = params[key];
      }
    }
    this.log('changeParamsByExchange', '', { params: params, result: result });
    return result;
  };

  _updatePosSlot = async (order) => {
    if (order.status !== 'filled' && order.status !== 'closed') {
      return;
    }
    this.isHedged = true;

    let posSide = 'both'; //
    let isReduce = order.reduceOnly;
    let side = order.side === 'buy' ? 'long' : 'short';
    if (isReduce) side = side === 'long' ? 'short' : 'long';
    if (this.isHedged) posSide = side;

    //TODO разработать для тестера и рантайма правила например  стандартные параметры
    // positionSide  - для использовать только в hedgeMode для остальных бирж переделывать параметр согласно их документации
    // triggerPrice  - для стоп ордеров и тригерных ордеров вместо stopPrice ??
    // stopPrice
    // reduceOnly - все закрывающие ордера должны быть reduceOnly / но как быть вне hedgeMode там это особо не нужно
    // postOnly  -
    // Нужен тест для рантайма для разных бирж что все работает корректно - так как ожидается  с этимим параметрами
    // например ставит ли биржа сама reduceOnly если в хедже открываешь открываешь обратную посицию ( positionSide = short order.side = buy)
    // добавить проверки в watcher
    // написать это в мануал

    let posSlot = this.getPosSlot(posSide);
    if (!posSlot.side) posSlot.side = side;

    if (isReduce) {
      if (order.side === 'sell') {
        posSlot.profit += order.amount * (order.price - posSlot.entryPrice);
      } else {
        posSlot.profit += order.amount * (posSlot.entryPrice - order.price);
      }
    }

    if (!isReduce) {
      posSlot.entryPrice =
        (posSlot.size * posSlot.entryPrice + order.amount * order.price) / (posSlot.size + order.amount);
      posSlot.size += order.amount;
    } else {
      if (posSlot.size - order.amount === 0) {
        posSlot.entryPrice = 0;
      }
      posSlot.size -= order.amount;
    }

    posSlot.size = isZero(posSlot.size) ? 0 : posSlot.size;

    if (posSlot.size < 0) {
      errorOnce('basket:updatePosSlot', 'posSlot.size < 0', {
        posSlot: posSlot,
        order: order,
      });
    }
    // _consoleInfo('ob:updatePosSlot', 'posSlot.size', { posSlot: posSlot });
    // ko();
    this._posSlot[posSide] = posSlot;
  };

  getPosSlot(posSide = 'both') {
    // _consoleInfo('ob:getPosSlot', 'getPosSlot', { slot: posSide, side: side });
    if (!this._posSlot[posSide]) {
      this._posSlot[posSide] = {
        side: '',
        size: 0,
        entryPrice: 0,
        profit: 0,
      };
    }
    return this._posSlot[posSide];
  }

  _clearStdParams(params) {
    const stdKeys = [
      'comment',
      'sl',
      'tp',
      'side',
      'reduceOnly',
      'slPercent',
      'tpPercent',
      'positionSide',
      'timeInForce',
      'leverage',
      'clientOrderId',
      'stopPrice',
      'type',
    ];

    let newParams = {};
    for (let key in params) {
      if (stdKeys.includes(key)) {
        continue;
      }
      newParams[key] = params[key];
    }
    return newParams;
  }

  modifyOrder = async (ownOrderId, params) => {};

  buyMarket = async (size, sl = 0, tp = 0, params = {}) => {
    this.log('ob:buyMarket', '========== BUY MARKET==========', { size: size, sl: sl, tp: tp });
    try {
      params.sl = sl;
      params.tp = tp;

      let ownOrder = await this._createOrder('market', 'buy', size, 0, params);

      return ownOrder;
    } catch (e) {
      error('ob:buyMarket', 'error ' + e.message, { stack: e.stack.slice(1, 100) });
    }
    return {};
  };

  sellMarket = async (size, sl = 0, tp = 0, params = {}) => {
    this.log('ob:sellMarket', '========== SELL MARKET==========', { size: size, sl: sl, tp: tp });
    try {
      params.sl = sl;
      params.tp = tp;

      let ownOrder = await this._createOrder('market', 'sell', size, 0, params);

      return ownOrder;
    } catch (e) {
      error('ob:sellMarket', 'error ' + e.message, { e: e });
    }
    return {};
  };

  buyLimit = async (size, price, sl = 0, tp = 0, params = {}) => {
    this.log('ob:buyLimit', '========== BUY LIMIT==========', { size: size, price: price, sl: sl, tp: tp });
    try {
      params.sl = sl;
      params.tp = tp;
      let ownOrder = await this._createOrder('limit', 'buy', size, price, params);

      return ownOrder;
    } catch (e) {
      error('ob:buyLimit', 'error ' + e.message, { e: e });
    }
    return {};
  };

  sellLimit = async (size, price, sl = 0, tp = 0, params = {}) => {
    this.log('ob:sellLimit', '========== SELL LIMIT==========', { size: size, price: price, sl: sl, tp: tp });

    try {
      params.sl = sl;
      params.tp = tp;
      let ownOrder = await this._createOrder('limit', 'sell', size, price, params);
      return ownOrder;
    } catch (e) {
      error('ob:sellLimit', 'error ' + e.message, { e: e });
    }
  };
  sellStopLimit = async (size, price, stopPrice, sl = 0, tp = 0, params = {}) => {
    this.log('ob:sellStopLimit', '========== SELL STOP LIMIT==========', {
      size: size,
      price: price,
      sl: sl,
      tp: tp,
    });
    //TODO возможно нужно использовать triggerPrice вместо stopPrice
    // params.stopPrice = execution_price;
    params.stopPrice = stopPrice;
    if (price < stopPrice) {
      error('ob:sellStopLimit', 'price should be >= stopPrice', { price: price, stopPrice: stopPrice });
      return;
    }

    try {
      params.sl = sl;
      params.tp = tp;

      let ownOrder = await this._createOrder('limit', 'sell', size, price, params);

      return ownOrder;
    } catch (e) {
      error('ob:sell_stop_limit', 'error ' + e.message, { e: e });
    }
  };

  buyStopLimit = async (size, price, stopPrice, sl = 0, tp = 0, params = {}) => {
    this.log('ob:buyStopLimit', '========== BUY STOP LIMIT==========', {
      size: size,
      price: price,
      sl: sl,
      tp: tp,
    });

    params.stopPrice = stopPrice;

    if (price > stopPrice) {
      error('ob:buyStopLimit', 'price should be <= stopPrice', { price: price, stopPrice: stopPrice });
      return {};
    }
    try {
      params.sl = sl;
      params.tp = tp;
      let order = await this._createOrder('limit', 'buy', size, price, params);

      this.log('ob:buyStopLimit', 'executed', { order: order });
    } catch (e) {
      error('ob:buyStopLimit', 'error ' + e.message, { e: e });
    }
  };

  _createOwmOrder = async (type, side, amount, price, params = {}) => {
    let ownId = 'O';
    if (params.reduceOnly) {
      ownId = params.isStop ? 'S' : 'C';
    }
    ownId = this._idPrefix + ownId + this.orderNextId++;

    if (params.stopType && params.ownOrderId) {
      ownId = params.ownOrderId + '.' + params.stopType;
    }

    if (params.forceOwnOrderId) {
      ownId = params.forceOwnOrderId;

      let MaxId = parseInt(ownId.split('.').pop().replace(/\D/g, ''));
      this.orderNextId = Math.max(this.orderNextId, MaxId);
    }
    let ownOrder = {
      id: ownId,
      realId: null,
      datetime: '', // standard format
      type: type,
      amount: amount,
      sizeQuoted: normalize(price * amount, 2),
      side: side,
      price: price,
      sl: params.sl ?? 0,
      tp: params.tp ?? 0,
      status: 'empty',
      comment: params.comment ?? '',
      isStop: params.isStop ?? false,
      reduceOnly: params.reduceOnly ?? false,
      clientOrderId: '',
      timestamp: 0,
      lastTradeTimestamp: 0,
      symbol: '',
      timeInForce: '',
      average: '',
      filled: 0,
      remaining: 0,
      cost: 0,
      params: this._clearStdParams(params),
      stopType: params.stopType ?? '',
      ownerId: params.ownerId ?? '',
      slId: '',
      tpId: '',
    };

    let result = this._ordersById.set(ownId, ownOrder);

    this.log('ob:createOwmOrder', 'Created ownOrder id ' + ownId, { ownOrder: ownOrder, params: params });

    return ownOrder;
  };

  _createOrder = async (type, side, amount, price, params = {}) => {
    let order_params = params;

    //‘SELL’ ‘LONG’ combination would only close positions.
    order_params.positionSide = side === 'buy' ? 'long' : 'short';

    order_params.leverage = 20;

    let reduceOnly = params.reduceOnly ?? false;
    reduceOnly = params.isStop ?? reduceOnly;
    if (reduceOnly) {
      order_params.positionSide = side === 'buy' ? 'short' : 'long';
      order_params.reduceOnly = true;
    }

    let ownOrder = await this._createOwmOrder(type, side, amount, price, params);

    order_params.clientOrderId = ownOrder.id;

    order_params = this._changeParamsByExchange(order_params);

    let order, orderA;

    order = await createOrder(type, side, amount, price, order_params);
    //_consoleInfo('ob:_createOrder', 'executed', { ownOrder: order });
    // order = { ...orderA };

    //ошибка в тестере должен возврашаться close
    // if (type === 'market' && order.status === 'open') {
    //   order.status === 'close';
    // }
    // info({ c: '!!!', order: order, order_params: order_params });

    if (!order.status && !order.id) {
      error('ob:createOrder', `Error create order id ` + ownOrder.id, {
        order_params: order_params,
        params: params,
        order: order,
      });
      return {};
    }

    this.ordersCount++;

    this.log('ob:createOrder', `Created order id = ` + ownOrder.id, {
      order_params: order_params,
      params: params,
      order: order,
    });

    return ownOrder;
  };
  _updateOwnOrderProps(ownOrder, newProps) {
    let propsUpdated = {};
    let isUpdated = false;
    let skipProps = ['id', 'realId', 'clientOrderId'];

    if (newProps.clientOrderId && newProps.id) {
      ownOrder.realId = newProps.id;
    }
    if (newProps.timestamp) {
      propsUpdated['datetime'] = { new: timeToString(newProps.timestamp), old: ownOrder.datetime };
      ownOrder.datetime = timeToString(newProps.timestamp);
    }

    for (let key in newProps) {
      if (ownOrder[key] !== newProps[key]) {
        if (skipProps.includes(key)) {
          continue;
        }

        propsUpdated[key] = { new: newProps[key], old: ownOrder[key] };
        // ko();

        if (key === 'comment') {
          if (newProps[key] !== '') {
            ownOrder[key] += ' | ' + newProps[key];
          }
        } else {
          ownOrder[key] = newProps[key];
        }

        isUpdated = true;
      }
    }

    this.log('ob:updateOwnOrderParams', 'Own Order Updated id = ' + ownOrder.id, {
      propsUpdated: propsUpdated,
      params: newProps,
      order: ownOrder,
    });

    return isUpdated;
  }

  _updateOwnOrder = async (order) => {
    let ownOrder = this.getOrderById(order.clientOrderId);
    if (ownOrder === undefined) {
      return;
    }

    if (this.orderLastTimeUpdated < order.timestamp) {
      this.orderLastTimeUpdated = order.timestamp;
    }

    //TODO определить пареметы изменения в ордерах которые влекут изменение позиции
    //filled - частичное исполнение ордера возможно не делать его вообще

    let isUpdatePositions = false;
    if (ownOrder.status === 'closed') {
      //маркет ордер возврашает open хотя должен close
      errorOnce('ob:updateOwnOrderA', 'ownOrder.status already closed', { ownOrder: ownOrder, order: order });
      return ownOrder;
    }

    if (order.status === 'closed') {
      this.volume += order.amount * close();
    }

    this._updateOwnOrderProps(ownOrder, order);

    this._ordersById.set(ownOrder.id, ownOrder);

    if (ownOrder.status === 'open') {
      await this.linkStopOrder(ownOrder); // link stop order to owner order
    }

    if (ownOrder.status === 'closed') {
      await this.createStopOrders(ownOrder); // create stop orders
      await this.cancelStopOrders(ownOrder); // one of stop executed
      let posSide = 'both';
      if (ownOrder.reduceOnly) {
        if (this.isHedged) {
          posSide = ownOrder.side === 'buy' ? 'short' : 'long';
        }
        await this.onClosePosition(this.getPosSlot(posSide), ownOrder);
      } else {
        if (this.isHedged) {
          posSide = ownOrder.side === 'buy' ? 'long' : 'short';
        }
        //TODO: manual - function should be declared like arrow function onClosePosition = async (ownPos, ownOrder) => {}
        // wrong declaration - async onClosePosition(ownPos, ownOrder) {}
        await this.onOpenPosition(this.getPosSlot(posSide), ownOrder);
      }
    }
  };

  onOpenPosition = async (ownPos, ownOrder) => {
    //  this.log('ob:onOpenPosition', 'Position Opened', { ownPos: ownPos });

    if (this.onOpenPositionCallBack) {
      this.onOpenPositionCallBack(ownPos, ownOrder);
    }
  };

  onClosePosition = async (ownPos, ownOrder) => {
    // this.log('ob:onPositionOpen', 'Position closed', { ownPos: ownPos });

    if (this.onClosePositionCallBack) {
      this.onClosePositionCallBack(ownPos, ownOrder);
    }
  };

  // linkStopOrder() fill Dictionary stopOrdersByOwnerId with stop orders id by ownerId
  // stopOrdersByOwnerId[ownerId] = {sl: slId, tp: tpId}
  linkStopOrder(stopOrder) {
    if (stopOrder.isStop === false) {
      return;
    }
    let ownerOrder = this.getOrderById(stopOrder.ownerId); // ownerOrder has SL and TP

    if (ownerOrder) {
      if (stopOrder.stopType === 'sl') {
        this._updateOwnOrderProps(ownerOrder, { slId: stopOrder.id });
      } else {
        this._updateOwnOrderProps(ownerOrder, { tpId: stopOrder.id });
      }
    } else {
      error('ob:linkStopOrder', 'Error ownerOrder not exist id ' + stopOrder.ownerId, { stopOrder: stopOrder });
    }

    if (this._stopOrdersByOwnerId[stopOrder.ownerId] === undefined) {
      this._stopOrdersByOwnerId[stopOrder.ownerId] = {};
    }

    this._stopOrdersByOwnerId[stopOrder.ownerId][stopOrder.stopType] = stopOrder.id;
    this.log('ob:linkStopOrder', 'Stop Order id = ' + stopOrder.id + ' linked to ' + stopOrder.ownerId, {
      stopOrdersByOwnerId: this._stopOrdersByOwnerId[stopOrder.ownerId],
    });
  }
  cancelStopOrders = async (ownOrder) => {
    if (ownOrder.isStop !== true || ownOrder.reduceOnly !== true) {
      return;
    }

    let typeToCancel = ownOrder.stopType === 'sl' ? 'tp' : 'sl';
    let idToCancel = this._stopOrdersByOwnerId[ownOrder.ownerId][typeToCancel];

    let orderToCancel = this.getOrderById(idToCancel);

    if (orderToCancel && orderToCancel.status === 'open') {
      await this.cancelOrder(orderToCancel.id);
      this.log('ob:cancelStopOrders', orderToCancel.stopType + ' canceled ', {
        ownOrder: ownOrder,
        orderToCancel: orderToCancel,
      });
    }
  };

  createStopOrders = async (ownOrder) => {
    if (ownOrder.status !== 'closed' || ownOrder.isStop !== false || ownOrder.reduceOnly === true) {
      return;
    }

    this.log('ob:createStopOrders', '=========== createStopOrders ===========', { ownOrder: ownOrder });

    let tpSide = ownOrder.side === 'buy' ? 'sell' : 'buy';
    let slSide = ownOrder.side === 'buy' ? 'sell' : 'buy';

    let params = {};
    if (ownOrder.tp > 0) {
      params.isStop = true;
      params.stopType = 'tp';
      params.ownerId = ownOrder.id;

      await this._createOrder('limit', tpSide, ownOrder.amount, ownOrder.tp, params);
    }

    if (ownOrder.sl > 0) {
      params.isStop = true;
      params.stopType = 'sl';

      params.ownerId = ownOrder.id;
      params.stopPrice = ownOrder.sl; // TODO stopPrice -> triggerPrice
      await this._createOrder('limit', slSide, ownOrder.amount, ownOrder.sl, params);
    }
    if (ownOrder.sl > 0 || ownOrder.tp > 0) {
      this.log('ob:createStopOrders', 'Stop orders created id = ' + ownOrder.id, {
        price: ownOrder.price,
        sl: ownOrder.sl,
        tp: ownOrder.tp,
      });
    }
  };

  cancelOrder = async (ownId, params = {}) => {
    let order = undefined;

    let ownOrder = this.getOrderById(ownId);
    if (ownOrder === undefined) {
      error('ob:cancelOrder', 'Error order not exist ', { ownId: ownId, ownOrder: ownOrder });
      return;
    }
    //TODO проверить сценарий на реальной бирже и прокинуть в тестер
    let id = ownOrder.realId;
    this.log('ob:cancelOrder', `Cancel order id(${id})`, { orderId: id, ownId: ownId });

    order = await cancelOrder(ownOrder.realId, this.symbol);

    return order;
  };
  cancelAllOrders = async () => {
    this.log('ob:cancelAllOrders', '', '');
    let ownOrders = this.getOpenOrders();
    if (ownOrders.length === 0) {
      return;
    }
    for (let ownOrder of ownOrders) {
      try {
        if (ownOrder.status === 'open') {
          await this.cancelOrder(ownOrder.id, { comment: 'cancelAllOrders' });
        }
      } catch (e) {
        error('ob:cancelAllOrders', 'Error cancel order', { msg: e.message, ownOrder: ownOrders });
      }
    }
  };

  getOpenOrders = () => {
    let orders = [];
    for (let [key, order] of this._ordersById) {
      if (order.status === 'open') {
        orders.push(order);
      }
    }
    return orders;
  };

  historyCollectedLastTime = 0;
  historyCollector = async (forceAll = false) => {
    if (currentTime() - this.historyCollectedLastTime < 7 * 24 * 60 * 60 * 1000) {
      return false;
    }
    this.historyCollectedLastTime = currentTime();

    let cntOrders = 0;

    for (let [key, order] of this._ordersById) {
      if (order.timestamp > currentTime() - 7 * 24 * 60 * 60 * 1000) {
        // 7 days
        continue;
      }
      if (order.status === 'closed' || order.status === 'expired' || order.status === 'canceled') {
        this._historyOrdersById.set(key, order);
        this._ordersById.delete(key);
        cntOrders++;
      } else {
        this._historyOrdersById.set(key, null);
      }
    }

    this.log('ob:historyCollector', '', { cntOrders: cntOrders });
    return true;
  };

  getAllOrders = () => {
    //ordersById and historyOrdersById
    let orders = [];
    for (let [key, order] of this._historyOrdersById) {
      if (order) {
        orders.push(order);
      } else {
        orders.push(this._ordersById.get(key));
      }
    }
    for (let [key, order] of this._ordersById) {
      if (this._historyOrdersById.has(key) === false) {
        orders.push(order);
      }
    }
    this.log('ob:getAllOrders', `${orders.length} orders`);
    return orders;
  };

  getProfit = () => {
    if (this.isHedged) {
      return this.getPosSlot('long').profit + this.getPosSlot('short').profit;
    } else {
      return this.getPosSlot('both').profit;
    }
  };

  getDrawdown = () => {
    let drawdown = 0;
    let posSlot;
    if (this.isHedged) {
      posSlot = this.getPosSlot('short');
      drawdown = shortProfit(posSlot.entryPrice, close(), posSlot.size);

      posSlot = this.getPosSlot('long');
      drawdown += longProfit(posSlot.entryPrice, close(), posSlot.size);
    } else {
      posSlot = this.getPosSlot('both');
      if (posSlot.side === 'long') {
        drawdown = longProfit(posSlot.entryPrice, close(), posSlot.size);
      }
      if (posSlot.side === 'short') {
        drawdown = shortProfit(posSlot.entryPrice, close(), posSlot.size);
      }
    }

    return drawdown;
  };
}
