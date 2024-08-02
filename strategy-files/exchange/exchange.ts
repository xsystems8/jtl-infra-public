import { BaseObject } from '../base-object';
import {
  CreateTriggerOrderByTaskParams,
  ExchangeParams,
  StopOrderData,
  StopOrderQueueItem,
  TriggerType,
} from './types';
import { BaseError } from '../Errors';
import { TriggerService } from '../events';
import { error, log, logOnce } from '../log';
import { getArgNumber, uniqueId } from '../base';
import { global } from '../global';

export class Exchange extends BaseObject {
  readonly triggerService = new TriggerService({ idPrefix: 'ExchangeTriggerService' });
  readonly symbol: string;

  private readonly exchange: string;
  private readonly leverage: number = 50;
  private readonly hedgeMode: boolean = false;
  private readonly triggerType: TriggerType = 'script';
  private readonly ordersByClientId = new Map<string, Order>();
  private readonly stopOrdersByOwnerShortId = new Map<string, StopOrderData>();
  private readonly stopOrdersQueue = new Map<string, StopOrderQueueItem>();

  private prefix: string;
  private symbolInfo: SymbolInfo;
  private maxLeverage: number;
  private contractSize: number;
  private minContractBase: number;
  private minContractQuoted: number;
  private minContractStep: number;

  private nextOrderId = 0;

  isInit = false;

  constructor(params: ExchangeParams) {
    super(params);

    if (!params.exchange || params.exchange === '') {
      throw new BaseError('Exchange::constructor Argument {exchange} is not defined', params);
    }

    if (!params.symbol || params.symbol === '') {
      throw new BaseError('Exchange::constructor Argument {symbol} is not defined', params);
    }

    this.triggerType = params.triggerType;
    this.exchange = params.exchange;
    this.symbol = params.symbol;
    this.leverage = params.leverage ?? 50;
    this.hedgeMode = params.hedgeMode ?? false;

    this.setPrefix(params.prefix);

    //This will work only if exchange created before script onInit event
    //in case exchange created in real time, need to call init function manually
    global.events.subscribe('onInit', this.init, this);

    global.events.subscribeOnOrderChange(this.onOrderChange, this, this.symbol);

    this.triggerService.registerPriceHandler(params.symbol, 'executeStopLoss', this.createTriggerOrderByTask, this);
    this.triggerService.registerPriceHandler(params.symbol, 'executeTakeProfit', this.createTriggerOrderByTask, this);
    this.triggerService.registerPriceHandler(params.symbol, 'executeTriggerOrder', this.createTriggerOrderByTask, this);
  }

  async init() {
    this.symbolInfo = await symbolInfo(this.symbol);

    if (!isTester()) {
      logOnce('Exchange::init ' + this.symbol, 'symbolInfo', this.symbolInfo);

      if (!this.symbolInfo) {
        throw new BaseError('Exchange::init symbolInfo is not defined for symbol ' + this.symbol, {
          symbol: this.symbol,
        });
      }
    } else {
      //TODO update symbol info for futures in tester (then delete code below)
      this.symbolInfo['limits']['amount']['min'] = 0.00001;

      if (this.exchange.includes('binance')) {
        this.symbolInfo['limits']['cost']['min'] = 5;
      }
      this.maxLeverage = getArgNumber('defaultLeverage', 100);
    }

    if (!this.symbolInfo?.limits?.amount?.min) {
      throw new BaseError('Exchange::init min amount is not defined for symbol ' + this.symbol, {
        symbolInfo: this.symbolInfo,
      });
    }

    if (this.symbolInfo.limits?.cost?.min) {
      this.minContractBase = this.symbolInfo.limits.cost.min / this.close();
      this.minContractQuoted = this.symbolInfo.limits.cost.min;
    } else {
      this.minContractQuoted = this.symbolInfo.limits.amount.min * this.close();
      this.minContractBase = this.symbolInfo.limits.amount.min;
    }

    this.contractSize = this.symbolInfo.contractSize ?? 1;
    this.minContractStep = this.symbolInfo.limits.amount.min;

    if (this.leverage > this.maxLeverage) {
      throw new BaseError('Exchange:init leverage (' + this.leverage + ') is high for symbol ' + this.symbol, {
        symbol: this.symbol,
        leverage: this.leverage,
        maxLeverage: this.maxLeverage,
      });
    }

    if (!isTester()) {
      try {
        const response = await setLeverage(this.leverage, this.symbol);
        log('Exchange:init', 'setLeverage ' + this.leverage + ' ' + this.symbol, { response });
      } catch (e) {
        // bybit returns error if leverage already set, unfortunately there is no way to check leverage before set.
        if (e.message.includes('Set leverage not modified') && e.message.includes('bybit')) {
          log('Exchange:init', 'setLeverage ' + this.leverage + ' ' + this.symbol, {
            message:
              'bybit returns error if leverage already set, unfortunately there is no way to check leverage before set.',
          });
        } else {
          throw new BaseError('Exchange:init ' + e.message, { e });
        }
      }
    }

    log('Exchange::init', '', {
      symbol: this.symbol,
      leverage: this.leverage,
      maxLeverage: this.maxLeverage,
      contractSize: this.contractSize,
      minContractQuoted: this.minContractQuoted,
      minContractStep: this.minContractStep,
    });

    this.isInit = true;
  }

