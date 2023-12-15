import { Report } from './common/report/report';

import { Storage } from './common/storage';

import { ExtendedScript } from './common/script/extended-script';
import { global } from './common/global';
import { currentTimeString } from './common/utils/date-time';
import { error, log, trace } from './common/log';
import { SeparatePositions } from './common/exchange/separate-positions';

class Strategy extends ExtendedScript {
  version = '1.0.13';
  sp;
  storageKey = '';
  params = {};
  // hedgeMode =  true;

  constructor(args) {
    super(args);

    let params = args;
    this.params = args;
    //  {"name":"Strategy move back real" }
    trace('constructor()', 'params', { args: args });
    this.size_usd = 10;
    this.exchange = 'binanceusdm-testnet';
    this.symbol = 'BTC/USDT:USDT';
    this.iterator = 0;
    info({ exchange: this.exchange, symbol: this.symbol, args: args, isTester: isTester() });

    this.sp = new SeparatePositions({
      idPrefix: 'test',
      symbol: this.symbol,
      exchange: this.exchange,
      hedgeMode: this.hedgeMode,
    });

    this.storageKey = 'sp.' + this.symbol + this.exchange + this.hedgeMode;
    this.usdSize = Number(params.usdSize ?? 10);

    info({ version: this.version, usdSize: this.usdSize });
  }

  iteratorX = 1;
  onArgsUpdate = async (args) => {
    if (args.open === '11') {
      // let execPrice = close() * 0.6;
      // let size = this.getSize(execPrice);
      // await this.sp.buyLimit(size, execPrice, 0, 0, { comment: 'testing open' });
      // info('--------buyLimit-------');
    }
    let maxId = 0;

    if (args.cmd === 'echo') {
      this.iteratorX++;
      info({ msg: 'onArgsUpdate ' + this.iteratorX, args });
    }

    let order = {};
    if (args.cmd === 'open') {
      let execPrice = close() * 0.6;
      let size = this.getSize(execPrice);
      size = 10;
      //  await this.sp.buyMarket(size, 0, 0, { comment: 'testing open' });
      await this.sp.buyLimit(size, execPrice, 0, 0, { comment: 'testing open' });
      info('--------buyLimit-------');
    }
    if (args.cmd === 'close') {
      let execPrice = close() * 0.6;

      //  this.sp.createOrder('market', 'buy', 20, 0, { comment: 'testing close', reduceOnly: true });
    }
    if (args.cmd === 'store') {
      await this.storeState();
    }

    if (args.cmd === 'restore') {
      await this.restoreState();
    }
    if (args.cmd === 'init') {
      log('init', '💾 SeparatePositions state is initialized');
      let orders = await getOrders();

      orders.forEach((order) => {
        //clientOrderId: "test.O0"
        let orderId = order.clientOrderId.split('.')[1]; // O0, C1, O2
        if (orderId) {
          const intId = parseInt(orderId.replace(/\D/g, ''));
          maxId = Math.max(maxId, intId);
        }
      });
      info({ msg: 'maxId', maxId: maxId });
    }

    if (args.cmd === 'openOrder') {
      let size = this.getSize(close() * 0.7);

      await this.sp.buyLimit(size, close() * 0.7, 0, 0, { comment: 'testing open' });
    }
  };

  storeState = async () => {
    try {
      let storage = new Storage();

      await storage.storeState(this.storageKey, this);

      _report.tableUpdate('Scrypt info', {
        id: 'restoreState',
        updated: currentTimeString(),
        info: await storage.loadState(this.storageKey),
      });
    } catch (e) {
      error('storeState()', 'Error = ' + e.message);
    }
  };

  restoreState = async () => {
    try {
      let storage = new Storage([], [SeparatePositions]);

      await storage.restoreState(this.storageKey, this);

      global.strategy = this;
      global.sp = this.sp;

      _report.tableUpdate('Scrypt info', {
        id: 'restoreState',
        updated: currentTimeString(),
        info: await storage.loadState(this.storageKey),
      });
    } catch (e) {
      error('restoreState()', 'Error = ' + e.message);
    }
  };

  onError = async (e) => {
    error('onError', 'onError ' + e.message, { e: e });
  };

  onRun = async () => {
    await this.sp.init();

    let res = await setCache('test', 'test 4567567578678');
    info('cache set res:' + res);
    info('cache test:' + (await getCache('test')));

    await this.restoreState();
    await _report.updateReport({ isLog: 1, isTrace: 1 });

    info({ aks: ask(), bid: bid(), close: close(), open: open(), markPrice: close() });
    info('-------Started!');
  };

  onStop = async () => {
    await this.storeState();
    await _report.updateReport({ isLog: 1, isTrace: 1 });

    log('stop', '💾 SeparatePositions state is saved');
    info('-------Stopped!');
  };

  log = async () => {
    const error = new Error();
    info(error.stack);
  };

