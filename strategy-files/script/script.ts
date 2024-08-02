import { global } from '../global';
import { error, log, warning } from '../log';
import { EventEmitter, TriggerService } from '../events';
import { Report } from '../report';
import { BaseObject } from '../base-object';
import { Storage } from '../storage';
import { currentTime } from '../utils/date-time';
import { getArgBoolean, getArgString } from '../base';
import { BaseError } from '../Errors';

/**
 * This is a base class for all strategies with extended functionality.
 * works for both tester and live trading.
 * Strategy class should be extended from this class.
 */
export class Script extends BaseObject implements BaseScriptInterface {
  exchange: string; //required
  symbols: string[] = []; //required
  symbol: string;
  interval: string; // if set  - onTimer will be called every interval instead of onTick
  args: GlobalARGS;
  iterator = 0;
  hedgeMode: boolean;
  timeframe: number;
  version = 1;

  balanceTotal: number;
  balanceFree: number;

  constructor(args: GlobalARGS) {
    super(args);
    this.args = args;

    // if (!args.symbol) {
    //   throw new Error('symbol is not defined');
    // }

    log(
      'ExtendedScript:constructor',
      '===========================Constructor(' + this.version + ')===========================',
      { args },
      true,
    );

    this.exchange = getArgString('exchange', '', true);
    this.hedgeMode = getArgBoolean('hedgeMode', false);

    if (!this.symbols?.length) {
      let symbol = getArgString('symbol', '');
      let symbolsLine = getArgString('symbols', '');

      let symbols = symbolsLine.split(',');

      symbols.forEach((symbol) => {
        if (symbol.includes('/')) {
          this.symbols.push(symbol);
        }
      });

      if (symbol !== '' && this.symbols.length === 0) {
        this.symbols = [symbol];
      }

      if (this.symbols.length === 0) {
        throw new BaseError('ExtendedScript::constructor symbols is not defined');
      }
    }

    const idPrefix = 'Global';
    global.strategy = this;
    global.events = new EventEmitter({ idPrefix });
    global.triggers = new TriggerService({ idPrefix });
    global.report = new Report({ idPrefix });
    global.storage = new Storage({ idPrefix });

    //TODO change report.symbol -> report.name
    global.report.symbol = this.exchange + ': ' + this.symbols.join(',').slice(0, 20);
  }

  isInitialized = false;

  unificationFunctionsByExchange = async () => {
    if (isTester()) {
      return;
    }
    warning(
      'ExtendedScript:unificationFunctionsByExchange',
      '*******THIS METHOD SHOULD BE IN ENVIRONMENT*******',
      {},
      true,
    );

    if (this.args.exchange === 'gateio') {
      ccxt().options['defaultType'] = 'swap';
      ccxt().options['marginMode'] = 'cross';
      //@ts-ignore
      getOrders = async (...args) => {
        let symbol = args[0];
        let since = args[1];
        let limit = args[2] ?? 100;
        let params = typeof args[1] === 'object' ? args[3] : {};
        //BadRequest: gateio {"label":"INVALID_PARAM_VALUE","message":"limit not supported for open orders list"}

        //@ts-ignore
        let openOrders = (await ccxt().fetchOpenOrders(symbol, since, undefined, params)) ?? [];
        log('Strategy::getOrders', 'ccxt().fetchOpenOrders', { args: args, openOrders: openOrders });
        if (openOrders && limit) {
          limit = limit - openOrders?.length ?? 0;
        }
        if (limit > 0) {
          //@ts-ignore
          let closeOrders = await ccxt().fetchClosedOrders(symbol, since, limit, params);
          log('Strategy::getOrders', 'ccxt().fetchClosedOrders', { args: args, closeOrders: closeOrders });

          return [...openOrders, ...closeOrders];
        }
        return openOrders;
      };
    }

    if (this.args.exchange === 'bybit') {
      //@ts-ignore
      ccxt().options['defaultType'] = 'swap';
      ccxt().options['marginMode'] = 'cross';
      //@ts-ignore
      getOrders = async (...args) => {
        //@ts-ignore
        let symbol = args[0];
        let since = args[1];
        let limit = args[2];
        let params = typeof args[1] === 'object' ? args[3] : {};
        //BadRequest: bybit fetchOrders() requires until/endTime when since is provided.
        params['endTime'] = params['endTime'] ?? currentTime();
        //@ts-ignore
        let orders = await ccxt().fetchOrders(symbol, since, limit, params);
        log('Strategy::getOrders', 'ccxt().getOrders', { args: args, orders: orders });
        return orders;
      };

      //leverage -  возможно стоит пробросить эту функцию в api
      // let responce;
      // for (let symbol of this.symbols) {
      //   try {
      //     responce = await ccxt().setLeverage(48, symbol);
      //   } catch (e) {
      //     error('Strategy::unificationFunctionsByExchange', 'ccxt().setLeverage', { symbol: symbol, e: e });
      //   }
      //
      //   log('Strategy::unificationFunctionsByExchange', 'ccxt().setLeverage', { responce: responce });
      // }
      // log('Strategy::unificationFunctionsByExchange', '******* setLeverage *******', { symbols: this.symbols }, true);
      //
      // responce = await ccxt().setPositionMode(false);
      // log('Strategy::unificationFunctionsByExchange', 'ccxt().setPositionMode', { responce: responce });
    }
  };
  init = async () => {
    //TODO: this should be done by environment
    await this.unificationFunctionsByExchange();

    try {
      let balanceInfo = await getBalance();
      this.balanceTotal = balanceInfo.total.USDT;
      this.balanceFree = balanceInfo.free.USDT;
    } catch (e) {
      throw new BaseError('ExtendedScript:init getBalance error', { e: e });
    } finally {
      this.isInitialized = false;
    }
    log(
      'ExtendedScript:init',
      'init info',
      {
        balanceTotal: this.balanceTotal,
        balanceFree: this.balanceFree,
        symbols: this.symbols,
        hedgeMode: this.hedgeMode,
        args: ARGS,
      },
      true,
    );
    try {
      this.isInitialized = true;
      await this.onInit();
      await global.events.emit('onInit');
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this.isInitialized = false;
    }
  };

