import { global } from '../global';
import { currentTime } from '../utils/date-time';

class Statistics {
  timeStart = 0;
  leverage = 20;

  constructor() {
    this.timeStart = currentTime();

    global.events.subscribe('onOrderChange', this.onOrderChange);
  }

  ordersOpenedCnt = 0;
  ordersClosedCnt = 0;
  ordersCanceledCnt = 0;
  ordersModifiedCnt = 0;
  ordersTotalCnt = 0;

  volume = 0;

  onOrderChange = (orders: Order[]) => {
    for (let order of orders) {
      if (order.status === 'open') {
        this.ordersTotalCnt++;
        this.ordersOpenedCnt++;
      }

      if (order.status === 'closed') {
        this.ordersClosedCnt++;
        this.volume += order.amount * order.price;
      }

      if (order.status === 'canceled') {
        this.ordersCanceledCnt++;
      }
    }
  };
}
