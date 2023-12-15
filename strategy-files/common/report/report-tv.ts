import { currentTime } from '../utils/date-time';

export class TradingViewChart {
  _widgetName = 'Trading View Widget';
  _shapes = [];
  _multipointShapes = [];
  _table = [];
  _indicator = null;
  _oscillator = null;
  _lastShapeId = 0;

  constructor(params) {
    if (params.name) {
      this._widgetName = params.name;
    }
  }

  updateTable(data) {
    if (Array.isArray(data)) {
      this._table = [...this._table, ...data];
    } else {
      this._table.push(data);
    }
  }

  addShape(params) {
    // TODO: нужна валидация
    const {
      shape,
      coords = { price: close(), time: currentTime() },
      color = 'red',
      text = 'default shape text',
      props,
    } = params;

    const shapeId = this._lastShapeId++;
    this.updateTable({ id: shapeId, shape, text, color, price: coords.price, timestamp: coords.time, ...props });

    this._shapes.push({ id: shapeId, shape, coords, color, text });
  }

  // addMultipointShape(params) {
  //   // const { shape, color = 'red', text = 'default shape name' } = params;
  //   // const coords = {
  //   //   price: close(),
  //   //   time: currentTimeMillisec(),
  //   // };
  //   // this._multipointShapes.push({ shape, coords, color, text });
  // }

  addIndicator(params) {
    const { name, description = 'Custom indicator', data } = params;
    this._indicator = {
      name,
      description,
      timeframe: ARGS.timeframe,
      data,
    };
  }

  addOscillator(params) {
    const { name, description = 'Custom oscillator', data } = params;
    this._oscillator = {
      name,
      description,
      timeframe: ARGS.timeframe,
      data,
    };
  }

  prepareToReport(): TVChartDataReportBlock {
    const startDate = new Date(ARGS.startDate.getTime());
    const endDate = new Date(ARGS.endDate.getTime());
    endDate.setMonth(endDate.getMonth() + 1);

    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    return {
      type: 'trading_view_chart',
      name: this._widgetName,
      data: {
        startTime,
        endTime,
        shapes: this._shapes,
        table: this._table,
        indicator: this._indicator,
        oscillator: this._oscillator,
      },
    };
  }
}

export const TradingViewShapes = {
  ARROW_UP: 'arrow_up',
  ARROW_DOWN: 'arrow_down',
  FLAG: 'flag',
  VERTICAL_LINE: 'vertical_line',
  HORIZONTAL_LINE: 'horizontal_line',
  ICON: 'icon',
  EMOJI: 'emoji',
  STICKER: 'sticker',
  ANCHORED_TEXT: 'anchored_text',
  ANCHORED_NOTE: 'anchored_note',
};

export const TradingViewMultipointShapes = {};
