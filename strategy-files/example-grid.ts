import { global } from './common/global';
import { ExtendedScript } from './common/script/extended-script';
import { TesterReportPro } from './common/report/layouts/tester.report.pro';
import { debugLog, error, log, trace } from './common/log';

class Strategy extends ExtendedScript {
  version = '1.01.4';

  constructor(params) {
    super(params);

    this.exchange = 'binanceusdm';

    //-------------------  Grid params  -------------------
    this.getSizeType = params.getSizeType ?? 'fixed_usd';
    this.stepPercent = Number(params.stepPercent ?? 1);
    this.maxLevels = Number(params.maxLevels ?? 30);
    this.sizeUsd = Number(params.sizeUsd ?? 100);
    this.minProfitPercent = Number(params.minProfitPercent ?? 20);

    this.gridSide = this.getGridSide(params.gridSide); // both (0), buy (1), sell (3)
  }

  //===========================================================================
  //==============================  onTick  ==================================
  //===========================================================================
  onInit = async () => {
    this.showInfo();
    if (isTester()) {
      this.dataCollector = new TesterReportPro();
    } else {
      //this.dataCollector = new RuntimeReportData();
    }
    global.report.setDescription(`Grid bot step ${this.stepPercent}% Levels ${this.maxLevels} side ${this.gridSide}`);
  };

  onTick = async (data) => {
    if (this.iterator === 1) {
      await this.createGrid();
    }
  };
  createGrid = async () => {
    let order, size, step;
    let gidSize = this.maxLevels;
    let executionPrice = close();
    let prevPrice = executionPrice;

    // step = prevPrice * (1 + this.stepPercent / 100); // static step calculated at the start of the grid

    if (this.gridSide === 'both' || this.gridSide === 'buy') {
      //---------------------------- BUY ORDERS  ----------------------------
      for (let i = 1; i < gidSize; i++) {
        step = prevPrice * (this.stepPercent / 100); // dynamic step recalculated by percent
        executionPrice = executionPrice - step;
        size = this.getSize(executionPrice);

        order = await createOrder('limit', 'buy', size, executionPrice, { positionSide: 'long' });

        if (!order.id)
          error('createGrid', 'buy order not created', {
            executionPrice: executionPrice,
            size: size,
            order: order,
          });
        else log('createGrid', 'buy order created id = ' + order.id + ' at price ' + order.price);

        prevPrice = executionPrice;
      }
    }

    if (this.gridSide === 'both' || this.gridSide === 'sell') {
      //---------------------------- SELL ORDERS  ----------------------------
      executionPrice = close();
      prevPrice = executionPrice;
      for (let i = 1; i < gidSize; i++) {
        step = prevPrice * (this.stepPercent / 100); // dynamic step recalculated by percent
        executionPrice = executionPrice + step;
        size = this.getSize(executionPrice);

        order = await createOrder('limit', 'sell', size, executionPrice, { positionSide: 'short' });

        if (!order.id)
          error('createGrid', 'sell order not created', {
            executionPrice: executionPrice,
            size: size,
            order: order,
          });
        else log('createGrid', 'sell order created id = ' + order.id + ' at price ' + order.price);

        prevPrice = executionPrice;
      }
    }

    trace('createGrid', 'Grid created');
  };

  onStop = async () => {
    info('-------------------------------- stop()-------------------------------');
    global.report.updateReport();
    info('Report updated');
  };

  firstSize = 0;
  getSize = (executionPrice) => {
    if (!executionPrice || executionPrice <= 0) {
      throw new Error('getSize executionPrice <= 0');
    }

    if (this.getSizeType === 'fixed_coin') {
      if (this.firstSize === 0) {
        this.firstSize = this.sizeUsd / executionPrice;
      }
      return this.firstSize;
    }

    if (this.getSizeType === 'fixed_usd') {
      return this.sizeUsd / executionPrice;
    }

    return this.sizeUsd / executionPrice;
  };
  onError = async (e) => {
    error('onError', 'onError ' + e.message, { e: e });
  };
  getGridSide = (nSide) => {
    if (Number(nSide) === 1) return 'buy';
    if (Number(nSide) === 2) return 'sell';
    return 'both';
  };
}
