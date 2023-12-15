import { Triggers } from '../common/events/triggers';
import { Test } from './Test';
import { global } from '../common/global';
import { currentTime, timeToString } from '../common/utils/date-time';
import { debugLog, trace } from '../common/log';
import { rand } from '../common/utils/numbers';

export class Test3 extends Test {
  private triggers: Triggers;

  description = 'Open positions each percent and every midnight by triggers ';
  errors = [];
  constructor() {
    super();
  }

  openOrder = async (task) => {
    let params = task.params;
    if (params.side === 'buy') await global.basket.buyMarket(1 + rand(-20, 20) / 100, 0, 0, params);

    if (params.side === 'sell') await global.basket.sellMarket(1 + rand(-20, 20) / 100, 0, 0, params);
  };

  onInit() {
    global.report.setDescription(this.description);
    this.triggers = new Triggers(true);
    this.triggers.subscribe('openOrder', this.openOrder);
  }

  onTick = async () => {
    await super.onTick();

    //TODO MOVE TO onInit when tms will be returned time on initialization stage
    if (this.iterator === 1) {
      this.triggers.subscribe('openOrder', this.openOrder);

      let price = close();
      //cut to midnight time
      let time = currentTime() + 1000;

      let dayInMillisecond = 24 * 60 * 60 * 1000;
      for (let i = -20; i < 20; i++) {
        //eche percent
        this.triggers.addTaskByPrice(price + price * (0.01 * i), 'openOrder', { side: 'sell', comment: 'by price' });
        this.triggers.addTaskByPrice(price - price * (0.01 * i), 'openOrder', { side: 'buy', comment: 'by price' });
      }
      for (let i = 0; i < 100; i++) {
        let t = timeToString(time + dayInMillisecond * i);
        this.triggers.addTaskByTime(time + dayInMillisecond * i, 'openOrder', {
          side: 'sell',
          comment: 'by time',
          t: t,
        });
        this.triggers.addTaskByTime(time + dayInMillisecond * i + 1000, 'openOrder', {
          side: 'buy',
          comment: 'by time',
          t: t,
        });
      }

      trace('triggers', 'this.triggers.triggerPricesInfo', this.triggers._triggerPricesInfo);
      trace('triggers', 'this.triggers.triggerTimesInfo', this.triggers._triggerTimesInfo);

      global.report.tableUpdate('Trigger Prices', this.triggers._triggerPrices);
      global.report.tableUpdate('Trigger Times', this.triggers._triggerTimes);
    }
  };
}
