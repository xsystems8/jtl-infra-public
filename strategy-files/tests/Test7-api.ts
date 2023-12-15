import { Test } from './Test';

import { global } from '../common/global';

import { debugLog } from '../common/log';
import { timeToString } from '../common/utils/date-time';

export class Test7 extends Test {
  onInit() {}

  async onTick() {
    await super.onTick();

    if (this.iterator === 1) {
      let order = await global.basket.buyMarket(0.01);
      debugLog('order 900', order);
    }
  }

  getHistoryError = async () => {
    let timeStart = ARGS.startDate.getTime();
    let history = await getHistory('1m', timeStart, 5);

    debugLog('onInit', 'timeStart', timeStart);
    debugLog('onInit', 'timeStartHuman', timeToString(timeStart));
    debugLog('onInit', 'history', history);
  };

  getHistory = async () => {
    // let timeStart = 1609447200000 + 59 * 1440 * 60 * 1000; // 2020-12-31 20:40:00  ARGS.startDate.getTime();
    // timeStart = new Date('2021-03-29').getTime();
    // let history = await getHistory('1m', timeStart, 50000);
    //
    // _consoleInfo('onInit', 'timeStart', timeStart);
    // _consoleInfo('onInit', 'timeStartHuman', timeToString(timeStart));
    // _consoleInfo('onInit', 'history firstdate', timeToString(history[1][0]));
    // _consoleInfo('onInit', 'history lastdate', timeToString(history[history.length - 1][0]));
    // _consoleInfo('onInit', 'history', history.slice(-5));
    //
    // _consoleInfo('onInit', 'calculateCandlesInMonth', calculateCandlesInMonth(timeStart, 1));
    // ko();
  };
}
