export function checkPositionStructure(pos) {
  let structure = {
    id: 'string',
    symbol: 'string',
    contracts: 'number',
    contractSize: 'number',
    unrealizedPnl: 'number',
    leverage: 'number',
    liquidationPrice: 'number',
    collateral: 'number',
    notional: 'number',
    markPrice: 'number',
    entryPrice: 'number',
    timestamp: 'number',
    initialMargin: 'number',
    initialMarginPercentage: 'number',
    maintenanceMargin: 'number',
    maintenanceMarginPercentage: 'number',
    marginRatio: 'number',
    datetime: 'string',
    marginMode: 'string',
    marginType: 'string',
    side: 'string',
    hedged: 'boolean',
    percentage: 'number',
  };

  let keys = Object.keys(structure);
  //let posKeys = Object.keys(pos);
  let errors = [];

  for (const key of keys) {
    if (pos[key] === undefined) {
      errors.push({ event: 'checkPositionStructure', message: 'Position has no key: ' + key, params: { pos: pos } });
    }

    if (typeof pos[key] !== structure[key]) {
      errors.push({
        event: 'checkPositionStructure',
        message: 'Position has wrong type of key: ' + key + ' type should be ' + structure[key],
        params: { pos: pos },
      });
    }
  }

  let maxDigits = 100000;
  if (Math.round(pos.contracts * maxDigits) / maxDigits <= 0) {
    errors.push({
      event: 'checkPositionStructure',
      message: 'Position has wrong contracts: ' + pos.contracts,
      params: { pos: pos },
    });
  }

  if (pos.side !== 'long' && pos.side !== 'short') {
    errors.push({
      event: 'checkPositionStructure',
      message: 'Position has wrong side: ' + pos.side,
      params: { pos: pos },
    });
  }

  // if (pos.amount < 0 || !pos.amount) {
  //   errors.push({
  //     event: 'checkPositionStructure',
  //     message: 'Position has wrong amount: ' + pos.amount,
  //     params: { pos: pos },
  //   });
  // }
  //price
  if (pos.entryPrice < 0 || !pos.entryPrice) {
    errors.push({
      event: 'checkPositionStructure',
      message: 'Position has wrong price: ' + pos.entryPrice,
      params: { pos: pos },
    });
  }
  return errors;
}

export function checkOrderStructure(order) {
  let structure = {
    id: 'string',
    clientOrderId: 'string',
    datetime: 'string',
    timestamp: 'number',
    lastTradeTimestamp: 'number',
    status: 'string', //'open' | 'closed' | 'canceled' |
    symbol: 'string',
    type: 'string',
    timeInForce: 'string',
    side: 'string',
    price: 'number',
    average: 'number',
    amount: 'number',
    filled: 'number',
    remaining: 'number',
    cost: 'number',
    trades: 'any',
    fee: 'any',
    info: 'any',
    reduceOnly: 'boolean',
  };

  let orderProps = Object.keys(structure);
  //let orderKeys = Object.keys(order);
  let errors = [];

  for (const prop of orderProps) {
    if (order[prop] === undefined) {
      errors.push({ event: 'checkOrderStructure', message: 'Order has no key: ' + prop, params: { order: order } });
    }

    if (structure[prop] === 'any') continue;

    if (typeof order[prop] !== structure[prop]) {
      errors.push({
        event: 'checkOrderStructure',
        message: 'Order has wrong type of key: ' + prop + ' type should be ' + structure[prop],
        params: { order: order },
      });
    }
  }
  let maxDigits = 100000000;
  if (Math.round(order.amount * maxDigits) / maxDigits <= 0) {
    errors.push({
      event: 'checkOrderStructure',
      message: 'Order has wrong amount: ' + order.amount,
      params: { order: order },
    });
  }
  //price
  if (order.price < 0 || !order.price) {
    errors.push({
      event: 'checkOrderStructure',
      message: 'Order has wrong price: ' + order.price,
      params: { order: order },
    });
  }
  //side
  if (order.side !== 'buy' && order.side !== 'sell') {
    errors.push({
      event: 'checkOrderStructure',
      message: 'Order has wrong side: ' + order.side,
      params: { order: order },
    });
  }

  //amount
  if (order.amount <= 0 || !order.amount) {
    errors.push({
      event: 'checkOrderStructure',
      message: 'Order has wrong amount: ' + order.amount,
      params: { order: order },
    });
  }

  //status
  if (
    order.status !== 'open' &&
    order.status !== 'closed' &&
    order.status !== 'canceled' &&
    order.status !== 'expired' &&
    order.status !== 'rejected'
  ) {
    errors.push({
      event: 'checkOrderStructure',
      message: 'Order has wrong status: ' + order.status,
      params: { order: order },
    });
  }
  //type
  if (
    order.type !== 'limit' &&
    order.type !== 'market' &&
    order.type !== 'stop' &&
    order.type !== 'stop-limit' &&
    order.type !== 'trailing-stop' &&
    order.type !== 'fill-or-kill' &&
    order.type !== 'immediate-or-cancel'
  ) {
    errors.push({
      event: 'checkOrderStructure',
      message: 'Order has wrong type: ' + order.type,
      params: { order: order },
    });
  }
  return errors;
}
