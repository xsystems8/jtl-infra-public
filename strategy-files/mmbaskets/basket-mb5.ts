import { uniqueId } from '../common/base';

import { Triggers } from '../common/events/triggers';
import { global } from '../common/global';
import { OrdersBasket } from '../common/exchange/orders-basket';
import { isZero, rand } from '../common/utils/numbers';
import { TestWatcher } from '../common/tests/test.watcher';
import { currentTime } from '../common/utils/date-time';
import { debugLog, error, errorOnce, log, trace, traceOnce } from '../common/log';

export class BasketMb5 extends OrdersBasket {
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
  private triggers: Triggers;

  private readonly watcher: TestWatcher;

  private openHedgePosition: () => void;

  pairs = {};
  maxDistancePercent = 20;
  id;
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
  factor = 1.1;
  isToDelete = false;
  _posSlot = {};

  constructor(id, params = undefined) {
    super({ idPrefix: id });
    this.id = id ?? 'b_' + uniqueId(3);

    //hedge
    this.gapPercent = params?.gapPercent ?? 1;
    this.hedgeTpPercent = params?.hedgeTpPercent ?? 1;
    this.hedgeSlPercent = params?.hedgeSlPercent ?? 0;

    //round
    this.tpPercent = params?.tpPercent ?? 8;
    this.slPercent = params?.slPercent ?? 0;

    this.orderSide = params?.orderSide ?? 'buy';

    this.sizeUsd = params?.sizeUsd ?? 100;
    this.basketProfit = params?.basketProfit ?? 8;

    this.getSizeType = params?.getSizeType ?? 'fixed_usd';

    this.roundIterator = 0;
    this.maxDistancePercent = 3;
    this.positions = new Map();
    this.watcher = new TestWatcher();
  }

  init = async () => {
    await super.init();
    trace('basketMb::init', 'init', { basketId: this.id });
    let id = global.events.subscribe('onTick', this.checkProfitToClose, this);
    //  globals.events.subscribe('onTick', this.onTick, this);

    this.triggers = new Triggers(true);
    this.triggers.subscribe('openHedgePosition', this.openHedgePosition);
    return this;
  };

  openOrder = async (params: Record<string, any>) => {
    if (!this.isNewOrdersAllowed) {
      trace('basket::openOrder', 'isNewOrdersAllowed = false', { basketId: this.id });
      return;
    }
    let sl = 0;
    let tp, executionPrice;

    if (!params.side) {
      error('basket::openOrder', 'params.side not found', { params: params });
      return;
    }
    let side = params.side;
    params.pType = params.pType ?? 'regular';
    params.basketId = this.id;
    // params.comment = this.id + ' tp ' + this.tpPercent;

    let size;

    if (side === 'buy') {
      executionPrice = close();
      tp = executionPrice * (1 + this.tpPercent / 100);
      size = this.getSize(executionPrice);
      await this.buyMarket(size, sl, tp, params);

      // limit order
      await this.createLimitOrder({ side: 'buy' });
    }

    if (side === 'sell') {
      executionPrice = close();
      tp = executionPrice * (1 - this.tpPercent / 100);
      size = this.getSize(executionPrice);
      await this.sellMarket(size, sl, tp, params);

      // limit order
      await this.createLimitOrder({ side: 'sell' });
    }
  };

  createLimitOrder = async (params) => {
    if (!this.isNewOrdersAllowed) {
      trace('basket::openOrder', 'isNewOrdersAllowed = false', { basketId: this.id });
      return;
    }
    let sl = 0;
    let tp, executionPrice;

    if (!params.side) {
      error('basket::createLimitOrder', 'params.side not found', { params: params });
      return;
    }
    let side = params.side;
    params.pType = params.pType ?? 'regular';
    params.basketId = this.id;
    // params.comment = this.id + ' tp ' + this.tpPercent;

    let size;

    if (side === 'buy') {
      // limit order
      executionPrice = close() * (100 / (this.tpPercent + 100)); //
      tp = executionPrice * (1 + this.tpPercent / 100);
      size = this.getSize(executionPrice);
      await this.buyLimit(size, executionPrice, sl, tp, params);
    }

    if (side === 'sell') {
      // limit order
      executionPrice = close() * ((this.tpPercent + 100) / 100); //
      tp = executionPrice * (1 - this.tpPercent / 100);
      size = this.getSize(executionPrice);
      this.nextOpenPrice = executionPrice;
      await this.sellLimit(size, executionPrice, sl, tp, params);
    }
  };

