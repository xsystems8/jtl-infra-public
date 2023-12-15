import { global } from '../global';

import { BalanceWatcher } from './Watchers/balance-watcher';
import { OrdersWatcher } from './Watchers/orders-watcher';
import { OrdersWatcherPriority } from './Watchers/orders.watcher.priority';
import { PositionsWatcher } from './Watchers/positions-watcher';

import { Watcher } from './Watchers/watcher';
import { OrdersBasket } from '../exchange/orders-basket';
import { trace } from '../log';
import { TestWatcherParams } from './types';

export class TestWatcher extends Watcher {
  private ordersWatcher: OrdersWatcher;
  private ordersWatcherPriority: OrdersWatcherPriority;
  private positionsWatcher: PositionsWatcher;

  isHedged = true;
  posSlot = {};
  profit = 0;

  constructor(params?: TestWatcherParams) {
    super();
    trace('TestWatcher:constructor', 'constructor');

    //TODO change to false
    this.isHedged = global.strategy.hedgeMode;
    return this;
  }

  init = async () => {
    trace('TestWatcher:init', 'init');

    // globals.events.subscribe('onTick', this.onTick);
    // globals.events.subscribe('onStop', this.onStop);

    //    this.balanceWatcher = new BalanceWatcher();
    this.ordersWatcher = new OrdersWatcher();
    this.ordersWatcherPriority = new OrdersWatcherPriority();
    this.positionsWatcher = new PositionsWatcher();
    //this.candlesWatcher = new CandlesWatcher();
  };
  // onWatcherErrorsCollect = (errors) => {
  //   globals.report.
  // };
}
