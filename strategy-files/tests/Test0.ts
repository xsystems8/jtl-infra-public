import { Test } from './Test';

import { global } from '../common/global';

import { debugLog } from '../common/log';

export class Test0 extends Test {
  async onTick() {
    await super.onTick();

    if (this.iterator === 1) {
      let order = await global.exchange.buyMarket('', 0.01);
      debugLog('order 900', order);
    }
  }
}
