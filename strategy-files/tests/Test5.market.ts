import { Test } from './Test';

import { global } from '../common/global';

export class Test5 extends Test {
  async onTick() {
    await super.onTick();

    if (this.iterator === 1) {
      await global.basket.buyMarket(0.01);
    }

    if (this.iterator === 100) {
      await global.basket.buyMarket(0.01);
    }

    if (this.iterator === 200) {
      await global.basket.sellMarket(0.01);
    }

    if (this.iterator === 400) {
      await global.basket.sellMarket(0.01);
    }

    if (this.iterator === 20000) {
      await global.basket.closeAllPositions();
    }
  }
}
