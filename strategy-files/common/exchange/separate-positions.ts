import { OrdersBasket } from './orders-basket';
import { timeToString } from '../utils/date-time';
import { error, errorOnce, warning } from '../log';
import { OrdersBasketParams } from './types';
import { OrderSide } from '../../../pre-build/environment/exchange/interface/order.interface';

export class SeparatePositions extends OrdersBasket {
  // TODO: TYPE positions
  private readonly positionsById: Map<string, any>;
  private readonly historyPositionsById: Map<string, any>;

  posCount = 0;

  posNextId = 0;

  version = '1.0.9';

  isLoggingEnabled = true;

  constructor(params?: OrdersBasketParams) {
    super(params);

    //  _error('sp:constructor', 'SeparatePositions is deprecated use OrdersBasketJt instead');
    this.positionsById = new Map();
    this.historyPositionsById = new Map();

    // this.symbol = params.symbol ?? 'ETH/USDT';
    // this.hedgeMode = params.hedgeMode ?? true;
    // this.exchange = params.exchange ?? 'binance';

    // if (!isTester() && !params.idPrefix) {
    //   this.idPrefix = unicueId(4) + '.';
    // }
    // if (params.idPrefix) {
    //   this.idPrefix += params.idPrefix + '.';
    // }
  }

  //init

  getOpenPositions = () => {
    let positions = [];

    for (let [key, pos] of this.positionsById) {
      if (pos.status === 'open') {
        positions.push(pos);
      }
    }

    return positions;
  };

  getPositionById = (ownPosId) => {
    if (this.positionsById.has(ownPosId)) {
      return this.positionsById.get(ownPosId);
    }

    if (this.historyPositionsById.has(ownPosId)) {
      return this.historyPositionsById.get(ownPosId);
    }
    errorOnce('sp:getPositionById', `'Error position id(${ownPosId}) not exist `);

    return undefined;
  };

  setPositionById = (id, pos) => {
    this.positionsById.set(id, pos);
  };

  closePositionByMarket = async (ownPosId, params: Record<string, any> = {}) => {
    this.log('sp:closePositionByMarket', '', { ownPosId: ownPosId });
    let ownPos = this.getPositionById(ownPosId);

    if (!ownPos) {
      errorOnce('sp:closePositionByMarket', `Error pos not exist ownPosId(${ownPosId})`, {
        ownPosId: ownPosId,
        ownPos: ownPos,
      });
      return false;
    }
    let size = ownPos.size;
    params.reduceOnly = true;
    params.ownPosId = ownPosId; //for link pos and order
    let orderSide: OrderSide = ownPos.side === 'long' ? 'sell' : 'buy';

    let order = await this._createOrder('market', orderSide, size, 0, params);

    return order.status === 'closed';
  };

  closeAllPositions = async (params = {}) => {
    //pos id only status open

    let positions = this.getOpenPositions();

    this.log('sp:closeAllPositions', `${positions.length} Position(s) to close`);

    for (let ownPos of positions) {
      await this.closePositionByMarket(ownPos.id, params);
    }
  };

  onOrderChange = async (orders) => {
    throw new Error('delete sp.onOrderChange()  from paranet class ');
  };

  onOpenPosition = async (ownPos, ownOrder) => {
    this.log('sp:onOpenPosition', '' + ownOrder.id, { ownPos: ownPos, ownOrder: ownOrder });
    ownPos = await this.addPositionByOwnOrder(ownOrder);

    if (this.onOpenPositionCallBack) {
      this.onOpenPositionCallBack(ownPos, ownOrder);
    }
  };

  onClosePosition = async (ownPos, ownOrder) => {
    this.log('sp:onClosePosition', '' + ownOrder.id, { ownPos: ownPos, ownOrder: ownOrder });

    if (ownOrder.ownerId || ownOrder.params.ownPosId) {
      ownPos = await this.closePositionByOwnOrder(ownOrder);
    }

    if (this.onClosePositionCallBack) {
      this.onClosePositionCallBack(ownPos, ownOrder);
    }
  };

