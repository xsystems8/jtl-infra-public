import { timeToString } from '../utils/date-time';

export class BaseScript implements BaseScriptInterface {
  args: GlobalARGS;
  exchange: string;
  symbol: string;
  tickIsLocked: boolean;
  interval: string;
  iterator = 0;
  timeframe = 1;

  constructor(args: GlobalARGS) {
    this.args = args;
    this.tickIsLocked = false;
    this.timeframe = args.timeframe ? parseInt(args.timeframe) : 1;
    this.symbol = args.symbol ?? 'ETH/USDT';
  }

  init = async () => {};

  onTick: (data: Tick[]) => Promise<void> | void;

  runOnTick = async (data: Tick[]) => {
    if (this.tickIsLocked) return;

    this.tickIsLocked = true;
    try {
      this.iterator++;
      await this.onTick(data);
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this.tickIsLocked = false;
    }
  };

  runTickEnded = async (data: Tick[]) => {};

  runOnTimer = async () => {
    if (this.tickIsLocked) return;

    this.tickIsLocked = true;
    try {
      await this.onTimer();
    } catch (e) {
      await this.runOnError(e);
    } finally {
      this.tickIsLocked = false;
    }
  };

  runOnOrderChange = async (orders: Order[]) => {
    try {
      for (const order of orders) {
        await this.onOrderChange(order);
      }
    } catch (e) {
      await this.runOnError(e);
    }
  };

  runOnError = async (e: any) => {
    try {
      const stack = await getErrorTrace(e.stack);
      // Передавать e в onError тк можно проверить класс и принять решение
      await this.onError({ message: e.message, stack });
    } catch (e2) {
      throw e2;
    }
    throw e;
  };

  runArgsUpdate = async (args: GlobalARGS) => {
    try {
      this.args = { ...args };
      await this.onArgsUpdate(args);
    } catch (e) {
      await this.runOnError(e);
    }
  };

  onTimer = async () => {};

  onOrderChange = async (order: Order) => {};

  onArgsUpdate = async (args: GlobalARGS) => {};

  onError = async (e: any) => {};

  run = () => {};

  stop = () => {};
}
