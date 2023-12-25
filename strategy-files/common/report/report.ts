import { ReportTable, TableRow } from './report-table';
import { ReportChart } from './report-chart';
import { ReportCard } from './report-card';
import { TradingViewChart, TradingViewMultipointShapes, TradingViewShapes } from './report-tv';
import { debugLog, error, log, getLogs } from '../log';
import { BaseObject } from '../base-object';
import { AggType } from './types';
import { BufferIndicatorItem } from '../indicators/types';

/**
 * Report - provide functionality for create report of trading strategy. Report can be viewed in web interface.
 * Widgets:
 * - Cards - show value of some variable
 * - Tables - show data in table
 * - Charts - show chart with lines
 * - TradingView charts - show chart with indicators and shapes
 *
 *  @note: for tester report should be updated in OnStop() function when script is finished.
 *  @note: for real trading report could be updated by time interval. But it is not recommended to update report too often.
 *  default interval: 5 sec.
 */
export class Report extends BaseObject {
  private tables: Record<string, ReportTable> = {};
  private cards: Record<string, ReportCard> = {};
  private optimizedValues: Record<string, ReportCard> = {};
  private charts: Record<string, ReportChart> = {};
  private tvCharts: Record<string, TradingViewChart> = {};
  private symbol: string = ARGS.symbol;
  private description: string = '';
  private reportData: ReportData;

  constructor() {
    super();
    //this.symbol = symbol;
    return this;
  }

  /**
   * Set description for report
   * @param description - description of report
   */
  setDescription(description: string) {
    this.description = description;
  }

  /**
   * Add value to optimization table in report. This used only for optimization. (only for tester)
   * @param name - optimization parameter name
   * @param value - value of parameter
   * @param aggType - aggregation type (last, min, max, sum, avg) default: last
   * @returns void
   * @example
   * // after optimization you will see table with results 2 columns: Max Profit and Max Drawdown and Profit
   * // and values for each optimization iteration.
   * onTick() {
   *   global.report.optimizedSetValue('Max Profit', getProfit(), 'max');
   *   global.report.optimizedSetValue('Max Drawdown', getCurrentUnrealizedPnl(), 'min');
   * }
   * onStop() {
   *  global.report.optimizedSetValue('Profit', getProfit());
   *   global.report.updateReport();
   * }

   */
  optimizedSetValue(name: string, value: number | string, aggType: AggType = 'last') {
    if (!this.optimizedValues[name]) {
      this.optimizedValues[name] = new ReportCard(name);
    }
    this.optimizedValues[name].setValue(value, aggType);
  }

  /**
   * Add card with value to report Cord widget
   * @param cardName - name of card
   * @param value - value of card if value with the same cardName passed several times, then aggregation will be applied.
   * @param aggType - aggregation type (last, min, max, sum, avg) default: last
   * @returns void
   * @example
   * report.cardSetValue('profit', 100, 'sum');
   * report.cardSetValue('profit', 200, 'sum');
   * //profit card will be 300
   *
   */
  cardSetValue(cardName: string, value: number | string, aggType: AggType = 'last') {
    if (!this.cards[cardName]) {
      this.cards[cardName] = new ReportCard(cardName);
    }
    this.cards[cardName].setValue(value, aggType);
  }

  /**
   * Add or update row in table widget in report. Max rows specified report-table.ts:MAX_ROWS (default: 100)
   * @param tableName - name of table widget
   * @param data - data to insert or update by idField. format: [{id: 1, name: 'test'}, {id: 2, name: 'test2'} ]
   * @param idField - field name to use as id. Default: 'id'
   * @returns void
   * @example
   *
   * // TestTable table example
   * report.tableUpdate('TestTable', [{id: 1, name: 'test'}, {id: 2, name: 'test2'} ]);
   * report.tableUpdate('TestTable', {id: 1, name: 'test'}, 'id'); //update row with id=1
   * report.tableUpdate('TestTable', {id: 3, name: 'test3'}, 'id'); //insert row with id=3
   *
   * // Orders table example
   * report.tableUpdate('Orders', await getOrders());
   *
   * //Positions table example
   * report.tableUpdate('Positions', await getPositions());
   */
  tableUpdate(tableName: string, data: TableRow[] | TableRow, idField: string = 'id') {
    if (!this.tables[tableName]) {
      this.tables[tableName] = new ReportTable(tableName);
    }

    if (Array.isArray(data)) {
      this.tables[tableName].insertUpdateRecords(data, idField);
    } else {
      this.tables[tableName].insertUpdate(data, idField);
    }
  }

