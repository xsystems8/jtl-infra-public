import { Test } from './Test';

import { global } from '../common/global';

import {debugLog} from "../common/log";

export class Test0 extends Test {
  async onTick() {
    await super.onTick();
    // if (this.iterator === 1) {
    //   _trace('onTick ' + this.iterator, 'Test0 -----!');
    //   if (rand(0, 1)) {
    //     await this.sp.buyMarket(0.01, close() * 0.99, close() * 1.01);
    //   } else {
    //     await this.sp.sellMarket(0.01, close() * 1.01, close() * 0.99);
    //   }
    // }
    //
    if (this.iterator === 1) {
      let order = await global.basket.buyMarket(0.01);
      debugLog('order 900', order);
    }

    // if (this.iterator === 2) {
    //   await global.basket.sellLimit(1, close());
    // }
    //
    // if (this.iterator === 200) {
    //   await global.basket.closeAllPositions();
    // }
  }
}