  setPrefix(prefix?: string) {
    if (this.prefix) {
      // warning('Exchange::setPrefix', 'Prefix has been change ');
    }

    this.prefix = prefix ?? uniqueId(4);
    log('Exchange::setPrefix', 'Prefix set to ' + this.prefix);
  }

  getPrefix() {
    return this.prefix;
  }

  /**
   * Create market buy order
   * @param amount - order amount
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  async buyMarket(amount: number, tp?: number, sl?: number, params = {}): Promise<Order> {
    return this.createOrder('market', 'buy', amount, 0, { ...params, tp, sl });
  }

  /**
   * Create market sell order
   * @param amount - order amount
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  async sellMarket(amount: number, tp?: number, sl?: number, params = {}): Promise<Order> {
    return this.createOrder('market', 'sell', amount, 0, { ...params, tp, sl });
  }

  /**
   * Create limit buy order
   * @param amount - order amount
   * @param limitPrice - order execution price
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  async buyLimit(amount: number, limitPrice: number, tp?: number, sl?: number, params = {}): Promise<Order> {
    return this.createOrder('limit', 'buy', amount, limitPrice, { ...params, tp, sl });
  }

  /**
   * Create limit sell order
   * @param amount - order amount
   * @param limitPrice - order execution price
   * @param sl - stop loss price if sl = 0, stop loss order will not be created
   * @param tp - take profit price if tp = 0, take profit order will not be created
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   *
   */
  async sellLimit(amount: number, limitPrice: number, tp?: number, sl?: number, params = {}): Promise<Order> {
    return this.createOrder('limit', 'sell', amount, limitPrice, { ...params, tp, sl });
  }

  /**
   * Create order on exchange
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price -  order price
   * @param params - if params['sl'] or params['tp'] set, stop orders will be created automatically by this order.
   * @returns {Promise<Order>}
   */
  async createOrder(
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    params: Record<string, unknown>,
  ): Promise<Order> {
    const args = { type, side, amount, price, params };

    if (!this.isInit) throw new BaseError('Exchange::createOrder - exchange not initialized', args);
    if (amount <= 0) throw new BaseError('Exchange::createOrder amount must be > 0', args);
    if (!['sell', 'buy'].includes(side)) throw new BaseError('Exchange::createOrder side must be buy or sell', args);

    if (this.hedgeMode) {
      params['positionSide'] = side === 'buy' ? 'long' : 'short';

      if (params['reduceOnly']) {
        params['positionSide'] = side === 'buy' ? 'short' : 'long';
      }
    }

    params['leverage'] = params['leverage'] ?? this.leverage;

    const clientOrderId = this.generateClientOrderId(
      this.prefix,
      type,
      !!params['reduceOnly'] ?? false,
      params['ownerShortId'] as string,
    );

    params.clientOrderId = clientOrderId;

    // If stop orders params set, save it to stopOrdersQueue then this params will be used in onOrderChange function
    // stop orders will be created when owner order executed (status = 'closed')
    if (params['sl'] || params['tp']) {
      this.stopOrdersQueue.set(clientOrderId, {
        ownerOrderId: clientOrderId,
        sl: params['sl'] as number,
        tp: params['tp'] as number,
        prefix: this.prefix,
      });

      log('Exchange::createOrder', 'Stop orders params saved', this.stopOrdersQueue[clientOrderId]);
    }

    const triggerPrice = params.triggerPrice || params.stopLossPrice || params.takeProfitPrice;

    if (triggerPrice && this.triggerType === 'script') {
      const orderParams = {
        type,
        side,
        amount,
        price,
        params: { prefix: this.prefix, reduceOnly: params.reduceOnly, ownerShortId: params.ownerShortId },
      };

      let taskId: string;
      let taskName: string;

      if (params.stopLossPrice) {
        taskName = 'executeStopLoss';
      }
      if (params.takeProfitPrice) {
        taskName = 'executeTakeProfit';
      }
      if (params.triggerPrice) {
        taskName = 'executeTriggerOrder';
      }

      taskId = this.triggerService.addTaskByPrice({
        name: taskName,
        triggerPrice: triggerPrice as number,
        symbol: this.symbol,
        ...(params.ownerShortId && { group: params.ownerShortId as string }),
        args: orderParams,
      });

      log('Exchange::createOrder', 'Trigger price task added', {
        taskId,
        triggerOrdersParams: args,
        options: {
          id: params.clientOrderId,
          group: params.ownerShortId,
        },
        params,
      });

      return { clientOrderId, id: null } as Order;
    }

    const { orderParams, userParams } = this.validateParams(params);
    const marketInfo = { lastPrice: this.close(), ask: this.ask(), bid: this.bid() };

    let order: Order;

    try {
      order = await createOrder(this.symbol, type, side, amount, price, orderParams);

      this.ordersByClientId.set(clientOrderId, order);
    } catch (e) {
      throw new BaseError(e.message, {
        marketInfo: marketInfo,
        orderParams: orderParams,
        userParams: userParams,
        args: args,
        e,
      });
    }

    if (!order.id) {
      error('Exchange::createOrder', 'Order not created', {
        marketInfo: marketInfo,
        order: order,
        params: params,
        args: args,
        orderParams: orderParams,
        userParams: userParams,
      });

      return order;
    }

    log('Exchange::createOrder', `[${this.symbol}] Order created`, {
      marketInfo,
      args,
      orderParams,
      userParams,
      order,
    });

    return order;
  }