  /**
   * Add point to chart widget in report. If chart with chartName not exists, then it will be created.
   * Max points specified report-chart.ts:MAX_POINTS (default: 5000)
   * @param chartName - name of chart widget
   * @param lineName - name of line in chart
   * @param pointValue - value of point (by default points aggregated every day see report-chart.ts  AGG_PERIOD = 86400000; // 1 day in ms)
   * @param aggType - aggregation type (last, min, max, sum, avg) default: last
   * @returns void
   * @example
   * //Price chart example to show price you need add point every tick or every time interval
   * onTick() {
   *  //On the chart you will see 2 lines: Price and Avg price
   *   report.chartAddPoint('Price chart', 'Price', close()); //add point to chart every tick
   *   report.chartAddPointAgg('Price chart', 'Avg price', close(),'avg'); // average price in a Day, technically it will be SMA by 1440 period for 1m timeframe
   * }
   *
   * //Profit chart you need add point every time you get profit
   * onOrderChange(order: Order) {
   *   if(order.status === 'closed' and order.reduceOnly === true) {
   *     report.chartAddPointAgg('Profit chart', 'Profit', getProfit(), 'last'); // only for tester
   *     //for real trading you need to calculate profit from orders and position info
   *   }
   * }
   */
  chartAddPointAgg(chartName: string, lineName: string, pointValue: number, aggType: AggType = 'last') {
    if (isNaN(pointValue)) {
      error(
        'report.chartAddPointAgg: pointValue should be Number pointValue=' +
          pointValue +
          ' chartName=' +
          chartName +
          ' lineName=' +
          lineName,
      );

      pointValue = null;
    }

    if (!this.charts[chartName]) {
      this.charts[chartName] = new ReportChart(chartName);
    }

    this.charts[chartName].addPointAggByDate(lineName, pointValue, aggType);
  }

  /** NOT INCLUDE TO MANUAL it is not working correctly
   * Add point to chart widget in report by . If chart with chartName not exists, then it will be created. Not Aggregated.
   * @param chartName - name of chart widget
   * @param lineName - name of line in chart
   * @param pointValue - value of point
   */
  chartAddPoint(chartName: string, lineName: string, pointValue: number) {
    if (!this.charts[chartName]) {
      this.charts[chartName] = new ReportChart(chartName);
    }
    this.charts[chartName].addPointByDate(lineName, pointValue);
  }

