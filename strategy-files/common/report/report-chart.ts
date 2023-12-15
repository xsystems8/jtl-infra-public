import { global } from '../global';
import { currentTime, timeToString } from '../utils/date-time';
import { errorOnce } from '../log';
import { AggType } from './types';

export class ReportChart {
  buffer;
  lines;
  x;
  linesInfo;

  AGG_PERIOD = 86400000; // 1 day in ms
  MAX_POINTS = 5000;

  nextTimeToAggregate = 0;
  isNewDotsReady = false;
  lastXValue = 0;
  constructor(private readonly name: string) {
    this.buffer = {};
    this.lines = {};
    this.x = [];
    this.linesInfo = {};
    this.nextTimeToAggregate = currentTime() + this.AGG_PERIOD;
  }

  setLineInfo(name: string, aggType: AggType = 'max') {
    let lineNameWithAgg = aggType + '_' + name;
    this.linesInfo[lineNameWithAgg] = { name: name, aggType: aggType };
    this.lines[lineNameWithAgg] = [];
  }
  //aggType = sum / avg / max / min

  addPoint(lineName: string, valueX: number, valueY: number) {
    if (!this.linesInfo[lineName]) {
      this.linesInfo[lineName] = { name: lineName, aggType: 'none' };
      this.lines[lineName] = [];
    }

    if (this.x.length > this.MAX_POINTS) {
      errorOnce('ReportCharts::updatePointsToChart()', ' too many points in chart. Max points: ' + this.MAX_POINTS);
      return;
    }
    //TODO Charts.addPoint можно использовать только в одном месте / может пойти перекос по точкам одних будет больше чем других
    //нужно сделать проверку на количество точек во всех линиях / агрегатор
    this.lines[lineName].push(valueY);
    if (this.lines[lineName].length > this.x.length) {
      this.x.push(valueX);
    }
  }

  addPointByDate(lineName: string, valueY: number) {
    this.addPoint(lineName, currentTime(), valueY);
  }

  addPointAggByDate(lineName: string, value: number, aggType: AggType = 'max') {
    if (this.isNewDotsReady) {
      this.updatePointsToChart();
    }

    if (!this.buffer[lineName]) {
      this.buffer[lineName] = { lastValue: 0, sum: 0, avg: 0, min: null, max: null, cnt: 0, lastX: 0 };
      const lineNameWithAgg = aggType + '_' + lineName;
      this.linesInfo[lineNameWithAgg] = { name: lineName, aggType: aggType };
      this.lines[lineNameWithAgg] = [];
    }

    let pointInfo = this.buffer[lineName];
    if (pointInfo.lastX === currentTime()) {
      return;
    }

    pointInfo.sum += value;
    pointInfo.cnt++;

    if (pointInfo.min === null) pointInfo.min = value;
    pointInfo.min = Math.min(pointInfo.min, value);

    if (pointInfo.max === null) pointInfo.max = value;
    pointInfo.max = Math.max(pointInfo.max, value);

    pointInfo.lastValue = value;
    pointInfo.lastX = currentTime();

    if (currentTime() > this.nextTimeToAggregate && !this.isNewDotsReady) {
      this.lastXValue = currentTime();
      this.isNewDotsReady = true;
    }
  }

  updatePointsToChart = () => {
    if (this.x.length > this.MAX_POINTS) {
      errorOnce('ReportCharts::updatePointsToChart()', 'Too many points in chart. Max points: ' + this.MAX_POINTS);
      return;
    }
    let xValue = currentTime();
    for (let lineNameWithAgg in this.linesInfo) {
      let lineInfo = this.linesInfo[lineNameWithAgg];
      let lineName = lineInfo.name;
      let pointInfo = this.buffer[lineName];

      let pointValue = 0;
      switch (lineInfo.aggType) {
        case 'sum':
          pointValue = pointInfo.sum;
          break;
        case 'avg':
          pointValue = pointInfo.sum / pointInfo.cnt;
          break;
        case 'max':
          pointValue = pointInfo.max;
          break;
        case 'min':
          pointValue = pointInfo.min;
          break;
        case 'last':
          pointValue = pointInfo.lastValue;
          break;
        default:
          pointValue = pointInfo.lastValue;
          break;
      }
      this.lines[lineNameWithAgg].push(pointValue);
      this.buffer[lineName] = { lastValue: 0, sum: 0, avg: 0, min: null, max: null, cnt: 0, lastX: 0 };
    }
    this.x.push(this.lastXValue);
    this.isNewDotsReady = false;
    this.nextTimeToAggregate = currentTime() + this.AGG_PERIOD;
  };

  setAggPeriodByDates(start: number, end: number, dotCount: number) {
    this.AGG_PERIOD = (end - start) / dotCount;
  }

  prepareDataToReport = (): ChartDataReportBlock => {
    let series = [];

    for (let lineName in this.linesInfo) {
      series.push({
        name: this.linesInfo[lineName].name,
        data: this.lines[lineName],
      });
    }

    let dateStr = this.x.map((x) => {
      return timeToString(x);
    });

    return {
      type: 'chart',
      name: this.name,
      data: {
        series: series,
        time: this.x,
        // time: dateStr,
      },
    };
  };
}

export function addPointAggByDate(chartName: string, lineName: string, value: string, aggType: AggType = 'max') {
  if (!global.reportCharts) {
    global.reportCharts = {};
  }
  if (!global.reportCharts[chartName]) {
    global.reportCharts[chartName] = new ReportChart(chartName);
  }
  global.reportCharts[chartName].addPointAggByDate(lineName, value, aggType);
}

export function addPointByDate(chartName: string, lineName: string, value: number) {
  if (!global.reportCharts) {
    global.reportCharts = {};
  }
  if (!global.reportCharts[chartName]) {
    global.reportCharts[chartName] = new ReportChart(chartName);
  }
  global.reportCharts[chartName].addPointByDate(lineName, value);
}
