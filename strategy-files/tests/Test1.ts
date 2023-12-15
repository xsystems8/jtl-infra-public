import { SeparatePositions } from '../common/exchange/separate-positions';
import { Test } from './Test';

export class Test1 extends Test {
  private sp: SeparatePositions;

  description = 'Проверяет исполнение лимитных ордеров: создается по 100 ордеров на покупку и продажу';

  constructor() {
    super();
    this.sp = new SeparatePositions();
  }

  async onTick() {
    await super.onTick();

    let ordersCnt = 10;
    if (this.iterator === 1) {
      let prevPrice = close();
      prevPrice = 3500;

      let executionPrice = 0;
      let percent = 0.1;
      for (let i = 1; i < ordersCnt; i++) {
        // executionPrice = prevPrice * (1 - percent);
        // await this.sp.sellLimit(1, executionPrice, 0, executionPrice * (1 - percent), { comment: 'test 0' });
        // prevPrice = executionPrice;
      }

      prevPrice = close(); //Math.round(close()) - (close() % 100);
      for (let i = 1; i < ordersCnt; i++) {
        // executionPrice = prevPrice * (1 + percent);
        // await this.sp.buyLimit(1, executionPrice, 0, executionPrice * (1 + percent), { comment: 'test 0' });
        // prevPrice = executionPrice;
      }
    }

    let size = 0.1;
    if (this.iterator % 1440 === 0 && this.iterator < 1440 * ordersCnt) {
      await this.sp.buyMarket(size, 0, 0, { comment: 'test 0' });
      //  await this.sp.sellMarket(size, 0, 0, { comment: 'test 0' });
      info('buyMarket ---------');
    }
    if (this.iterator === 0) {
      await this.sp.buyMarket(size, 0, 0, { comment: 'test 0' });
    }
    if (this.iterator === 1440 * ordersCnt + 1440) {
      await this.sp.closeAllPositions();
    }
  }

  async onOrderChange(orders) {
    await this.sp.onOrderChange(orders);

    // let pos = await fetchPositions();
    // if (pos.length > 2) {
    //   info(pos);
    //   ko();
    // }
  }
}
