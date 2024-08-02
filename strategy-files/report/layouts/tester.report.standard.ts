import { global } from '../../global';
import { BaseObject } from '../../base-object.js';
import { currentTime, timeToStrHms } from '../../utils/date-time';
import { log } from '../../log';
import { TableRow } from '../report-table';

export class TesterReportStandard extends BaseObject {
  period = 60 * 60 * 1000; // update report every hour (60*60*1000)
  lastTimeUpdated = 0;

  startTime = 0;
  endTime = 0;
  private symbol: string;
  constructor() {
    super();
    if (!isTester()) {
      return;
    }

    this.startTime = new Date().getTime();
    global.events.subscribe('onAfterTick', this.onAfterTick, this);
    global.events.subscribe('onStop', this.onStop, this);

    log('TesterReportData:constructor', ' TesterReportData created');
    this.symbol = ARGS.symbol;
    global.report.cardSetValue('Symbol', ARGS.symbol);
  }

  timeToNextUpdate = 0;
  // onAfterTick = async () => {
  //
  // };

  async onAfterTick() {
    if (this.lastTimeUpdated + this.period < currentTime()) {
      await this.collectData();
      this.lastTimeUpdated = currentTime();
    }
  }

  collectData = async () => {
    let slotDrawdown = 0;

    // get first basket
    let positions = await getPositions();
    let buyPrice = 0;
    let sellPrice = 0;
    let posSizeBuy = 0;
    let posSizeSell = 0;
    let uPnl = 0;

    for (let i = 0; i < positions.length; i++) {
      if (positions[i].side === 'long') {
        buyPrice = positions[i].entryPrice;
        posSizeBuy = positions[i].contracts;
      }
      if (positions[i].side === 'short') {
        sellPrice = positions[i].entryPrice;
        posSizeSell = positions[i].contracts;
      }
      uPnl += positions[i].unrealizedPnl;
    }

    global.report.chartAddPointAgg('Price chart', 'price', close());

    let sizeUsdSell = posSizeSell * sellPrice;
    let sizeUsdBuy = posSizeBuy * buyPrice;

    let profitApi = await getProfit();

    global.report.chartAddPointAgg('Profit/Lost', 'Zero', 0, 'max');
    global.report.chartAddPointAgg('Profit/Lost', 'Profit', profitApi, 'max');
    global.report.chartAddPointAgg('Profit/Lost', 'Drawdown', uPnl, 'min');

    global.report.optimizedSetValue('maxDrawdown', uPnl, 'min');
    global.report.optimizedSetValue('MoneyUsed', sizeUsdBuy + sizeUsdSell, 'max');
  };

  // onStop = async () => {
  //   let fee = getFee();
  //
  //   global.report.optimizedSetValue('Commission', fee);
  //
  //   global.report.cardSetValue('Fee', fee);
  //
  //   global.report.cardSetValue('FinishDate', timeToStrHms(new Date().getTime()));
  //   global.report.tableUpdate('Orders real', (await getOrders()).slice(0, 100) as any);
  //
  //   global.report.optimizedSetValue('Spend (min)', this.getTesterSpend());
  // };

  async onStop() {
    let fee = getFee();

    global.report.optimizedSetValue('Commission', fee);

    global.report.cardSetValue('Fee', fee);

    global.report.cardSetValue('FinishDate', timeToStrHms(new Date().getTime()));
    global.report.tableUpdate('Orders real', (await getOrders()).slice(0, 100) as any);

    global.report.optimizedSetValue('Spend (min)', this.getTesterSpend());
  }

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
