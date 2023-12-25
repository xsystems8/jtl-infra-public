declare global {
  /// <reference path="order.interface.ts" />
  /// <reference path="position.interface.ts" />
  /// <reference path="report.interface.ts" />
  /// <reference path="symbol.interface.ts" />
  /// <reference path="tick.interface.ts" />
  /// <reference path="candle.interface.ts" />


  type GlobalARGS = {
    startDate: Date;
    endDate: Date;
    symbol: string;
    timeframe: string;
  } & Record<string, string | number | boolean>;

  const ARGS: GlobalARGS;

  type Tick = TickTypes.Tick;
  type Order = OrderTypes.Order;
  type OrderType = OrderTypes.OrderType;
  type OrderSide = OrderTypes.OrderSide;

  type Candle = CandleTypes.Candle;

  type ReportData = ReportTypes.ReportData;
  type TableDataReportBlock = ReportTypes.TableDataReportBlock;
  type CardDataReportBlock = ReportTypes.CardDataReportBlock;
  type ChartDataReportBlock = ReportTypes.ChartDataReportBlock;
  type TVChartDataReportBlock = ReportTypes.TVChartDataReportBlock;
  type OptimizerResultsReportBlock = ReportTypes.OptimizerResultsReportBlock;

  type Position = PositionTypes.Position;

  type SymbolInfo = SymbolTypes.Symbol;

  enum ReportBlockType {
    TRADING_VIEW_CHART = 'trading_view_chart',
    DRAWDOWN_CHART = 'drawdown_chart',
    TABLE = 'table',
    CHART = 'chart',
    CARD = 'card',
  }

  /**
   * BaseScriptInterface - base script interface for all scripts (tester, live, optimizer)
   * @abstract - abstract class
   * @property {GlobalARGS} args - script arguments (startDate, endDate, symbol, timeframe) and other custom arguments provided by user
   * @property {number} timeframe - candle timeframe
   * @property {string} exchange - exchange name required for live
   * @property {string} symbol - symbol name required
   * @property {string} interval - interval for timer. If it set in script used onTimer() method instead of onTick()
   *
   */
  abstract class BaseScriptInterface {
    protected constructor(args: GlobalARGS);

    args: GlobalARGS;
    timeframe: number;
    exchange: string;
    symbol: string;
    interval: string;
    iterator: number;

    init: () => Promise<void>;
    runOnTick: (data: Tick[]) => Promise<void> | void;
    runTickEnded: (data: Tick[]) => Promise<void> | void;
    runOnTimer: () => Promise<void> | void;
    runOnOrderChange: (data: Order[]) => Promise<void> | void;
    runOnError: (e: any) => Promise<void | never> | never | void;
    runArgsUpdate: (args: GlobalARGS) => Promise<void> | void;
    onTick: (data: Tick[]) => Promise<void> | void;
    onTimer: () => Promise<void> | void;
    onOrderChange: (order: Order) => Promise<void> | void;
    onArgsUpdate: (args: GlobalARGS) => Promise<void> | void;
    onError: (e: any) => Promise<void | never> | never | void;
    run: () => Promise<void> | void;
    stop: () => Promise<void> | void | never;
  }

  //-------environment functions-----------------
  /**
   * getArtifactsKey - return artifact key for current script. It used to store report data in artifacts storage.
   * @returns {string} - artifact key
   * @example:
   * let artifactsKey = getArtifactsKey();
   * let reportUrl = "https://env1.jtnodes.one/report/" + artifactsKey ;
   */
  function getArtifactsKey(): string;

  /**
   * registerCallback - register callback for trading functions (only for developer mode)
   * @param funcName - function name (createOrder, cancelOrder, modifyOrder, getOrders, getPositions, getBalance)
   * @param callback - callback function (async only)
   */
  function registerCallback(funcName: string, callback: (...args: any[]) => void): void;

  /**
   * isTester - return true if current script is running in tester
   * @returns {boolean}
   * @example:
   * if (isTester()) {
   * // do something only for tester
   * }
   */
  function isTester(): boolean;

  function getErrorTrace(stack: string): Promise<string>;

  /**
   * updateReport - update report for current script; Max update frequency 1 time per second. Max report size 1MB
   * !important: avoid calling in the loops without interval execution control (for , onTick, onTimer - especially in tester)
   * @see Report class for more details @link ./report.md
   * @param data - report data blocks [charts, tables, cards, trading view charts, optimization results]
   * @returns {Promise<void>}
   *
   */
  function updateReport(data: ReportData): Promise<void>;

  function setCache(key: string, value: any): Promise<void>;

  /**
   * getCache - return cache value
   * @param key - cache key
   * */
  function getCache<T>(key: string): Promise<T>;

  /**
   * getPrefix - return prefix of the current script scenario
   * prefix is used when order is created in clientOrderId = {prefix + "." +  user clientOrderId provided in params}
   * if user not provide clientOrderId in params it will be generated automatically as {prefix + "." +  hash of timestamp}
   * @returns {string}
   */
  function getPrefix(): string;

  //--------Market Data functions-----------------

  //TODO create function getAvailableSymbols() and getAvailableTimeframes()
  /**
   * getSymbolInfo - return symbol info object
   * @param symbol - symbol name spot (BTC/USDT) or futures (BTC/USDT:USDT)
   * @returns {Promise<SymbolInfo>}
   */
  function symbolInfo(symbol: string): Promise<SymbolInfo>;

  /**
   * tsm - return timestamp of the current candle
   * @returns {number}
   */
  function tms(): number;

  /**
   *open  - return open price of the current candle
   * @returns {number}
   */
  function open(): number;

  /**
   * high  - return high price of the current candle
   * @returns {number}
   */
  function high(): number;

  /**
   * volume - return volume of the current candle
   * @returns {number}
   */
  function low(): number;

  /**
   * close - return the current price of the current candle
   * @returns {number}
   */
  function close(): number;

  /**
   * getFee  - return fee for all executed orders for current script (only for tester)
   * @returns {number}
   * @example:
   * let fee = getFee();
   * console.log("Fee " + fee);
   */
  function getFee(): number;

  /**
   * ask - return ask price (first price from order book) for current symbol
   * @returns {number}
   * @example:
   * let askPrice = ask();
   * console.log("Ask price " + askPrice);
   */
  function ask(): number;

  /**
   * bid - return bid price (first price from order book) for current symbol
   * @returns {number}
   * @example:
   * let bidPrice = bid();
   * console.log("Bid price " + bidPrice);
   */
  function bid(): number;

  //---------------------- Trading functions ----------------------------

  /**
   * getPositions - return array of positions for current script
   * @returns {Promise<Position[]>}
   * @example:
   * let positions = await getPositions();
   * for (let position of positions) {
   *  console.log("Symbol " + position.symbol + " size " + position.contracts + " entryPrice " + position.entryPrice);
   * }
   *
   */
  function getPositions(): Promise<Position[]>;

  /**
   * getBalance  - return balance for current script
   * @returns {Promise<{total: {USDT: number}, used: {USDT: number}, free: {USDT: number}}>}
   * @example:
   * let balance = await getBalance();
   * console.log("Free balance " + balance.free.USDT);
   */
  function getBalance(): Promise<{
    total: { USDT: number; [coin: string]: number };
    used: { USDT: number; [coin: string]: number };
    free: { USDT: number; [coin: string]: number };
  }>;

  /**
   * getOrders - return array of orders for symbol
   * @param symbol - symbol name spot (BTC/USDT) or futures (BTC/USDT:USDT)
   * @param since - start time of the orders (timestamp)
   * @param limit - limit of the orders
   * @returns {Promise<Order[]>}
   * @example:
   * let orders = await getOrders('BTC/USDT', 0, 10);
   * for (let order of orders) {
   *  // do something
   * }
   */
  function getOrders(symbol: string, since?: number, limit?: number): Promise<Order[]>;

  /**
   * getOrder - return order by id for symbol
   * @param id - order id
   * @param symbol - symbol name (required for some exchanges)
   */
  function getOrder(id: string, symbol: string): Promise<Order>;

  /**
   * getProfit  - return profit for all closed positions for current script (only for tester)
   * @returns {number}
   */
  function getProfit(): Promise<number>;

  /** getHistory - return array of candles
   *  @param timeframe - candle timeframe
   *  @param startTime - start time of the candles
   *  @param limit - limit of the candles
   */
  function getHistory(timeframe: number, startTime: number, limit?: number);

  /**
   * createOrder - create order and return order object or reject object with error message
   * @param symbol - order symbol
   * @param type - order type (limit, market)
   * @param side - order side (buy, sell)
   * @param amount - order amount (quantity) in base currency (BTC/USDT - amount in BTC, ETH/USDT - amount in ETH)
   * @param price - order price (for limit order)
   * @param params - additional params
   * @returns {Promise<Order>}
   *
   * @example:
   * // create market order - execute immediately
   * let order = await createOrder('BTC/USDT', 'market', 'buy', 0.01, 10000, {});
   *
   * //create stop loss order
   * let sl = await createOrder('BTC/USDT', 'market', 'sell', 0.01, 9000, {stopLossPrice: 9000, reduceOnly: true});
   *
   * //create take profit order
   * let tp = await createOrder('BTC/USDT', 'market', 'sell', 0.01, 11000, {takeProfitPrice: 11000, reduceOnly: true});
   * //!important: stop loss or take profit order must be canceled if one of them is executed
   * //take see class Exchange to automate this process
   *
   */
  function createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    params: Record<string, unknown>,
  ): Promise<Order>;

  /**
   * cancelOrder - cancel order and return order object or reject object with error message
   * @param id - order id
   * @param symbol - order symbol
   * @returns {Promise<Order>}
   */
  function cancelOrder(id: string, symbol: string): Promise<Order>;

  /**
   * modifyOrder - modify order and return order object or reject object with error message
   * @param id - order id
   * @param symbol - order symbol
   * @param type - order type (limit, market)
   * @param side - order side (buy, sell)
   * @param amount - order amount (quantity) in base currency (BTC/USDT - amount in BTC, ETH/USDT - amount in ETH)
   * @param price - order price (for limit order)
   * @param params - additional params (reduceOnly, postOnly, timeInForce...)
   * @returns {Promise<Order>}
   *
   * @example:
   * // modify order
   * let order = await modifyOrder('5203624294025367390',BTC/USDT:USDT', 'limit', 'buy', 0.01, 10000);
   */
  function modifyOrder(
    id: string,
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price: number,
    params: Record<string, unknown>,
  ): Promise<Order>;
}

export {};
