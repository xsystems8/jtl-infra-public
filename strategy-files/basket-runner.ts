import { PerformanceAnalyzer } from './common/tests/performance';
import { TestWatcher } from './common/tests/test.watcher';
import { global } from './common/global';
import { ExtendedScript } from './common/script/extended-script';
import { BasketChanel } from './mmbaskets/basket-chanel';
import { TesterReportStandard } from './common/report/layouts/tester.report.standard';
import { BasketMb } from './mmbaskets/basket-mb';
import { TesterReportPro } from './common/report/layouts/tester.report.pro';
import { BasketMb5 } from './mmbaskets/basket-mb5';
import { currentTime } from './common/utils/date-time';
import { error, log, trace } from './common/log';

class Strategy extends ExtendedScript {
  private readonly params: GlobalARGS;
  private readonly maxBaskets: number;
  private readonly isRestoreState: boolean;
  private dataCollector: TesterReportPro;

  basketClass = BasketMb5; //
  hedgeMode = true;

  version = '5.01.4';

  basketIterator = 0;
  storageKey = '';
  baskets;

  isCreateNewBasket = true;

  constructor(params: GlobalARGS) {
    super(params);

    this.params = params;
    this.exchange = 'binanceusdm';
    this.symbol = params.symbol ?? 'ETH/USDT';
    this.hedgeMode = true;
    this.storageKey = 'mb4-' + getPrefix() + '-' + this.symbol + '-' + this.exchange;

    this.maxBaskets = Number(params.maxBaskets ?? 1);
    this.isRestoreState = params.isRestoreState as boolean ?? false;
  }

  createNewBasket = async () => {
    if (this.isCreateNewBasket && this.nextTimeCreate < currentTime()) {
      await this.createBasket();
      trace('createNewBasket', 'createBasket()', { nextTimeCreate: this.nextTimeCreate });

      this.nextTimeCreate = currentTime() + 60 * 60 * 1000 * 8;

      this.isCreateNewBasket = Object.keys(this.baskets).length < this.maxBaskets;
    }
  };

  //===========================================================================
  //==============================  onTick  ==================================
  //===========================================================================

  nextTimeCreate = 0;
  onTick = async (data) => {
    for (let key in this.baskets) {
      let basket = this.baskets[key];

      if (basket.isToDelete) {
        let cnt = await basket.unsubscribe();
        if (cnt === 0) {
          // breeeeek();
        }
        trace('onTick', 'basket.isToDelete', { basketId: key, cnt: cnt });
        delete this.baskets[key];

        this.nextTimeCreate = currentTime() + 60 * 60 * 1000 * 8;

        this.isCreateNewBasket = true;
      }
    }
  };

  createBasket = async () => {
    global.report.optimizedSetValue('Baskets', 1, 'sum');

    this.basketIterator++;
    let basketId = 'B' + this.basketIterator;

    if (!this.baskets[basketId]) {
      this.baskets[basketId] = new this.basketClass(basketId, this.params);
      this.checkPerformance(this.baskets[basketId], 'basket');
      await this.baskets[basketId].init();
      await this.baskets[basketId].newRound();

      return this.baskets[basketId];
    } else {
      await this.createBasket();
      if (this.basketIterator > 5000) {
        this.stopStrategy('max baskets limit reached in createBasket()');
      }
      error('createBasket', 'basket already exists', { basketId: basketId });
    }
  };

  onStop = async () => {
    info('-------------------------------- stop()-------------------------------');

    trace('stop()', 'args', this.args);

    try {
      for (let key in this.baskets) {
        let basket = this.baskets[key];
        global.report.tableUpdate('Own Orders', basket.getAllOrders());
        break;
      }

      await global.report.updateReport();
      info('stop()', 'report updated');
    } catch (e) {
      error('stop()', 'Error = ' + e.message, { e: e });
    }
  };

  onError = async (e) => {
    error('onError', 'onError ' + e.message, { e: e });
  };

  showInfo = () => {
    if (1) {
      log('showInfo()', `Symbol ${this.symbol}, Exchange ${this.exchange} ` + (this.hedgeMode ? 'hedge' : ''));
    }
  };

  onInit = async () => {
    trace('constructor()', 'onInit --------------!!!!!!');
    global.events.subscribe('onTick', this.createNewBasket, this);

    global.report.optimizedSetValue('I', this.params.optimizerIteration);

    // this.basketClass = BasketChanel; //

    this.baskets = {};

    this.showInfo();
    if (isTester()) {
      this.dataCollector = new TesterReportPro();
    } else {
      //this.dataCollector = new RuntimeReportData();
    }

    let params = this.params;

    params.basketProfit = Number(params.basketProfit ?? 5);
    params.gapPercent = Number(params.gapPercent ?? 0.8);
    params.getSizeType = params.getSizeType ?? 'fixed_usd'; // fixed_coin fixed_usd
    params.hedgeTpPercent = Number(params.hedgeTpPercent ?? 1);
    params.hedgeGapPercent = Number(params.hedgeGapPercent ?? 0.8);
    params.hedgeSlPercent = Number(params.hedgeSlPercent ?? 0);
    params.sizeUsd = Number(params.sizeUsd ?? 100);

    //ROUND
    params.newRoundDistance = Number(params.newRoundDistance ?? 10);
    params.isRandomRound = params.isRandomRound === 'true' || params.isRandomRound === 1;

    if (typeof params.newRoundSide === 'number') {
      params.newRoundSide = params.newRoundSide === 1 ? 'buy' : 'sell';
      params.newRoundSide = params.newRoundSide === 3 ? 'buy/sell' : params.newRoundSide;
    } else {
      params.newRoundSide = params.newRoundSide ?? 'buy/sell';
    }
  };

  checkPerformance = (obj, name) => {
    if (this.performance) {
      this.performance.observeObject(obj, name);
    }
  };

  }
}
