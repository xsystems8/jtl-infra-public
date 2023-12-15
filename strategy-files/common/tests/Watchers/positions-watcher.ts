import { global } from '../../global';
import { checkPositionStructure } from '../helpers';
import { Watcher } from './watcher';
import { isZero } from '../../utils/numbers';

import { errorOnce } from '../../log';

export class PositionsWatcher extends Watcher {
  private isHedged: boolean;
  private isPositionsUpdated: boolean;

  constructor() {
    super();

    global.events.subscribe('onOrderChange', this.onOrderChange, this);
    global.events.subscribe('onTickEnded', this.checkPositions, this);
    global.events.subscribe('onTickEnded', this.addSizeToChart, this);
  }

  onOrderChange = async (order) => {
    await this._updatePosSlot(order); //updatePosition -> checkPosition
  };

  _updatePosSlot = async (order) => {
    if (order.status !== 'filled' && order.status !== 'closed') {
      return;
    }

    this.isHedged = true;

    let posSide = 'both'; //
    let isReduce = order.reduceOnly;
    let side = order.side === 'buy' ? 'long' : 'short';
    if (isReduce) side = side === 'long' ? 'short' : 'long';
    if (this.isHedged) posSide = side;

    let posSlot = this.getPosSlot(posSide);
    if (!posSlot.side) posSlot.side = side;

    if (isReduce) {
      if (order.side === 'sell') {
        posSlot.profit += order.amount * (order.price - posSlot.entryPrice);
      } else {
        posSlot.profit += order.amount * (posSlot.entryPrice - order.price);
      }
    }

    if (!isReduce) {
      posSlot.entryPrice =
        (posSlot.size * posSlot.entryPrice + order.amount * order.price) / (posSlot.size + order.amount);
      posSlot.size += order.amount;
    } else {
      if (posSlot.size - order.amount === 0) {
        posSlot.entryPrice = 0;
      }
      posSlot.size -= order.amount;
    }

    posSlot.size = isZero(posSlot.size) ? 0 : posSlot.size;

    if (posSlot.size < 0) {
      errorOnce('basket:updatePosSlot', 'posSlot.size < 0', {
        posSlot: posSlot,
        order: order,
      });
    }
    // _consoleInfo('ob:updatePosSlot', 'posSlot.size', { posSlot: posSlot });
    // ko();
    this._posSlot[posSide] = posSlot;
    this.isPositionsUpdated = true;
  };

  _posSlot = {};
  getPosSlot(posSide = 'both') {
    // _consoleInfo('ob:getPosSlot', 'getPosSlot', { slot: posSide, side: side });
    if (!this._posSlot[posSide]) {
      this._posSlot[posSide] = {
        side: '',
        size: 0,
        entryPrice: 0,
        profit: 0,
      };
    }
    return this._posSlot[posSide];
  }
  checkPositions = async () => {
    let positions = await getPositions();

    if (positions.length > 2) {
      this.errorOnce('checkPositions', 'positions.length > 2 || maximum 2 slots (short,long)', {
        positions: positions,
      });
    }

    for (let pos of positions) {
      let ownPos = this.isHedged ? this.getPosSlot(pos.side) : this.getPosSlot('both');

      //size
      if (isZero(pos.size - ownPos.size)) {
        this.errorOnce('checkPositions', 'pos.size != ownPos.size', { positions: positions, ownPos: ownPos });
      }
      //entryPrice
      if (isZero(pos.entryPrice - ownPos.entryPrice)) {
        this.errorOnce('checkPositions', 'pos.entryPrice != ownPos.entryPrice', {
          positions: positions,
          ownPos: ownPos,
        });
      }

      //check structure
      this.addErrors(checkPositionStructure(pos));
    }
  };

  addSizeToChart = async () => {
    if (!this.isPositionsUpdated) {
      return;
    } else {
      this.isPositionsUpdated = false;
    }
    let positions = await getPositions();

    let buySize = 0;
    let sellSize = 0;
    let bothSize = 0;
    for (let pos of positions) {
      if (pos.side === 'long') {
        buySize += pos.contracts;
      }
      if (pos.side === 'short') {
        sellSize += pos.contracts;
      }
      bothSize += pos.contracts;
    }
    if (this.isHedged) {
      global.report.chartAddPoint('Positions size', 'Calc long', this._posSlot['long']?.size ?? 0);
      global.report.chartAddPoint('Positions size', 'Calc short', this._posSlot['short']?.size ?? 0);

      global.report.chartAddPoint('Positions size', 'Real long', buySize);
      global.report.chartAddPoint('Positions size', 'Real short', sellSize);
    } else {
      global.report.chartAddPoint('Positions size', 'Calc both', this._posSlot['both']?.size ?? 0);
      global.report.chartAddPoint('Positions size', 'Real both', bothSize);
    }
  };
}
