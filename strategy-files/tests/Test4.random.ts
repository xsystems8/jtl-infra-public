import { Test } from './Test';
import { global } from '../common/global';
import { rand } from '../common/utils/numbers';

export class Test4 extends Test {
  description = '';
  ordersCnt = 0;

  constructor() {
    super();
  }

  async onTick() {
    await super.onTick();

    let maxOrdersCnt = 10;
    let howOften = 60 * 5; //60*24 = 1 day

    if (this.ordersCnt > maxOrdersCnt) {
      return;
    }

    if (this.iterator % howOften === 0) {
      let executionPrice = close() * (1 - rand(-50, 50) / 100);
      let percent = rand(-15, 15);
      let randN = rand(0, 3);
      let sl: number, tp: number, size: number;

      size = 1; //(1 * rand(1, 100)) / 100;
      if (randN === 0) {
        sl = close() * (1 - percent / 100);
        tp = close() * (1 + percent / 100);

        await global.exchange.buyMarket('', size, sl, tp);
        this.ordersCnt++;
      }
      if (randN === 1) {
        sl = close() * (1 + percent / 100);
        tp = close() * (1 - percent / 100);
        await global.exchange.sellMarket('', size, sl, tp);
        this.ordersCnt++;
      }

      if (randN === 2) {
        sl = close() * (1 - percent / 100);
        tp = close() * (1 + percent / 100);
        await global.exchange.sellLimit('', size, executionPrice, sl, tp);
        this.ordersCnt++;
      }

      if (randN === 3) {
        sl = close() * (1 + percent / 100);
        tp = close() * (1 - percent / 100);
        await global.exchange.buyLimit('', size, executionPrice, sl, tp);
        this.ordersCnt++;
      }
    }
  }
}