  _isTickLocked = false;
  async runOnTick() {
    if (this._isTickLocked) {
      return;
    }
    if (this.isStop) {
      forceStop();
      forceStopA(); //TODO: remove after -> она нужна тк forceStop не рализована в тестовом окружении
    }
    this._isTickLocked = true;
    try {
      await this.onBeforeTick();
      await global.events.emit('onBeforeTick');
      await this.onTick();
      //TODO: onTick - for 1 symbol, возможно стоит избавится от этого метода
      await global.events.emit('onTick');
      //emit for special symbol
      await global.events.emitOnTick(); //
      await this.onAfterTick();
      await global.events.emit('onAfterTick');
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this._isTickLocked = false;
      this.iterator++;
    }
  }

  isStop = false;
  forceStop(reason: string) {
    error('ExtendedScript:forceStop', reason, {}, true);
    this.isStop = true;
  }

  runTickEnded = async (data: Tick[]) => {
    try {
      //this.onTickEnded(data);
      void global.events.emit('onTickEnded', data);
    } catch (e) {
      await this.runOnError(e);
    }
  };

  runOnTimer = async () => {
    try {
      this.iterator++;
      await this.onTimer();
      await global.events.emit('onTimer');
    } catch (e) {
      await this.runOnError(e);
    }
  };

  runOnOrderChange = async (orders: Order[]) => {
    // log('ExtendedScript:runOnOrderChange', 'orders', orders, true);
    try {
      for (const order of orders) {
        await this.onOrderChange(order);
        await global.events.emitOnOrderChange(order); // emit for special symbol
        await global.events.emit('onOrderChange', order); //for all symbols
      }
    } catch (e) {
      await this.runOnError(e);
    }
  };

  runOnError = async (e: any) => {
    // if (e.costructor.name !== 'BaseError') {
    //   error('runOnError', 'Error = ' + e.message + '  ---- ' + e.constructor.name, { e: e });
    //   ///|| e.constructor.name === 'ReferenceError'
    //   // throw e;
    // }
    //console.log('we update it 7934ryr90');
    // throw new BaseError(e, { internalStack: e.stack });

    // if (e.message.includes('is not defined')) {
    //   await global.report.updateReport();

    // }

    error('runOnError', 'Error = ' + e.message + '  ---- ' + e.constructor.name, { e: e });
  };

  runArgsUpdate = async (args: GlobalARGS) => {
    try {
      this.args = { ...args };
      await this.onArgsUpdate(args);
      await global.events.emit('onArgsUpdate', args);
      if (args.isTradeAllowed !== undefined) {
        global.isTradeAllowed = args.isTradeAllowed === 'true';
        await global.events.emit('onTradeAllowed', { isTradeAllowed: global.isTradeAllowed });
      }
    } catch (e) {
      await this.runOnError(e);
    }
  };

  onError = async (e: any): Promise<never | void> => {
    throw e;
  };

  run = async () => {
    try {
      await global.events.emit('onRun');
    } catch (e) {
      await this.runOnError(e);
    }
  };

  stop = async () => {
    log('ExtendedScript:stop', '===========================Stop===========================', {}, true);
    try {
      await global.events.emit('onBeforeStop');
      await global.events.emit('onStop');
      await this.onStop();
      await global.events.emit('onAfterStop');
    } catch (e) {
      await this.runOnError(e);
    }
  };
  async runOnReportAction(action: string, payload: any) {
    try {
      await this.onReportAction(action, payload);
      await global.events.emit('onReportAction', { action, payload });
    } catch (e) {
      await this.runOnError(e);
    }
  }

  async onReportAction(action: string, payload: any) {}

  async onStop() {}

  async onInit() {}

  async onBeforeTick() {}

  async onTick() {}

  async onAfterTick() {}

  async onOrderChange(order: Order) {}

  async onArgsUpdate(args: GlobalARGS) {}

  async onTimer() {}
}
