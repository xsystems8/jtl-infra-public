import { global } from '../../global';
import { Watcher } from './watcher';

import { currentTimeString, currentTime } from '../../utils/date-time';

export class CandlesWatcher extends Watcher {
  prevTime = 0;
  candleHoles = [];
  period = 0; //period detected on second candle
  constructor() {
    super();
    global.events.subscribe('onAfterTick', this.checkCandlesHoles, this);
    global.events.subscribe('onAfterTick', this.checkCandle, this);
  }

  onStop = async () => {
    if (this.candleHoles.length > 0) {
      this.error('CandlesWatcher::onStop', 'Candles holes detected', this.candleHoles);
    }
  };

  checkCandlesHoles = async () => {
    if (this.prevTime === 0) {
      this.prevTime = currentTime();
      return;
    }
    if (this.period === 0) {
      this.period = currentTime() - this.prevTime;
      return;
    }

    if (this.period > 0 && this.period > 0) {
      if (this.candleHoles.length > 20) {
        return;
      }

      let diffMin = currentTime() - this.prevTime;
      if (diffMin !== this.period) {
        this.candleHoles.push({ time: currentTimeString(), diffMin: diffMin });
      }

      this.prevTime = currentTime();
    }
  };

  tolerance = 0.0000000001;
  checkCandle = async () => {
    if (!(close() > this.tolerance && open() > this.tolerance && high() > this.tolerance && low() > this.tolerance)) {
      this.error('CandlesWatcher::checkCandle', 'Candle is not valid', {
        close: close(),
        open: open(),
        high: high(),
        low: low(),
      });
    }
  };
}
