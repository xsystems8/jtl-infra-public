import { SeparatePositions } from '../common/exchange/separate-positions';
import { Test } from './Test';
import { global } from '../common/global';

export class Test1 extends Test {
  private sp: SeparatePositions;

  description = 'Проверяет исполнение лимитных ордеров: создается по 100 ордеров на покупку и продажу';

  constructor() {
    super();
  }

  async onTick() {
    await super.onTick();

    let ordersCnt = 10;
    if (this.iterator === 1) {
      //    await global.exchange.buyMarket('', 2, close() * 0.95, close() * 1.05);
    }

    if (this.iterator === 2) {
      await global.exchange.sellLimit('', 2, close());

      await global.exchange.createStopLossOrder('', 'market', 'sell', 1, close() * 1.05);
      await global.exchange.createTakeProfitOrder('', 'market', 'sell', 1, close() * 0.95);
    }

    // if (this.iterator === -1) {
    //   let prevPrice = close();
    //   prevPrice = 3500;
    //
    //   let executionPrice = 0;
    //   let percent = 0.1;
    //   for (let i = 1; i < ordersCnt; i++) {
    //     executionPrice = prevPrice * (1 - percent);
    //     await global.exchange.sellLimit('', 1, executionPrice, 0, executionPrice * (1 - percent));
    //     prevPrice = executionPrice;
    //   }
    //
    //   prevPrice = close(); //Math.round(close()) - (close() % 100);
    //   for (let i = 1; i < ordersCnt; i++) {
    //     executionPrice = prevPrice * (1 + percent);
    //     await global.exchange.buyLimit('', 1, executionPrice, 0, executionPrice * (1 + percent));
    //     prevPrice = executionPrice;
    //   }
    // }

    // Do once in 1 day
    // let size = 0.1;
    // if (this.iterator % 1440 === 0 && this.iterator < 1440 * ordersCnt) {
    //   await global.exchange.buyMarket('', size);
    //
    //   info('buyMarket ---------');
    // }
  }

  async onOrderChange(order) {}
}