  /**
   * Modify order by id (change price, amount)
   * @param orderId - order id
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price -  order price
   * @returns {Promise<Order>}
   */
  async modifyOrder(orderId: string, type: OrderType, side: OrderSide, amount: number, price: number): Promise<Order> {
    const args = { orderId, symbol: this.symbol, type, side, amount, price };

    try {
      const order = await modifyOrder(orderId, this.symbol, type, side, amount, price);

      log('Exchange::modifyOrder', 'Order modified', {
        args,
        order,
        before: this.ordersByClientId.get(orderId) ?? null,
      });

      return order;
    } catch (e) {
      throw new BaseError(e.message, { e, ...args, order: this.ordersByClientId.get(orderId) });
    }
  }

  /**
   * Cancel order by id
   * @param orderId - order id
   * @returns {Promise<Order>}
   */
  async cancelOrder(orderId: string): Promise<Order> {
    try {
      const order = await cancelOrder(orderId, this.symbol);

      if (isTester()) {
        const order = await getOrder(orderId);
        if (order.status !== 'canceled' && order.status !== 'closed') {
          error('Exchange:cancelOrder ', 'Order not canceled', {
            orderId,
            symbol: this.symbol,
            order,
          });

          return;
        }
      }

      log('Exchange:cancelOrder', 'Order canceled', { orderId, symbol: this.symbol });

      return order;
    } catch (e) {
      throw new BaseError(e.message, { e, orderId, symbol: this.symbol });
    }
  }

  /**
   * Create take profit order (close position)
   * @param sideToClose - 'buy' or 'sell' - side of order to close @note: (if you want to close buy order, you need pass 'buy' to this param so stop loss order will be sell order)
   * @param amount - order amount
   * @param takeProfitPrice - trigger price (take profit price)
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  async createTakeProfitOrder(
    sideToClose: OrderSide,
    amount: number,
    takeProfitPrice: number,
    params = {},
  ): Promise<Order> {
    const side: OrderSide = sideToClose === 'buy' ? 'sell' : 'buy';

    return this.createOrder('market', side, amount, takeProfitPrice, {
      ...params,
      takeProfitPrice,
      reduceOnly: true,
    });
  }

  /**
   * Create stop loss order (close position)
   * @param sideToClose - 'buy' or 'sell' - side of order to close @note: (if you want to close buy order, you need pass 'buy' to this param so stop loss order will be sell order)
   * @param amount  - order amount
   * @param stopLossPrice - trigger price (stop loss price)
   * @param params - params for createOrder function (see createOrder function)
   * @note - stop loss order could be only market type
   * @returns {Promise<Order>}
   */
  async createStopLossOrder(
    sideToClose: OrderSide,
    amount: number,
    stopLossPrice: number,
    params = {},
  ): Promise<Order> {
    const side: OrderSide = sideToClose === 'buy' ? 'sell' : 'buy';

    return this.createOrder('market', side, amount, stopLossPrice, {
      ...params,
      stopLossPrice,
      reduceOnly: true,
    });
  }

