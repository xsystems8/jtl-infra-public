import { ExtendedScript } from './common/script/extended-script';
import { global } from './common/global';
import { error, log, trace } from './common/log';
import { currentTime, currentTimeString } from './common/utils/date-time';

class Strategy extends ExtendedScript {
  version = '1.0.20';
  storageKey = '';
  hedgeMode = true;
  private sizeUsd: any;
  private doNumber: number;
  private order: Order;

  constructor(params: GlobalARGS) {
    super(params);

    this.sizeUsd = params.sizeUsd ?? 10;
    this.exchange = params.exchange ? String(params.exchange) : 'binanceusdm'; // binanceusdm-testnet, binanceusdm

    this.symbol = params.symbol;

    if (this.exchange === 'binanceusdm-testnet') {
      this.hedgeMode = false;
    }
    //TODO в боевых сценариях тоже нужно передавать hedgeMode
    this.doNumber = Number(params.doNumber ?? 0);
    global.report.setDescription(`Api results   ${this.exchange} ${this.symbol}  hedgeMode = ${this.hedgeMode}`);

    registerCallback('createOrder', this.onCallback);

    this.storageKey = 'api.responses.' + this.exchange;

    // let prevData = getCache(this.storageKey);
    //
    // if (prevData) {
    //   prevData = JSON.parse(prevData);
    //   globals.report.tableUpdate('Previous results', prevData);
    // }
  }

  onInit = async () => {
    //  await this.callApiOneByOne(1);

    await global.report.updateReport();
  };

  onCallback = async (...args) => {
    trace('onCallback', 'onCallback', { args: args });
    await global.report.updateReport();
  };
  tableApi = [];
  orders = [];
  orderId = '';

  callApiOneByOne = async (n) => {
    let table = this.tableApi;
    let result: any;
    let params = {};
    let triggerPrice, stopPrice;

    let price = close() * 0.9;
    let sl = price * 0.8;
    let tp = price * 1.2;
    let amount = this.sizeUsd / price; // 10 usd

    if (n === 1) {
      await this.tableInsert({ method: 'getBalance', result: await getBalance() });
    }
    if (n === 2) await this.tableInsert({ method: 'symbolInfo', result: await symbolInfo(this.symbol) });

    //create order limit
    if (n === 3) {
      trace('callApiOneByOne', 'createOrder', { price: price, amount: amount });

      result = await global.exchange.createOrder('', 'limit', 'buy', amount, price, params);
      this.orderId = result.id;

      await this.tableInsert({
        method: `createOrder - limit`,
        result: result,
        params: { price: price, amount: amount, params: params },
      });
    }

    //create market with SL/TP

    if (n === 4) {
      params = { sl: sl, tp: tp };
      amount = this.sizeUsd / close();
      sl = close() * 0.8;
      tp = close() * 1.2;

      // result = await global.exchange.createOrder(0, 'market', 'buy', amount, 0, params);
      //
      // this.orderId = result.id;
      // await this.tableInsert({
      //   method: `createOrder - market sl/tp`,
      //   result: result,
      //   params: { price: price, amount: amount, params: params },
      // });

      trace('callApiOneByOne', 'createOrder SL TP', { amount: amount, sl: sl, tp: tp });
      result = await global.exchange.createStopLossOrder('', 'market', 'buy', amount, sl, {});
      await this.tableInsert({
        method: `createStopLossOrder`,
        result: result,
        params: { price: price, amount: amount, params: params },
      });

      result = await global.exchange.createTakeProfitOrder('', 'market', 'buy', amount, tp, {});
      await this.tableInsert({
        method: `createTakeProfitOrder`,
        result: result,
        params: { price: price, amount: amount, params: params },
      });
    }

    if (n === 7) {
      result = await getPositions();
      await this.tableInsert({ method: 'getPositions', result: result });
    }

    //get orders
    if (n === 40) {
      result = await getOrders(this.symbol, currentTime() - 1000 * 60 * 60 * 24);
      await this.tableInsert({ method: 'getOrders', result: result });
      if (result.length > 0) this.orderId = result[0].id;
    }

    //get order
    if (n === 50) {
      result = await getOrder(this.orderId);
      await this.tableInsert({ method: 'getOrder', result: result, params: { orderId: this.orderId } });
    }
    // modify order
    if (n === 60) {
      price = close() * 1.5;
      amount = this.sizeUsd / price;
      result = global.exchange.sellLimit(this.symbol, amount, price);

      price = close() * 1.6;
      amount = this.sizeUsd / price;

      result = global.exchange.modifyOrder(this.orderId, this.symbol, 'limit', 'sell', amount, price, {});
      await this.tableInsert({
        method: 'modifyOrder',
        result: result,
        params: { orderId: this.orderId, price: price * 1.01, amount: amount },
      });
    }

    // cancel order this.orderId taken from onOrderChange
    if (n === 80) {
      if (!this.orderId) {
        await this.callApiOneByOne(3);
      }
      result = await cancelOrder(this.orderId, this.symbol);
      await this.tableInsert({ method: 'cancelOrder', result: result });
    }

    if (n === 90) await this.tableInsert({ method: 'getBalance', result: await getBalance() });

    if (n === 100) {
      await this.tableInsert({ method: 'getHistory', result: await getHistory('1m', tms() - 11 * 60 * 100, 10) });
    }

    if (n === 110) {
      let candle = { d: currentTimeString(), h: high(), l: low(), o: open(), c: close(), t: tms() };
      await this.tableInsert({ method: 'candle', result: candle });

      //   await this.tableInsert({ method: 'volume', result: volume() });
    }
  };

  tableInsert = async (row) => {
    row.result = row.result ?? '';
    row.params = row.params ?? '';
    row.comment = row.comment ?? '';

    if (row.result.info) delete row.result.info;
    if (Array.isArray(row.result))
      row.result = row.result.map((r) => {
        if (r.info) delete r.info;
        return r;
      });

    this.tableApi.push(row);
    global.report.tableUpdate('Api results', row);

    console.log(this.iterator + ' | -------------------- ' + row.method + ' - done ', { result: row.result });
    await global.report.updateReport();

    //let result = await setCache(JSON.stringify(this.tableApi), this.storageKey);
  };

  onTick = async (data) => {
    if (this.iterator === 1) {
      console.log('price of ' + this.symbol + ' = ' + close());
    }
    if (this.iterator % 5 === 0) {
      await global.report.updateReport();
    }
    return;
    if (this.doNumber > 0) return;

    if (this.iterator > 15) {
      return;
    }
    await this.callApiOneByOne(this.iterator);
  };

  onArgsUpdate = async (params) => {
    this.doNumber = Number(params.doNumber ?? 0);
    await this.callApiOneByOne(this.doNumber);
  };

  onError = async (e) => {
    error('onError', 'onError ' + e.message, { e: e });
    global.report.updateReport();
  };

  onStop = async () => {
    await global.report.updateReport();

    info('-------Stopped!');
  };

  log = async () => {
    const error = new Error();
    console.log(error.stack);
  };

  onOrderChange = async (order) => {
    this.order = order;
    this.orders.push(order);

    await this.tableInsert({
      method: 'onOrderChange ' + order.clientOrderId,
      result: order,
      params: { clientOrderId: order.clientOrderId },
    });
  };

  getSize = (execution_price) => {
    return this.sizeUsd / execution_price;
  };
}
