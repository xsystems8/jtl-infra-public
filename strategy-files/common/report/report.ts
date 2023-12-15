import { ReportTable, TableRow } from './report-table';
import { ReportChart } from './report-chart';
import { ReportCard } from './report-card';
import { TradingViewChart } from './report-tv';
import { debugLog, error, log, getLogs } from '../log';
import { BaseObject } from '../base-object';
import { AggType } from './types';
import { BufferIndicatorItem } from '../indicators/types';

export class Report extends BaseObject {
  private tables: Record<string, ReportTable> = {};
  private cards: Record<string, ReportCard> = {};
  private optimizedValues: Record<string, ReportCard> = {};
  private charts: Record<string, ReportChart> = {};
  private tvCharts: Record<string, TradingViewChart> = {};
  private symbol: string = '';
  private description: string = '';
  private reportData: ReportData;

  constructor() {
    super();
    //this.symbol = symbol;
    return this;
  }

  setDescription(description: string) {
    this.description = description;
  }

  optimizedSetValue(name: string, value: number | string, aggType: AggType = 'last') {
    if (!this.optimizedValues[name]) {
      this.optimizedValues[name] = new ReportCard(name);
    }
    this.optimizedValues[name].setValue(value, aggType);
  }

  cardSetValue(cardName: string, value: number | string, aggType: AggType = 'last') {
    if (!this.cards[cardName]) {
      this.cards[cardName] = new ReportCard(cardName);
    }
    this.cards[cardName].setValue(value, aggType);
  }

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

  chartAddPoint(chartName: string, lineName: string, pointValue: number) {
    if (!this.charts[chartName]) {
      this.charts[chartName] = new ReportChart(chartName);
    }
    this.charts[chartName].addPointByDate(lineName, pointValue);
  }

  tvChartAddShape(
    chartName: string,
    shape: string,
    color: string,
    text: string,
    props: Record<string, string | number>,
  ) {
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName });
    }

    this.tvCharts[chartName].addShape({ shape, color, text, props });
  }

  tvChartAddMultipointShape(chartName: string, shape: string, color: string, text: string, endPoint: any) {
    // if (!this.tvCharts[chartName]) {
    //   this.tvCharts[chartName] = new TradingViewChart({ name: chartName });
    // }
    //
    // this.tvCharts[chartName].addShape({ shape, color, text });
  }

  tvChartAddIndicator(chartName: string, indicatorName: string, description: string, data: BufferIndicatorItem) {
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName });
    }

    this.tvCharts[chartName].addIndicator({ name: indicatorName, description, data });
  }

  tvChartAddOscillator(chartName: string, oscillatorName: string, description: string, data: BufferIndicatorItem) {
    if (!this.tvCharts[chartName]) {
      this.tvCharts[chartName] = new TradingViewChart({ name: chartName });
    }

    this.tvCharts[chartName].addOscillator({ name: oscillatorName, description, data });
  }

  async updateReport() {
    this.reportData = {
      description: this.description,
      symbol: this.symbol,
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
