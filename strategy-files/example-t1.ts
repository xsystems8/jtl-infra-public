import { global } from './common/global';
import { ExtendedScript } from './common/script/extended-script';
import { TesterReportPro } from './common/report/layouts/tester.report.pro';
import { TesterReportStandard } from './common/report/layouts/tester.report.standard';
import { error, trace } from './common/log';

class Strategy extends ExtendedScript {
  private readonly daysPeriod: number;
  private readonly sizeUsd: number;
  private reportLayout: TesterReportPro;

  constructor(params: GlobalARGS) {
    super(params);

    this.exchange = 'binanceusdm';

    this.hedgeMode = params.hedgeMode === 'true';

    //-------------------  DCA params  -------------------
    this.daysPeriod = Number(params.daysPeriod ?? 7); // bot will buy every daysPeriod
    this.sizeUsd = Number(params.sizeUsd ?? 100); // size of each order in USD
  }

  //===========================================================================
  //==============================  onTick  ==================================
  //===========================================================================

  nextTimeToBuy = 0;
  onTick = async (data: Tick[]) => {};

  onInit = async () => {
    this.reportLayout = new TesterReportPro();
    global.report.setDescription(`DCA bot buy every ${this.daysPeriod} days ${this.sizeUsd} USD`);
  };
  onStop = async () => {
    info('-------------------------------- stop()-------------------------------');
    await global.report.updateReport();
  };

  onError = async (e: any) => {
    error('onError', 'onError ' + e.message, { e: e });
  };
}
