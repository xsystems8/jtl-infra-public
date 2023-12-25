import { global } from './common/global';
import { ExtendedScript } from './common/script/extended-script';
import { TesterReportPro } from './common/report/layouts/tester.report.pro';
import { error } from './common/log';
import { TradingViewShapes } from './common/report/report-tv';
import { currentTimeString } from './common/utils/date-time';
import { rand } from './common/utils/numbers';

//This is example illustrates how to use TradingView chart widget  in report
class Strategy extends ExtendedScript {
  private readonly daysPeriod: number;
  private readonly sizeUsd: number;
  private reportLayout: TesterReportPro;

  constructor(params: GlobalARGS) {
    super(params);
  }

  //===========================================================================
  //==============================  onTick  ==================================
  //===========================================================================

  nexTimeToUpdate = 0;
  onTick = async () => {
    if (this.nexTimeToUpdate < tms()) {
      this.nexTimeToUpdate = tms() + 1000 * 60 * 60 * 24; // 1 day
      global.report.tvChartAddShape(
        TradingViewShapes.ARROW_UP,
        {
          color: 'green',
          coords: {
            price: close() * 1.05,
            time: tms(),
          },
        },
        { date: currentTimeString(), random: rand(1, 8899) },
      );
    }
  };

  profit = 0;
  volume = 0;
  volumeUsd = 0;
  onOrderChange = async (order: Order) => {
    //calc volume
    if (order.status === 'closed' && order.reduceOnly !== true) {
      this.volume += order.amount; // volume in base currency
      this.volumeUsd += order.amount * order.price; // volume in USDT
    }
  };

  onInit = async () => {
    global.report.setDescription(`Create data on TradingView chart ${this.daysPeriod} days ${this.sizeUsd} USD`);
  };
  onStop = async () => {
    console.log('-------------------------------- stop()-------------------------------');
    await global.report.updateReport();
  };

  onError = async (e: any) => {
    error('onError', 'onError ' + e.message, { e: e });
  };
}