  // ------------- Triggered orders ----------------
  // note: This function uses our own library for working with trigger orders.
  // It is important to note that these orders are not placed directly into the exchange's order book. Instead, they are stored locally
  // and are activated only when the market price reaches the specified trigger price.
  // Once activated, the corresponding order (market or limit) is sent to the exchange for execution.
  /**
   * Creates a trigger order (market or limit) that is sent to the exchange when the price reaches the specified trigger price.
   * @param type - 'market' or 'limit'
   * @param side - 'buy' or 'sell'
   * @param amount - order amount
   * @param price - order price (used only for limit orders)
   * @param triggerPrice - trigger price
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<void>}
   */
  async createTriggeredOrder(
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    triggerPrice: number,
    params = {},
  ): Promise<Order> {
    return this.createOrder(type, side, amount, price, { ...params, triggerPrice });
  }

  /**
   * Create reduce only order (close position)
   * @param type - 'market' or 'limit'
   * @param sideToClose - 'buy' | 'sell' | 'long | 'short
   * @param amount - order amount
   * @param price -  order price
   * @param params - params for createOrder function (see createOrder function)
   * @returns {Promise<Order>}
   */
  createReduceOrder = async (
    type: OrderType,
    sideToClose: OrderSide | 'long' | 'short',
    amount: number,
    price: number,
    params = {},
  ): Promise<Order> => {
    let side: OrderSide;
    if (sideToClose === 'buy' || sideToClose === 'long') side = 'sell';
    if (sideToClose === 'sell' || sideToClose === 'short') side = 'buy';
    return await this.createOrder(type, side, amount, price, { ...params, reduceOnly: true });
  };

  async getPositionBySide(side: OrderSide | 'short' | 'long') {
    if (!['buy', 'sell', 'long', 'short'].includes(side)) {
      throw new BaseError(`Exchange::getPositionBySide`, `wrong position side: ${side}`);
    }

    if (side === 'sell') side = 'short';
    if (side === 'buy') side = 'long';

    const positions = await this.getPositions();

    return positions.filter((position) => position.side === side)?.[0];
  }

  async getPositions() {
    return getPositions([this.symbol]);
  }

  private async onOrderChange(order: Order) {
    const { prefix, shortClientId, ownerShortId } = this.parseClientOrderId(order.clientOrderId);

    if (prefix !== this.prefix) return;

    this.ordersByClientId.set(order.clientOrderId, order);

    const stopOrders = this.stopOrdersByOwnerShortId.get(ownerShortId);

    // cancel stop orders if one of them is fulfilled.
    if (order.status === 'closed' && !!stopOrders) {
      const { slOrderId, tpOrderId } = stopOrders;

      if (order.id === slOrderId) {
        await this.cancelOrder(tpOrderId);
      }

      if (order.id === tpOrderId) {
        await this.cancelOrder(slOrderId);
      }
    }

    // cancel stop orders if main order is canceled
    if (order.status === 'canceled' && !!stopOrders) {
      const { slOrderId, tpOrderId } = stopOrders;
      if (slOrderId) {
        await this.cancelOrder(slOrderId);
      }

      if (tpOrderId) {
        await this.cancelOrder(tpOrderId);
      }
    }

    const stopOrderQueue = this.stopOrdersQueue.get(order.clientOrderId);

    if (order.status === 'closed' && !!stopOrderQueue) {
      await this.createSlTpOrders(order.clientOrderId, stopOrderQueue.sl, stopOrderQueue.tp);
    }

    log('Exchange::onOrderChange', '', { order, prefix, ownerShortId, shortClientId });
  }

  private async createSlTpOrders(ownerClientOrderId: string, sl?: number, tp?: number) {
    if (!sl && !tp) return;

    const orderToClose = this.ordersByClientId.get(ownerClientOrderId);

    if (!orderToClose || orderToClose.status !== 'closed') return;

    const { ownerShortId } = this.parseClientOrderId(ownerClientOrderId);

    let slOrder: Order;
    let tpOrder: Order;

    if (sl) {
      slOrder = await this.createStopLossOrder(orderToClose.side as OrderSide, orderToClose.amount, sl, {
        ownerShortId,
        prefix: this.prefix,
      });

      log('Exchange::createSlTpByOwnerOrder', 'Stop loss order created ', {
        order: slOrder,
        ownerShortId: ownerShortId,
        prefix: this.prefix,
      });
    }

    if (tp) {
      tpOrder = await this.createTakeProfitOrder(orderToClose.side as OrderSide, orderToClose.amount, tp, {
        ownerShortId,
        prefix: this.prefix,
      });

      log('Exchange::createSlTpByOwnerOrder', 'Take profit order created ', {
        order: slOrder,
        ownerShortId: ownerShortId,
        prefix: this.prefix,
      });
    }

    this.stopOrdersByOwnerShortId.set(ownerShortId, {
      slOrderId: slOrder?.id,
      tpOrderId: tpOrder?.id,
      ownerOrderClientId: ownerClientOrderId,
    });

    return { slOrder, tpOrder };
  }