  positionIdByOrderId = {};
  addPositionByOwnOrder = async (ownOrder) => {
    let sl, tp;

    sl = ownOrder.sl;
    tp = ownOrder.tp;

    if (this.positionIdByOrderId[ownOrder.id]) {
      error('sp:addPositionByOwnOrder', `Error pos already exist ownOrderId(${ownOrder.id})`, {
        ownOrder: ownOrder,
      });
      return;
    }
    let ownPosId = 'p' + this.posNextId++;
    this.positionIdByOrderId[ownOrder.id] = ownPosId;

    let ownPos = {
      id: ownPosId,
      // symbol: ownOrder.symbol,
      openOrderId: ownOrder.id,
      closeOrderId: '',
      dateOpen: timeToString(ownOrder.timestamp),
      dateClose: '',
      comment_open: ownOrder.comment ?? '',
      side: ownOrder.side === 'buy' ? 'long' : 'short', //'long', 'short
      //TODO путаница с order.size и position.contracts что делать?
      size: ownOrder.amount,
      profit: 0,
      profitPercent: '',
      priceOpen: ownOrder.price,
      priceClose: 0,
      openOrderType: ownOrder.type,
      closeOrderType: '',
      sl: sl,
      slOrderId: '',
      tp: tp,
      tpOrderId: '',
      entryPrice: ownOrder.price,
      status: 'open',
      //  comment_open: ownOrder.comment ?? '',
      comment_close: '',
      timeOpen: ownOrder.timestamp,
      timeClose: null,
      symbol: ownOrder.symbol,
      params: ownOrder.params ?? {},
    };

    this.log('sp:addPositionByOrder', `New ownPos (${ownPos.id}) owwOrderID ` + ownOrder.id, {
      ownPos: ownPos,
      ownOrder: ownOrder,
    });

    this.setPositionById(ownPos.id, ownPos);

    this.posCount++;
    await this.linkPosAndOrder(ownPos.id, ownOrder.id, 'open');

    return ownPos;
  };

  closePositionByOwnOrder = async (ownOrder) => {
    let ownPosId;
    let ownOrderId = ownOrder.id;

    if (ownOrder.ownerId) ownPosId = this.positionIdByOrderId[ownOrder.ownerId];
    if (ownOrder.params.ownPosId) ownPosId = ownOrder.params.ownPosId;
    let ownPos = this.getPositionById(ownPosId);

    if (ownPos === undefined) {
      error('sp:closePositionByOrder', `Error pos not exist ownPosId(${ownPosId}) ownOrderId(${ownOrderId}) `, {
        ownPosId: ownPosId,
        ownOrder: ownOrder,
      });
      return;
    }
    if (ownPos.status === 'closed') {
      warning('sp:closePositionByOrder', `Already closed ownPosId(${ownPosId}) ownOrderId(${ownOrderId}) `, {
        ownPos: ownPos,
        ownOrder: ownOrder,
      });
      return;
    }

    ownPos.status = 'closed';
    ownPos.priceClose = ownOrder.price;
    ownPos.closeOrderId = ownOrderId;
    ownPos.closeOrderType = ownOrder.type;
    ownPos.dateClose = timeToString(ownOrder.timestamp);
    ownPos.timeClose = ownOrder.timestamp;

    ownPos.comment_close = ownOrder.comment;

    if (ownPos.side === 'long') {
      ownPos.profit = (ownPos.priceClose - ownPos.priceOpen) * ownPos.size;
      ownPos.profitPercent = Math.round((ownPos.priceClose / ownPos.priceOpen - 1) * 10000) / 100 + '%';
      this.profit += ownPos.profit;
    } else {
      ownPos.profit = (ownPos.priceOpen - ownPos.priceClose) * ownPos.size;
      ownPos.profitPercent = Math.round((1 - ownPos.priceClose / ownPos.priceOpen) * 10000) / 100 + '%';
      this.profit += ownPos.profit;
    }

    this.log('sp:closePositionByOrder', `Position closed ownPosId(${ownPosId}) ownOrderId(${ownOrderId})`, {
      ownOrder: ownOrder,
      ownPos: ownPos,
    });

    this.setPositionById(ownPosId, ownPos);

    await this.linkPosAndOrder(ownPosId, ownOrderId, 'close');
    return ownPos;
  };

