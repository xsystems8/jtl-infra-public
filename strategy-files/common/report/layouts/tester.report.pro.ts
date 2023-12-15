import { global } from '../../global';
import { BaseObject } from '../../base-object.js';
import { currentTime, timeToStrHms } from '../../utils/date-time';
import { log } from '../../log';
import { TableRow } from '../report-table';

export class TesterReportPro extends BaseObject {
  period = 60 * 60 * 1000; // update report every hour (60*60*1000)
  lastTimeUpdated = 0;

  startTime = 0;
  endTime = 0;
  constructor() {
    super();
    if (!isTester()) {
      return;
    }

    this.startTime = new Date().getTime();
    global.events.subscribe('onAfterTick', this.onAfterTick, this);
    global.events.subscribe('onStop', this.onStop, this);

    log('TesterReportData:constructor', ' TesterReportData created');

    global.report.cardSetValue('Symbol', global.strategy.symbol);
  }

  timeToNextUpdate = 0;
  onAfterTick = async () => {
    if (this.lastTimeUpdated + this.period < currentTime()) {
      await this.collectData();
      this.lastTimeUpdated = currentTime();
    }
  };

  collectData = async () => {
    // get first basket
    let positions = await getPositions();
    let buyPrice = 0;
    let sellPrice = 0;
    let posSizeBuy = 0;
    let posSizeSell = 0;
    let uPnl = 0;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      if (pos.side === 'long') {
        buyPrice = pos.entryPrice;
        posSizeBuy = pos.contracts;
      }
      if (pos.side === 'short') {
        sellPrice = pos.entryPrice;
        posSizeSell = pos.contracts;
      }
      uPnl += pos.unrealizedPnl;
    }
    let profitApi = getProfit();

    global.report.chartAddPointAgg('Profit/Lost', 'Zero', 0, 'last');
    global.report.chartAddPointAgg('Profit/Lost', 'Profit', profitApi, 'last');
    global.report.chartAddPointAgg('Profit/Lost', 'Unrealized Profit', uPnl, 'last');

    let sizeUsdSell = posSizeSell * sellPrice;
    let sizeUsdBuy = posSizeBuy * buyPrice;
    let sizeUsd = sizeUsdSell + sizeUsdBuy;

    global.report.chartAddPointAgg('Money USED', 'Usd Buy', sizeUsdBuy ? sizeUsdBuy : null);
    global.report.chartAddPointAgg('Money USED', 'Usd Sell', sizeUsdSell ? sizeUsdSell : null);
    global.report.chartAddPointAgg('Money USED', 'All Usd', sizeUsd ? sizeUsd : null);

    global.report.chartAddPointAgg('Price chart', 'Price', close());
    global.report.chartAddPointAgg('Price chart', 'Entry Price Buy', buyPrice ? buyPrice : null);
    global.report.chartAddPointAgg('Price chart', 'Entry Price Sell', sellPrice ? sellPrice : null);

    global.report.optimizedSetValue('Max uPnl', uPnl, 'min');
    global.report.optimizedSetValue('Money Used', sizeUsdBuy + sizeUsdSell, 'max');
  };

  onStop = async () => {
    const fee = getFee();
    const orders = (await getOrders()).slice(0, 100) as TableRow[];

    global.report.optimizedSetValue('Commission', fee);

    global.report.cardSetValue('Fee', fee);

    global.report.cardSetValue('FinishDate', timeToStrHms(new Date().getTime()));

    global.report.tableUpdate('Orders real', orders);

    global.report.optimizedSetValue('Spend (min)', this.getTesterSpend());
  };

  getTesterSpend() {
    this.endTime = new Date().getTime();
    // min:sec
    return (
      Math.round((this.endTime - this.startTime) / 1000 / 60) +
      ' min ' +
      (Math.round((this.endTime - this.startTime) / 1000) % 60) +
      ' sec'
    );
  }
}