  //TODO tvCharts should be only one chart
  // уtvCharts->tvChart and refactor tvCharts[chartName] to tvChart
  /**
   * Add arrows to TradingView chart widget for each order.
   * @param orders - array of orders
   * @param timeframe - timeframe of chart in minutes. Default: 240 (4h)
   * @returns void
   */
  tvChartAddOrders(orders: Order[], timeframe = 240) {
    const chartName = 'tvChartMain';
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: timeframe });
    }

    orders.forEach((order) => {
      const shape = order.side === 'buy' ? TradingViewShapes.ARROW_UP : TradingViewShapes.ARROW_DOWN;
      const color = order.side === 'buy' ? 'green' : 'red';
      const coords = { price: order.price, time: order.timestamp };

      this.tvCharts[chartName].addShape(shape, { color, text: order.clientOrderId, coords });
    });
  }

  tvChartAddShapeZ(
    chartName: string,
    shape: TradingViewShapes,
    color: string,
    text: string,
    props: Record<string, string | number>,
  ) {
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: 240 });
    }

    this.tvCharts[chartName].addShape(shape, { color, text, props });
  }

  /**
   * Add shape to TradingView chart widget.
   * @param shape - shape type  (ARROW_UP, ARROW_DOWN, CIRCLE, CROSS, FLAG, LABEL, LINE, MARKER, SQUARE, TRIANGLE, X)
   * @param shapeParams - shape params { color, coords = {price,time}, text}
   * @param props - additional properties they will be added to table with key as column name and value as column value
   * @param timeframe - timeframe of chart in minutes. Default: 240 (4h)
   */
  tvChartAddShape(
    shape: TradingViewShapes,
    shapeParams: ReportTradingView.AddShapeParams,
    props?: Record<string, string | number | boolean>,
    timeframe = 240,
  ) {
    //
    const chartName = 'tvChartMain';
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: timeframe });
    }

    log('report.tvChartAddShapeA', 'add shape', { shape, params: shapeParams, props });
    this.tvCharts[chartName].addShape(shape, { ...shapeParams, props: props });
  }

  //NOT INCLUDE TO MANUAL it is not working correctly
  //TODO possibly need to create multipoint shape params type
  /**
   * Add shape to TradingView chart widget.
   * @param shape
   * @param color
   * @param text
   * @param endPoint
   */
  tvChartAddMultipointShape(
    shape: TradingViewMultipointShapes,
    color: string,
    text: string,
    endPoint: ReportTradingView.ShapeCoords,
  ) {
    //
    const chartName = 'tvChartMain';

    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: 240 });
    }

    this.tvCharts[chartName].addMultipointShape(shape, {
      color,
      text,
      coords: [{ price: close(), time: tms() }, endPoint],
    });
  }

  //NEED TO TEST AFTER THAT INCLUDE TO MANUAL
  tvChartAddIndicator(indicatorName: string, description: string, data: BufferIndicatorItem[]) {
    const chartName = 'tvChartMain';
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: 240 });
    }

    this.tvCharts[chartName].addIndicator({ name: indicatorName, description, data });
  }

  tvChartAddOscillator(oscillatorName: string, description: string, data: BufferIndicatorItem[]) {
    const chartName = 'tvChartMain';
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName, interval: 240 });
    }

    this.tvCharts[chartName].addOscillator({ name: oscillatorName, description, data });
  }

  /**
   * Updated report data on server. All logs will be added to report by default.
   *
   * @returns void
   */
  lastTimeUpdate = 0;
  maxTimeUpdate = 5000; //ms

  async updateReport() {
    if (Date.now() - this.lastTimeUpdate < this.maxTimeUpdate) {
      error('report.updateReport', 'updateReport too often', {
        lastTimeUpdate: this.lastTimeUpdate,
        maxTimeUpdate: this.maxTimeUpdate,
      });
      return;
    }
    this.lastTimeUpdate = Date.now();

    this.reportData = {
      id: getArtifactsKey(),
      symbol: this.symbol,
      description: this.description,
      blocks: [],
    };

    //----------------CARDS
    if (this.cards) {
      for (let cardName in this.cards) {
        try {
          let cardInfo = this.cards[cardName].prepareDataToReport();
          this.reportData.blocks.push(cardInfo);
        } catch (e) {
          error('report.updateReport(cards)', e.message, { e: e });
        }
      }
    }

    //----------------CHARTS
    if (this.charts) {
      for (let chartName in this.charts) {
        try {
          let chartInfo = this.charts[chartName].prepareDataToReport();
          this.reportData.blocks.push(chartInfo);
        } catch (e) {
          error('report.updateReport(charts)', e.message, { e: e });
        }
      }
    }

    //----------------TABLES
    if (this.tables) {
      for (let tableName in this.tables) {
        try {
          let tableInfo = this.tables[tableName].prepareDataToReport();
          this.reportData.blocks.push(tableInfo);
        } catch (e) {
          error('report.updateReport(tables)', e.message, { e: e });
        }
      }
    }

    //----------------OPTIMIZED VALUES
    if (this.optimizedValues) {
      let opResults = {};

      for (let valueName in this.optimizedValues) {
        try {
          let cardInfo = this.optimizedValues[valueName];
          opResults[valueName] = cardInfo.getValue();
        } catch (e) {
          error('report.updateReport(optimizedValues)', e.message, { e: e });
        }
      }

      this.reportData.blocks.push({
        type: 'optimizer_results',
        name: 'Optimization results',
        data: opResults,
      });
    }

    //----------------TRADING VIEW CHARTS
    if (this.tvCharts) {
      for (const chart in this.tvCharts) {
        try {
          const reportInfo = this.tvCharts[chart].prepareToReport();
          this.reportData.blocks.push(reportInfo);
        } catch (e) {
          error('report.updateReport(tvCharts)', e.message, { e: e });
        }
      }
    }

    let logs = getLogs('error');
    if (logs.length > 0) {
      this.reportData.blocks.push({
        type: 'table',
        name: 'Errors',
        data: logs.slice(0, 100),
      });
    }

    logs = getLogs('trace');
    if (logs.length > 0) {
      this.reportData.blocks.push({
        type: 'table',
        name: 'Trace',
        data: logs.slice(0, 100),
      });
    }

    logs = getLogs('log');
    if (logs.length > 0) {
      let to = Math.min(Math.round(logs.length / 2), 100);

      this.reportData.blocks.push({
        type: 'table',
        name: 'Log',
        data: logs.slice(0, to).concat(logs.slice(-to)),
      });
    }

    // info(this.reportData);
    //  _log('report.updateReport', 'report updated');
    //   _consoleInfo('report.updateReport ');
    await updateReport(this.reportData);
  }
}
