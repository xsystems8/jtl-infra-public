//Открывает позицию в начале раунда
//далее открывает противоположную позицию на растоянии gapPercent
import { uniqueId } from '../common/base';

import { Triggers } from '../common/events/triggers';
import { global } from '../common/global';
import { OrdersBasket } from '../common/exchange/orders-basket';
import { currentTime } from '../common/utils/date-time';
import { debugLog, error, errorOnce, log, trace } from '../common/log';
import { rand } from '../common/utils/numbers';

export class BasketChanel extends OrdersBasket {
  private gapPercent: number;
  private hedgeTpPercent: number;
  private hedgeSlPercent: number;

  private readonly tpPercent: number;
  private slPercent: number;

  private readonly orderSide: OrderSide;

  private readonly sizeUsd: number;
  private readonly basketProfit: number;
  private readonly getSizeType: string;
  // TODO: TYPE нужен тип для позиции
  private readonly positions: Map<string, any>;
  private readonly triggers: Triggers;

  pairs = {};
  maxDistancePercent = 20;
  profit = 0;

  isNewOrdersAllowed = true;

  startTime = 0;

  lastCloseTime = 0;
  lastOpenTime = 0;
  maxPositions = 0;
  posCnt = 0;
  posOpenCnt = 0;
  roundIterator = 0;
  iterator = 0;

  _posSlot = {};

  priceFrom = 0;
  priceTo = 0;

  factor = 1.1;
  isToDelete = false;

  constructor(id = undefined, params = undefined) {
    super();
    this.id = id ?? 'b_' + uniqueId(3);

    //hedge
    this.gapPercent = params?.gapPercent ?? 1;
    this.hedgeTpPercent = params?.hedgeTpPercent ?? 1;
    this.hedgeSlPercent = params?.hedgeSlPercent ?? 0;

    //round
    this.tpPercent = params?.tpPercent ?? 0;
    this.slPercent = params?.slPercent ?? 0;

    this.orderSide = params?.orderSide ?? 'buy';

    //basket
    this.sizeUsd = params?.sizeUsd ?? 100;
    this.basketProfit = params?.basketProfit ?? 5;

    this.getSizeType = params?.getSizeType ?? 'fixed_coin';

    this.roundIterator = 0;

    this.maxDistancePercent = 3;
    this.isNewOrdersAllowed = true;

    this.positions = new Map();

    this.triggers = new Triggers(true);
  }

  init = async () => {
    this.triggers.subscribe('openNextOrder', this.openNextOrder);
    return this;
    // this.triggers.subscribe('newRound', this.newRound);
  };

  onTick = async () => {};

  // TODO: TYPE params
  openOrder = async (params: Record<string, any>) => {
    let sl, tp, executionPrice;

    if (!params.side) {
      error('basket::openOrder', 'params.side not found', { params: params });
      return;
    }
    let side = params.side;
    params.pType = 'regular';
    params.basketId = this.id;
    params.comment = this.id + ' tp ' + this.tpPercent;

    executionPrice = params.executionPrice ?? close();
    let size = this.getSize(executionPrice);
    if (side === 'buy') {
      tp = 0; //executionPrice * (1 + this.tpPercent / 100);
      sl = 0;

      await this.buyMarket(size, sl, tp, params);
    } else {
      tp = 0; // executionPrice * (1 - this.tpPercent / 100);
      sl = 0;
      await this.sellMarket(size, sl, tp, params);
    }
  };

  openNextOrder = async (task) => {
    let params = task.params;

    await this.openOrder(params);
    this.isToDelete = true;
  };

  firstRound = async () => {
    let side = rand(0, 1) === 0 ? 'buy' : 'sell';

    await this.openOrder({ side: side });
    if (side === 'buy') {
      this.triggers.addTaskByPrice(close() * (1 - this.maxDistancePercent / 100), 'openNextOrder', { side: 'sell' });
    } else {
      this.triggers.addTaskByPrice(close() * (1 + this.maxDistancePercent / 100), 'openNextOrder', { side: 'buy' });
    }
    //   this.triggers.addTaskByTime(currentTimeMillisec() + 1000 * 60 * 60 * 8, 'newRound', {}); // 24 hours
  };