  linkPosAndOrder = async (ownPosId, ownOrderId, linkType = 'open') => {
    //linkType = { open | close | sl | tp }

    let ownPos = this.getPositionById(ownPosId);
    let ownOrder = this.getOrderById(ownOrderId);

    if (ownPos === undefined || ownOrder === undefined) {
      error('sp:linkPosAndOrder', 'Error ownPos or ownOrder undefined', {
        ownPosId: ownPosId,
        ownOrderId: ownOrderId,
        linkType: linkType,
        ownPos: ownPos,
        ownOrder: ownOrder,
      });
      return false;
    }
    let msg = '';
    if (linkType === 'open') {
      ownPos.openOrderId = ownOrderId;
      ownOrder.ownPosId = ownPosId;
      msg = `Pos open | posId(${ownPosId})<->orderId(${ownOrderId})`;
    }
    if (linkType === 'close') {
      ownPos.closeOrderId = ownOrderId;
      ownOrder.ownPosId = ownPosId;
      msg = `Pos close posId(${ownPosId})<->orderId(${ownOrderId})`;
    }

    this.log('sp:linkPosAndOrder', msg, {
      linkType: linkType,
      ownPosId: ownPosId,
      ownOrderId: ownOrderId,
    });
    return true;
  };

  historyCollectedLastTime = 0;
  historyCollector = async () => {
    if ((await this.historyCollector()) === false) {
      return false;
    }

    let cntPositions = 0;
    let cntOrders = 0;
    for (let [key, pos] of this.positionsById) {
      if (pos.status === 'closed') {
        this.historyPositionsById.set(key, pos);
        this.positionsById.delete(key);
        cntPositions++;
      } else {
        this.historyPositionsById.set(key, null);
      }
    }

    this.log('sp:historyCollector', '', { cntPositions: cntPositions, cntOrders: cntOrders });
  };

  getAllPositions = () => {
    //positionsById and historyPositionsById
    let positions = [];
    for (let [key, pos] of this.historyPositionsById) {
      if (pos) {
        positions.push(pos);
      } else {
        positions.push(this.positionsById.get(key));
      }
    }
    for (let [key, pos] of this.positionsById) {
      if (this.historyPositionsById.has(key) === false) {
        positions.push(pos);
      }
    }

    return positions;
  };

  getPositionProfit = (id) => {
    let ownPos = this.getPositionById(id);

    if (!ownPos) return 0;

    if (ownPos.status === 'closed') {
      return ownPos.profit;
    }

    if (ownPos.side === 'long') {
      return;
      return (close() - ownPos.priceOpen) * ownPos.size;
    } else {
      return (ownPos.priceOpen - close()) * ownPos.size;
    }
  };

  gluePositions = () => {
    let positions = this.getOpenPositions();

    let posSlot = {};
    posSlot['short'] = { size: 0, entryPrice: 0 };
    posSlot['long'] = { size: 0, entryPrice: 0 };
    let sizeL = 0;
    let priceL = 0;
    let sizeS = 0;
    let priceS = 0;

    for (let pos of positions) {
      if (pos.side === 'long') {
        sizeL += pos.size;
        priceL += pos.entryPrice * pos.size;
      } else {
        sizeS += pos.size;
        priceS += pos.entryPrice * pos.size;
      }
    }

    if (sizeS > 0) {
      posSlot['short'] = {
        size: sizeS,
        entryPrice: priceS / sizeS,
      };
    }
    if (sizeL > 0) {
      posSlot['long'] = {
        size: sizeL,
        entryPrice: priceL / sizeL,
      };
    }

    let posBuy = posSlot['long'] ?? { size: 0, entryPrice: 0 };
    let posSell = posSlot['short'] ?? { size: 0, entryPrice: 0 };
    let onePos = { size: 0, entryPrice: 0 };

    onePos.size = posBuy.size - posSell.size;
    onePos.entryPrice = (posBuy.size * posBuy.entryPrice - posSell.size * posSell.entryPrice) / onePos.size;

    posSlot['one'] = onePos;

    return posSlot;
  };
}
