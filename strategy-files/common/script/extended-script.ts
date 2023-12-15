import { global } from '../global';
import { timeToString } from '../utils/date-time';
import { error, log } from '../log';
import { EventsEmitter } from '../events/events-emitter';
import { Triggers } from '../events/triggers';
import { Exchange } from '../exchange/exchange';
import { Report } from '../report/report';

/**
 * This is a base class for all strategies with extended functionality.
 * works for both tester and live trading.
 * Strategy class should be extended from this class.

 */
export class ExtendedScript implements BaseScriptInterface {
  exchange: string; //required
  symbol: string; //required
  interval: string; // if set  - onTimer will be called every interval instead of onTick

  tickIsLocked: boolean;
  args: GlobalARGS;
  iterator = 0;
  hedgeMode: boolean;
  timeframe: number;

  constructor(args: GlobalARGS) {
    this.args = args;
    this.tickIsLocked = false;

    this.symbol = args.symbol;

    if (!args.symbol) {
      throw new Error('symbol is not defined');
    }

    // if (!args.exchange) {
    //   throw new Error('exchange is not defined');
    // }

    this.hedgeMode = args.hedgeMode === 'true';

    global.strategy = this;

    global.events = new EventsEmitter();

    global.triggers = new Triggers();

    global.report = new Report();

    global.exchange = new Exchange({ hedgeMode: this.hedgeMode, symbol: this.symbol, exchange: args.exchange });
  }

  isInitialized = false;

  init = async () => {
    if (this.isInitialized) {
      //TODO init should be called only once
      error('ExtendedScript:init', 'Script is already initialized');
      return;
    }

    try {
      this.isInitialized = true;
      await this.onInit();
      await global.events.emit('onInit');
    } catch (e) {
      await this.runOnError(e);
    }

    log('ExtendedScript:init', 'Script initialized', this.args, true);
  };

  runOnTick = async (data: Tick[]) => {
    // TODO  if (this.tickIsLocked) return; move this to tester engine
    if (this.tickIsLocked) return;

    this.tickIsLocked = true;
    try {
      this.iterator++;

      await this.onBeforeTick(data);
      await global.events.emit('onBeforeTick', data);
      await this.onTick(data);
      await global.events.emit('onTick', data);
      await this.onAfterTick(data);
      await global.events.emit('onAfterTick', data);
      this.iterator++;
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this.tickIsLocked = false;
    }
  };

  runTickEnded = async (data: Tick[]) => {
    try {
      //this.onTickEnded(data);
      void global.events.emit('onTickEnded', data);
    } catch (e) {
      await this.runOnError(e);
    }
  };

  runOnTimer = async () => {
    if (this.tickIsLocked) return;

    this.tickIsLocked = true;
    try {
      this.iterator++;
      await this.onTimer();
      await global.events.emit('onTimer');
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this.tickIsLocked = false;
    }
  };

  runOnOrderChange = async (orders: Order[]) => {
    try {
      for (const order of orders) {
        if (isTester() && order.timestamp > 0) {
          //TODO order.datetime should be set in tester
          order.datetime = timeToString(order.timestamp);
        }
        await this.onOrderChange(order);
        await global.events.emit('onOrderChange', order);
      }
    } catch (e) {
      await this.runOnError(e);
    }
  };

  runOnError = async (e: any) => {
    try {
      await this.onError(e);
    } catch (e2) {
      throw e2;
    }
    throw e;
  };

  runArgsUpdate = async (args: GlobalARGS) => {
    try {
      this.args = { ...args };
      await this.onArgsUpdate(args);
      await global.events.emit('onArgsUpdate', args);
    } catch (e) {
      await this.runOnError(e);
    }
  };

  onTimer = async () => {
    // throw new Error('"onTimer" method implementation required');
  };

  onOrderChange = async (order: Order) => {
    //throw new Error('"onOrderChange" method implementation required');
  };

  onArgsUpdate = async (args: GlobalARGS) => {
    //throw new Error('"onArgsUpdate" method implementation required');
  };

  onError = async (e: any): Promise<never | void> => {
    throw e;
  };

  run = async () => {
    try {
      await this.onRun();

      await global.events.emit('onRun');
    } catch (e) {
      await this.runOnError(e);
    }
  };

  stop = async () => {
    try {
      await global.events.emit('onBeforeStop');
      await global.events.emit('onStop');
      await this.onStop();
      await global.events.emit('onAfterStop');
    } catch (e) {
      await this.runOnError(e);
    }
  };

  onStop = async () => {};

  onRun = async () => {};
  onInit = async () => {};

  onBeforeTick = async (data: Tick[]) => {};
  onTick = async (data: Tick[]) => {};
  onAfterTick = async (data: Tick[]) => {};
}