  newRound = async () => {
    trace('basket::newRound', 'newRound', { basketId: this.id });
    await this.firstRound();
  };

  async onOpenPosition(ownPos) {
    this.onPositionChanged(ownPos);

    // this.triggers.addTaskByPrice(close() * (1 - this.tpPercent / 100), 'openNextOrder', { side: 'buy' });
  }

  async onClosePosition(ownPos) {
    //await super.onClosePosition(ownPos);
    this.onPositionChanged(ownPos);
  }

  onPositionChanged(ownPos) {
    let pairId = ownPos.params.pairId;

    if (!this.pairs[pairId]) {
      this.pairs[pairId] = new PositionsPair(pairId);
    }
    this.pairs[pairId].updatePos(ownPos);

    if (ownPos.status === 'open') {
      this.lastOpenTime = currentTime();
      this.positions.set(ownPos.id, ownPos);

      this.posCnt++;
      this.posOpenCnt++;

      this.maxPositions = Math.max(this.maxPositions, this.positions.size);

      // one position for all
    } else {
      this.deletePositions(ownPos);
      this.lastCloseTime = currentTime();
      this.profit += ownPos.profit;
      this.posOpenCnt--;
    }
  }

  isTradeAllowed = true;
  isCloseConditions = () => {
    let basketProfit = this.getBasketProfit();
    let buyPos = this.getPosSlot('long');
    let sellPos = this.getPosSlot('short');

    buyPos.drawdown = buyPos.size * (close() - buyPos.entryPrice);
    sellPos.drawdown = sellPos.size * (sellPos.entryPrice - close());
    let slotDrawdown = buyPos.drawdown + sellPos.drawdown;
    let minProfit = (this.sizeUsd * this.basketProfit) / 100;
    let moneyUsed = Math.abs(buyPos.size * buyPos.entryPrice + sellPos.size * sellPos.entryPrice);

    if (this.basketProfit > 0 && basketProfit > minProfit) {
      trace('basket::isCloseConditions', 'basket closed by profit  = ' + basketProfit, {
        basketId: this.id,
        basketProfit: basketProfit,

        basketDrawdown: this.getDrawdown(),

        basketFullProfit: basketProfit,
        slotDrawdown: slotDrawdown,
        minProfit: minProfit,
        posSlot: this._posSlot,
      });

      this.isTradeAllowed = false;
      return true;
    }
    return false;
    if (moneyUsed > 4000 && basketProfit > 0) {
      trace('basket::isCloseConditions', 'basket closed moneyUsed > 4000', {
        basketId: this.id,
        moneyUsed: moneyUsed,
        basketProfit: this.profit,

        basketDrawdown: this.getDrawdown(),

        basketFullProfit: basketProfit,
        slotDrawdown: slotDrawdown,
        minProfit: minProfit,
        posSlot: this._posSlot,
      });
      return true;
    }

    if (moneyUsed > 7000) {
      trace('basket::isCloseConditions', 'basket closed moneyUsed > 7000', {
        basketId: this.id,
        moneyUsed: moneyUsed,
        basketProfit: this.profit,

        basketDrawdown: this.getDrawdown(),

        basketFullProfit: basketProfit,
        slotDrawdown: slotDrawdown,
        minProfit: minProfit,
        posSlot: this._posSlot,
      });
      return true;
    }
    return false;
  };

  closeBasket = async () => {
    await this.closeAllPositions({ comment: 'closeBasket' });
    await this.cancelAllOrders({ comment: 'closeBasket' });

    let timeSpend = Math.round((currentTime() - this.startTime) / 1000 / 60);
  };

  deletePositions = (ownPos) => {
    let id = ownPos.id;
    if (this.positions.has(id)) {
      this.positions.delete(id);
    } else {
      error('basket::deletePositions', `ownPos.id = ${id} not found in positions`);
    }
  };
  firstSize = 0;
  getSize = (executionPrice) => {
    if (!executionPrice || executionPrice <= 0) {
      throw new Error('Basket.v4::getSize executionPrice <= 0');
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

  getBasketProfit = () => {
    let profit = this.getProfit();

    profit += this.getDrawdown();

    return profit;
  };
}
