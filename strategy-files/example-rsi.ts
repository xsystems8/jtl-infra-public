import { global } from './common/global';
import { ExtendedScript } from './common/script/extended-script';
import { TesterReportPro } from './common/report/layouts/tester.report.pro';
import { debugLog, error, trace } from './common/log';
import { getCandlesBuffer, setCandlesBuffer } from './common/candles-buffer';

import { getRSIValues, rsi } from './common/indicators/rsi';
import { OrdersBasket } from './common/exchange/orders-basket';

class Strategy extends ExtendedScript {
  private rsiPeriod: number;
  private sizeUsd: number;
  private dataCollector: TesterReportPro;
  constructor(params) {
    super(params);

    this.exchange = 'binanceusdm';

    this.hedgeMode = params.hedgeMode === 'true';

    //-------------------  RSI strategy params  -------------------
    this.rsiPeriod = Number(params.rsiPeriod ?? 14);
    if (this.rsiPeriod < 5 || this.rsiPeriod > 30) {
      error('Strategy', 'RSI period must be between 5 and 30');
      this.rsiPeriod = 14;
    }
    this.sizeUsd = Number(params.sizeUsd ?? 100); // size of each order in USD
  }
  onInit = async () => {
    this.dataCollector = new TesterReportPro();
    global.report.setDescription(`Simple RSI strategy | Period ${this.rsiPeriod}, ${this.sizeUsd} USD`);
    global.basket = new OrdersBasket();
    global.basket.init();
    await setCandlesBuffer(this.symbol, '5m');
  };

  //==============================  onTick  ==================================
  onTick = async () => {
    if (global.basket.getOpenOrders().length > 0) {
      return;
    }
    // Cross up 70
    if (rsi(this.symbol, '5m', 14, 1) < 70 && rsi(this.symbol, '5m', 14, 0) > 70) {
      const size = this.sizeUsd / close();
      await global.basket.buyMarket(size, close() * 0.9, close() * 1.1);
    }

    // Cross down 30
    if (rsi(this.symbol, '5m', 14, 1) > 30 && rsi(this.symbol, '5m', 14, 0) < 30) {
      const size = this.sizeUsd / close();
      await global.basket.sellMarket(size, close() * 1.1, close() * 0.9);
    }
  };

  onStop = async () => {
    info('-------------------------------- stop()-------------------------------');

    await global.report.updateReport();
  };

  onError = async (e) => {
    error('onError', 'onError ' + e.message, { e: e });
  };
}
