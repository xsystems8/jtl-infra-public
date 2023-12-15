import { Test } from './Test';

import { global } from '../common/global';

export class Test6 extends Test {
  async onTick() {
    await super.onTick();

    if (this.iterator === 1) {
      await global.basket.buyLimit(1);
      await global.basket.sellLimit(1);
    }

    // if (this.iterator === 100) {
    //   await global.basket.sellLimit(1);
    // }
  }
}