  newRound = async () => {
    let side = rand(0, 1) === 0 ? 'buy' : 'sell';

    await this.openOrder({ side: 'sell', tp: this.tpPercent });
    await this.openOrder({ side: 'buy', tp: this.tpPercent });
  };

  onTick = async () => {
    global.report.chartAddPointAgg('Price chart', 'SELL ORDER', this.lastOpenedPrice);
    global.report.chartAddPointAgg('Price chart', 'NEXT SELL ORDER', this.nextOpenPrice);
  };

  lastOpenedPrice = null;
  nextOpenPrice = null;
  onOpenPosition = async (ownPos, ownOrder) => {
    log('basket::onOpenPosition', 'onOpenPosition', { ownPos: ownPos });
    this.onPositionChanged(ownPos);

    let orderSide = ownPos.side === 'long' ? 'buy' : 'sell';
    if (ownOrder.type === 'limit') {
      // this.lastOpenedPrice = close();
      await this.createLimitOrder({ side: orderSide });
    }

    //  _consoleInfo('basket::onOpenPosition', 'onOpenPosition', { ownPos: ownPos });
  };

  onClosePosition = async (ownPos, ownOrder) => {
    log('basket::onClosePosition', 'onClosePosition', { ownPos: ownPos });
    this.onPositionChanged(ownPos);
    let orderSide = ownPos.side === 'long' ? 'buy' : 'sell';
    if (ownPos.side === 'long') {
      await this.openOrder({ side: orderSide, tp: this.tpPercent });
    }

    if (ownPos.side === 'short') {
      await this.openOrder({ side: orderSide, tp: this.tpPercent });
    }
  };

  onPositionChanged(ownPos) {
    let pairId = ownPos?.params?.pairId ?? 'n/a';

    if (ownPos.status === 'open') {
      this.lastOpenTime = currentTime();

      this.posCnt++;
      this.posOpenCnt++;

      this.maxPositions = Math.max(this.maxPositions, this.positions.size);

      // one position for all
    } else {
      this.lastCloseTime = currentTime();
      this.profit += ownPos.profit;
      this.posOpenCnt--;
    }
  }

  checkProfitToClose = async () => {
    if (this.isCloseConditions()) {
      await this.closeBasket();
      this.isToDelete = true;
      this.isNewOrdersAllowed = false;
    }
  };

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

    global.report.chartAddPointAgg('basketProfit', 'profit', basketProfit);
    global.report.chartAddPointAgg('basketProfit', 'minProfit', minProfit);
    if (basketProfit > minProfit) {
      traceOnce('basket::isCloseConditions', 'basket closed by min profit  = ' + minProfit, {
        basketId: this.id,
        basketProfit: basketProfit,

        basketDrawdown: this.getDrawdown(),

        basketFullProfit: basketProfit,
        slotDrawdown: slotDrawdown,
        minProfit: minProfit,
        posSlot: this._posSlot,
      });

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
    // await this.closeAllPositions({ comment: 'closeBasket' });
    // await this.cancelAllOrders({ comment: 'closeBasket' });

    await this.closeAllPositions({ comment: 'closeBasket' });
    await this.cancelAllOrders();

    let timeSpend = Math.round((currentTime() - this.startTime) / 1000 / 60);
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
  unsubscribe = async () => {
    //await super.destroy();
    global.events.unsubscribeByObj(this);
    this.onClosePositionCallBack = undefined;
    this.onOpenPositionCallBack = undefined;
    await this.triggers.unsubscribe();
  };
}