  onOrderChange = async (data) => {
    info('--------onOrderChange -------');
    info({ orders: data });

    await this.sp.onOrderChange(data);
  };

  onBeforeTick = async () => {
    if (this.isStop) return false;
    this.iterator = ++global.iterator;

    if (!isTester()) {
      if (this.iterator < 5) {
        info(`Start in ${5 - this.iterator} ticks`);
        return false;
      }
    }
    return true;
  };

  //===========================================================================
  //==============================  onTick  ==================================
  //===========================================================================

  onTick = async (data) => {
    if (this.iterator < 5) {
      return;
    }

    _report.cardSetValue('Close', close());
    _report.cardSetValue('Open', open());
    _report.cardSetValue('Time', currentTimeString());
  };

  onAfterTick = async () => {
    await this.monitoring();
  };

  monitoring = async () => {
    if (this.iterator % 10 !== 0) {
      return;
    }

    //    _report.cardSetValue('Ask', ask());
    //  _report.cardSetValue('Bid', bid());
    //
    // symbolInfo().then((data) => {
    //   _report.tableUpdate('Scrypt info', {
    //     id: 'SeparatePositions --- ',
    //     updated: currentDateStr(),
    //     info: this.sp.getState(),
    //   });
    // });

    if (this.iterator === 10) {
      // info('Start to collect info ');
      // symbolInfo().then((data) => {
      //   _report.tableUpdate('Scrypt info', { id: 'symbolInfo', updated: currentDateStr(), info: data });
      // });
      // fetchOrders().then((data) => {
      //   _report.tableUpdate('Scrypt info', { id: 'fetchOrders', updated: currentDateStr(), info: data });
      // });
      // fetchPositions().then((data) => {
      //   _report.tableUpdate('Scrypt info', { id: 'fetchPositions', updated: currentDateStr(), info: data });
      // });
    }

    await _report.updateReport({ isLog: 1, isTrace: 1 });

    if (isTester()) {
      ko();
    }
  };

  getSize = (execution_price) => {
    return this.size_usd / execution_price;
  };
  axiosTest = async () => {
    // ko();
    axios({
      method: 'GET',
      url: 'https://www.binance.com/api/v3/ticker/price?symbol=BNBBTC',
    })
      .then(function (response) {
        info({ msg: 'axios response', data: response.data });
      })
      .catch(function (error) {
        // handle error
        info('axios error--------------', error);
      })
      .finally(function () {
        info('----------------------');
        info('        Finally');
        info('----------------------');
      });
  };
  tests = async () => {
    if (1 && this.iterator % 5 == 0) {
      _debugVars('close', close());
      _debugVars('open', open());
      _debugVars('random_1_100', Math.round(Math.random() * 100));
      if (this.iterator % 20 === 0 || this.iterator === 1) {
        info({
          comment: 'monitoring',
          iterator: this.iterator,
          close: close(),
          close_dada: data.close,
          dVars: global.debugVars['close'].value,
        });
        _debugVars('high', high());
        _debugVars('low', low());
      }
      try {
        this.dataMonitor.storeRealtimeDataToStorage();
      } catch (e) {
        error('ontick', e.message);
      }
    }
    if (this.iterator === 3) {
      let execution_price = close();

      //   let sl = this.sl_percent !== 0 ? execution_price * (1 - this.sl_percent / 100) : 0;

      let tp = execution_price * 1.1;

      let size = this.getSize(execution_price);
      await this.sp.buyMarket(size, 0, tp, { comment: 'testing open' });
    }

    if (this.iterator === 1 && false) {
      try {
        await this.axiosTest();
      } catch (e) {
        info({ comment: 'fetchBalance', iterator: this.iterator, error: e.message });
      }
    }

    if (false && this.iterator === 20) {
      info('--------createOrder-------');

      let order_params = {
        clientOrderId: 'runtimeTestJs',
        positionSide: 'long',
        reduceOnly: false,
      };
      let order;
      try {
        order = await createOrder('limit', 'buy', 60, 0.35, order_params);
      } catch (e) {
        info({ comment: 'createOrder', iterator: this.iterator, error: e.message });
      }
      info({ comment: 'createOrder', iterator: this.iterator, order: order });
    }

    if (this.iterator === 40 && false) {
      info('--------cancelOrder-------');
      let id = '36436765410';
      let order = await cancelOrder(id, this.symbol);
      info({ comment: 'cancelOrder', iterator: this.iterator, order: order });
    }

    if (this.iterator === 30 && false) {
      info('--------fetchOrders-------');
      let orders = await getOrders();
      info({ comment: 'fetchOrders', iterator: this.iterator, orders: orders });
    }

    if (this.iterator === 10 && false) {
      info('--------fetchPositions-------');
      let positions = await getPositions();
      info({ comment: 'Positions', iterator: this.iterator, positions: positions });
    }
  };
}