  private createTriggerOrderByTask(taskParams: CreateTriggerOrderByTaskParams) {
    const { type, side, amount, params, price } = taskParams;

    log('Exchange::createOrderByTriggers', '', { orderParams: taskParams });

    return this.createOrder(type, side, amount, price, params);
  }

  private generateClientOrderId(prefix: string, type: OrderType, isReduce = false, ownerShortId?: string) {
    let idPrefix = type === 'market' ? 'M' : 'L';

    if (isReduce) {
      idPrefix = ownerShortId ? 'S' : 'R';
    }

    let id = `${tms()}-${prefix}-${idPrefix}${this.nextOrderId++}`;

    if (ownerShortId) id = `${id}-${ownerShortId}`;

    if (this.exchange === 'gateio') id = `t-${id}`;

    return id;
  }

  private parseClientOrderId(clientOrderId: string) {
    const split = clientOrderId.split('-');

    if (this.exchange === 'gateio') {
      split.shift();
    }

    return {
      uniquePrefix: split[0] ?? null,
      prefix: split[1] ?? null,
      shortClientId: split[2] ?? null,
      ownerShortId: split[3] ?? null,
      clientOrderId: clientOrderId,
    };
  }

  private validateParams(params: Record<string, unknown>) {
    const orderParams = {};
    const userParams = {};

    const allowed = {
      positionSide: this.hedgeMode && this.exchange.includes('binance'),
      positionIdx: this.exchange === 'bybit' && this.hedgeMode,
      timeInForce: true,
      leverage: true,
      clientOrderId: true,
      stopPrice: true,
      triggerPrice: true,
      reduceOnly: true, // TODO check  - binance generate error if reduceOnly = true and stopPrice or triggerPrice set
      takeProfitPrice: true,
      stopLossPrice: true,
    };

    if (this.hedgeMode) {
      if (this.exchange.includes('binance')) {
        allowed['reduceOnly'] = false;
      }
      if (this.exchange === 'bybit') {
        params['positionIdx'] = params['positionSide'] === 'long' ? '1' : '2';
      }
    }

    for (let key in params) {
      if (allowed[key]) {
        orderParams[key] = params[key];
      } else {
        userParams[key] = params[key];
      }
    }

    log('Exchange::validateParams', '', { params, result: orderParams });

    return { orderParams, userParams };
  }

  getContractsAmount = (usdAmount: number, executionPrice?: number) => {
    if (!executionPrice) {
      executionPrice = this.close();
    }
    //contractSize = 10 xrp
    // log('Exchange::getContactsAmount', '', { usdAmount, executionPrice, contractSize: this.contractSize }, true);
    // 1 xrp = 0.5 usd   1 contract = 10 xrp = 5 usd
    return usdAmount / executionPrice / this.contractSize; // 100 / 0.5 / 10 = 20
  };

  getUsdAmount = (contractsAmount: number, executionPrice?: number) => {
    if (!executionPrice) {
      executionPrice = this.close();
    }

    //contractSize = 10 xrp
    // xrp = 0.5 usd   1 contract = 10 xrp = 5 usd

    return contractsAmount * executionPrice * this.contractSize; // 1*0.5*10 = 5
  };

  ask() {
    return ask(this.symbol)?.[0];
  }

  askVolume() {
    return ask(this.symbol)?.[1];
  }

  bid() {
    return bid(this.symbol)?.[0];
  }

  bidVolume() {
    return bid(this.symbol)?.[1];
  }

  high() {
    return high(this.symbol);
  }

  low() {
    return low(this.symbol);
  }

  open() {
    return open(this.symbol);
  }

  close() {
    return close(this.symbol);
  }

  volume() {
    return volume(this.symbol);
  }

  unsubscribe() {
    global.events.unsubscribeByObjectId(this.id);
    this.triggerService.cancelAll();
  }
}
