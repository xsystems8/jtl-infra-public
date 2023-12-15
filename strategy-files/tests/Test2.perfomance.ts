import { Test } from './Test';
import { rand } from '../common/utils/numbers';
import { SeparatePositions } from '../common/exchange/separate-positions';

export class Test2 extends Test {
  private readonly sp: SeparatePositions;
  description = 'Check performance of the tester';
  errors = [];

  constructor() {
    super();
    this.iterator = 0;
    this.sp = new SeparatePositions();
  }

  async onTick() {
    await super.onTick();
    let size, tp, sl, execPrice;

    let openEveryMin = 100;

    if (this.iterator % openEveryMin === 0) {
      size = (1 * rand(1, 100)) / 100;
      execPrice = close() * (1 + rand(-50, 50) / 100);
      tp = execPrice * (1 + rand(1, 100) / 100);
      sl = execPrice * (1 - rand(1, 100) / 100);
      await this.sp.buyLimit(size, execPrice, tp, sl);
    }

    if (this.iterator % openEveryMin === 1) {
      size = (1 * rand(1, 100)) / 100;
      execPrice = close() * (1 + rand(-50, 50) / 100);
      tp = execPrice * (1 - rand(1, 100) / 100);
      sl = execPrice * (1 + rand(1, 100) / 100);
      await this.sp.sellLimit(size, execPrice, tp, sl);
    }

    if (this.iterator % openEveryMin === 2) {
      size = (1 * rand(1, 100)) / 100;
      await this.sp.buyMarket(size);
      await this.sp.sellMarket(size);
    }

    if (this.iterator % 5 === 0) {
      this.smallJob();
    }
    if (this.iterator % 1440 === 0) {
      this.heavyJob();
    }
  }

  smallJob() {
    let orders = this.sp.getOpenOrders();
    for (let i = 0; i < orders.length; i++) {
      let order = orders[i];
      let orderId = order.id;
      let posId = order.ownPosId;
      let position = this.sp.getPositionById(posId);
    }
  }

  heavyJob() {
    for (let i = 0; i < 1000000; i++) {
      for (let j = 0; j < 1000000; j++) {
        let a = i + j;
      }
    }
  }
  async onOrderChange(orders) {
    await this.sp.onOrderChange(orders);
  }
}
