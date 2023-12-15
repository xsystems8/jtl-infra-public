import { BaseScript } from './common/script/base-script';
import { global } from './common/global';
import { debugLog } from './common/log';

class Strategy extends BaseScript {
  hedgeMode: boolean = true;
  version = '1.0.1';
  private spread: string | number | boolean;

  constructor(params: GlobalARGS) {
    info('---------------------constructor-----------------------');
    super(params);

    this.exchange = 'binance';
    this.symbol = params.symbol ?? 'ETH/USDT';
    this.hedgeMode = params.hedgeMode === 'true';
    this.spread = params.spread ?? 0.0001; //0.0001
  }
  onTick = async (data) => {
    if (this.iterator % (1440 * 7) === 0) {
      debugLog('onTick', 'iterator ' + this.iterator);
    }
  };

  startTime = 0;
  stop = async () => {
    let TestedDays = info('Tested time: ' + (new Date().getTime() - this.startTime) / 1000 + 's');
    info('==================== Stop() ====================');
  };

  run = async () => {
    this.startTime = new Date().getTime();
    info('==================== Run() ====================');
  };
}
