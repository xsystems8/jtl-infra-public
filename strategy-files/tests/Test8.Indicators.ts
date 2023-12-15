import { Test } from './Test';
import { global } from '../common/global';
import { getCandlesBuffer, setCandlesBuffer } from '../common/candles-buffer';
import { timeToString } from '../common/utils/date-time';
import { getRSIValues, rsi } from '../common/indicators/rsi';
import { debugLog } from '../common/log';
import { convertTimeframeToString } from '../common/utils/timeframe';

export class Test8 extends Test {
  constructor() {
    super();
  }

  timeframe = '5m';
  async onInit() {
    await setCandlesBuffer(global.strategy.symbol, this.timeframe);
    // this.bufferH1 = await getCandlesBuffer(global.strategy.symbol, '1h');
    // _consoleInfo('convertTimeframeToString', convertTimeframeToString('1h'), convertTimeframeToString('1mc') + ' ');
    // _consoleInfo('Class name', this.bufferH1.constructor.name);
    // ko();
  }
  async onTick() {
    global.report.chartAddPointAgg('Rsi', 'rsi 14', rsi(global.strategy.symbol, this.timeframe, 14, 0));
  }

  async onStop() {
    let buf = getCandlesBuffer(global.strategy.symbol, this.timeframe).getCandles();

    for (let i = 0; i < buf.length; i++) {
      buf[i]['date'] = timeToString(buf[i]['timestamp']);
    }

    let rsiValues = getRSIValues(global.strategy.symbol, this.timeframe, 14);

    for (let i = 0; i < rsiValues.length; i++) {
      rsiValues[i]['date'] = timeToString(rsiValues[i]['timestamp']);
    }

    global.report.tableUpdate('CandlesBuffer first 100', buf.slice(0, 100));
    global.report.tableUpdate('CandlesBuffer Last 100', buf.slice(-100));
    global.report.tableUpdate('RSI values first 100', rsiValues.slice(0, 100) as Record<string, any>);
    global.report.tableUpdate('RSI values last 100', rsiValues.slice(-100) as Record<string, any>);

    // global.report.tvChartAddOscillator('CandlesBuffer', 'RSI', buf);
  }
}
