import { PerformanceAnalyzer } from './common/tests/performance';
import { ExtendedScript } from './common/script/extended-script';
import { global } from './common/global';
import { TestWatcher } from './common/tests/test.watcher';
import { TesterReportStandard } from './common/report/layouts/tester.report.standard';
import { Test0 } from './tests/Test0';
import { Test1 } from './tests/Test1';
import { Test2 } from './tests/Test2.perfomance';
import { Test3 } from './tests/Test3.triggers';
import { Test4 } from './tests/Test4.random';
import { Test5 } from './tests/Test5.market';
import { Test6 } from './tests/Test6.limit';
import { Test8 } from './tests/Test8.Indicators';
import { Test7 } from './tests/Test7-api';
import { error, trace } from './common/log';
import { TesterReportPro } from './common/report/layouts/tester.report.pro';

class Strategy extends ExtendedScript {
  hedgeMode: boolean = true;
  version = '2.0.3';
  description = '';
  private spread: number;
  private testNumber: number;
  private test: any;
  private watcher: TestWatcher;
  private testerReport: any;
  private performance: PerformanceAnalyzer;

  constructor(params: GlobalARGS) {
    console.log('---------------------RUN TESTS-----------------------');
    super(params);

    this.exchange = 'binance';
    this.symbol = params.symbol ?? 'ETH/USDT';
    this.hedgeMode = params.hedgeMode === 'true';
    this.spread = params.spread ? Number(params.spresd) : 0.0001; //0.0001

    let tests = [Test0, Test1, Test2, Test3, Test4, Test5, Test6, Test7, Test8]; // classes

    let testNumber = (this.testNumber = params.testNumber ? Number(params.testNumber) : 4);
    this.test = new tests[testNumber]();

    trace('constructor()', 'params', params);
    trace('constructor()', 'ARGS', ARGS);
    trace('constructor()', 'testNumber is ' + testNumber);
  }

  onTick = async () => {
    if (this.iterator === 1) {
      await getOrders(this.symbol);
    }
    await this.test.onTick();
  };

  onOrderChange = async (order) => {
    //  ko66();
    trace('onOrderChange()', order.id, order);
  };

  onError = async (e) => {
    console.log('==================== onError() ====================');

    error('onError', 'error = ' + e.message, { e: e });
  };

  onInit = async () => {
    trace('onInit()', 'args', this.args);

    this.test.onInit();

    // this.performance = new PerformanceAnalyzer();
    // this.checkPerformance(this, 'strategy');
    // this.checkPerformance(globals.report, 'report');
    // this.checkPerformance(global.basket, 'basket');

    // this.performance.observeFunction(_log);
    // this.performance.observeFunction(_error);
    // this.performance.observeFunction(_trace);

    this.watcher = new TestWatcher();
    await this.watcher.init();
    this.testerReport = new TesterReportPro();
  };

  checkPerformance = (obj, name) => {
    if (this.performance) {
      if (typeof obj === 'object' && obj) {
        this.performance.observeObject(obj, name);
      }
    }
  };

  onStop = async () => {
    console.log('==================== onStop() ====================');
    await this.test.onStop();

    await this.prepareReport();
    await global.report.updateReport();
  };

  prepareReport = async () => {
    if (0) {
      global.report.tableUpdate('Positions', await getPositions());
    }
  };
}
