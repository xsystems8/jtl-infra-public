# Exchange
___

Exchange class for working with orders on exchange. In this class realized next features:
  * Triggered orders
  * Automate cancel stop orders if one of them executed

___

* **Methods**
  - [createOrder](#createOrder)
  - [createTriggeredOrder](#createTriggeredOrder)
  - [createReduceOrder](#createReduceOrder)
  - [createSlTpByOwnerOrder](#createSlTpByOwnerOrder)
  - [createStopLossOrder](#createStopLossOrder)
  - [createTakeProfitOrder](#createTakeProfitOrder)
  - [cancelOrder](#cancelOrder)
  - [modifyOrder](#modifyOrder)
  - [getOrderById](#getOrderById)
  - [buyMarket](#buyMarket)
  - [sellMarket](#sellMarket)
  - [buyLimit](#buyLimit)
  - [sellLimit](#sellLimit)

<br>

## [Constructor](#Constructor)

```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true })
```

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `exchange`: \<_string_> - Exchange on which trading will take place.
  - `hedgeMode?`: \<_boolean_> - Determines whether the mode of opening a position in both directions is enabled on the exchange.
  - `prefix?`: \<_string_> - The prefix is used to generate the clientOrderId. Scripts with the market launch type will only receive orders created with this prefix.

___

<br>

## [createOrder](#createOrder)

Create order on exchange.

```typescript
createOrder(symbol: string, type: OrderType, side: OrderSide, amount: number, price: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `type`: \<_[OrderType](trading-api.md#OrderType)_> - `market` or `limit`.
  - `side`: \<_[OrderSide](trading-api.md#OrderSide)_> - `buy` or `sell`.
  - `amount`: \<_number_> - Order amount.
  - `price`: \<_number_> - Order price.
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.


###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.createOrder('ETH/USDT', 'market', 'buy', 0.5, 2200);
```

___

<br>

## [createTriggeredOrder](#createTriggeredOrder)

This function uses our own library for working with trigger orders. 

> Note: 
It is important to note that these **orders are not placed directly into the exchange's order book**. 
Instead, they are **stored locally** and are activated only when the market price reaches the specified trigger price. 
Once activated, the corresponding order (market or limit) is sent to the exchange for execution.

```typescript
createTriggerOrder(symbol: string, type: OrderType, side: OrderSide, amount: number, price: number, triggerPrice: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string>_ - Trading symbol name.
  - `type`: \<_[OrderType](trading-api.md#OrderType)_> - `market` or `limit`.
  - `side`: \<_[OrderSide](trading-api.md#OrderSide)_> - `buy` or `sell`.
  - `amount`: \<_number_> - Order amount.
  - `price`: \<_number_> - Order price (used only for limit orders).
  - `triggerPrice`: \<_number_> - Trigger price.
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const triggeredOrder = await exchange.createTriggeredOrder('ETH/USDT', 'market', 'buy', 0.5, 2200, 2200);
```

___

<br>

## [createReduceOrder](#createReduceOrder)

Create reduce only order (close position).

```typescript
createReduceOrder(symbol: string, type: OrderType, side: OrderSide, amount: number, price: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string>_ - Trading symbol name.
  - `type`: \<_[OrderType](trading-api.md#OrderType)_> - `market` or `limit`.
  - `side`: \<_[OrderSide](trading-api.md#OrderSide)_> - `buy` or `sell`.
  - `amount`: \<_number_> - Order amount.
  - `price`: \<_number_> - Order price.
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const reduceOrder = await exchange.createReduceOrder('ETH/USDT', 'market', 'buy', 0.5, 2200);
```

___

<br>

## [createSlTpByOwnerOrder](#createSlTpByOwnerOrder)

Create stop loss and take profit orders by owner order id.

> Note: If owner order not executed yet, stop orders params saved and stop orders will be created 
when owner order executed (status = `closed`).
Also, if one of stop orders executed, another will be canceled (look at [onOrderChange](#onOrderChange)).

```typescript
createSlTpByOwnerOrder(symbol: string, type: OrderType, side: OrderSide, amount: number, price: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `type`: \<_[OrderType](trading-api.md#OrderType)_> - `market` or `limit`.
  - `side`: \<_[OrderSide](trading-api.md#OrderSide)_> - `buy` or `sell`.
  - `amount`: \<_number_> - Order amount.
  - `price`: \<_number_> - Order price.
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<Array<[Order](trading-api.md#order)>>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.createSlTpByOwnerOrder('ETH/USDT', 'market', 'buy', 0.5, 2200);
```
___

<br>

## [createStopLossOrder](#createStopLossOrder)

Create stop loss order (close position).
> Note: Stop loss order could be only `market` type

```typescript
createStopLossOrder(symbol: string, type: OrderType, sideToClose: OrderSide, amount: number, triggerPrice: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `type`: \<_[OrderType](trading-api.md#OrderType)_> - `market` or `limit`.
  - `sideToClose`: \<_[OrderSide](trading-api.md#OrderSide)_> - `buy` or `sell` - side of order to close. If you want to close buy order, you need pass 'buy' to this param so stop loss order will be sell order.
  - `amount`: \<_number_> - Order amount.
  - `triggerPrice`: \<_number_> - Trigger price (stop loss price).
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const slOrder = await exchange.createStopLossOrder('ETH/USDT', 'market', 'sell', 0.5, 2200);
```

___

<br>

## [createTakeProfitOrder](#createTakeProfitOrder)

Create take profit order (close position).
> Note: Take profit order could be only `market` type

```typescript
createTakeProfitOrder(symbol: string, type: OrderType, sideToClose: OrderSide, amount: number, triggerPrice: number, params?: Record<string, unknown>): Promise<Order>
``` 

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `type`: \<_[OrderType](trading-api.md#OrderType)_> - `market` or `limit`.
  - `sideToClose`: \<_[OrderSide](trading-api.md#OrderSide)_> - `buy` or `sell` - side of order to close. If you want to close buy order, you need pass 'buy' to this param so stop loss order will be sell order.
  - `amount`: \<_number_> - Order amount.
  - `triggerPrice`: \<_number_> - Trigger price (stop loss price).
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const slOrder = await exchange.createTakeProfitOrder('ETH/USDT', 'market', 'sell', 0.5, 2200);
```

___

<br>

## [cancelOrder](#cancelOrder)

Cancel order by id

```typescript
cancelOrder(orderId: string, symbol: string): Promise<Order>
```

* **Parameters**
  - `orderId`: \<_string_> - Order id.
  - `symbol`: \<_string_> - Symbol name.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.createOrder('ETH/USDT', 'market', 'buy', 0.5, 2200);
// ...

await exchange.cancelOrder(order.id, 'market');
```

___

<br>

## [modifyOrder](#modifyOrder)

Modify order by id (change price, amount).

```typescript
modifyOrder(orderId: string, symbol: string, type: OrderType, side: OrderSide, amount: number, price: number): Promise<Order>
```

* **Parameters**
  - `orderId`: \<_string_> - Order id.
  - `symbol`: \<_string_> - Trading symbol name.
  - `type`: \<_[OrderType](trading-api.md#OrderType)_> - `market` or `limit`.
  - `side`: \<_[OrderSide](trading-api.md#OrderSide)_> - `buy` or `sell`.
  - `amount`: \<_number_> - Order amount.
  - `price`: \<_number_> - Order price.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.createOrder('ETH/USDT', 'market', 'buy', 0.5, 2200);

const modifiedOrder = await exchange.modifyOrder(order.id, 'ETH/USDT', 'buy', 1, 2200);
```

___

<br>

## [getOrderById](#getOrderById)

Get order by id or client order id.

```typescript
getOrderById(orderId: stirng): Promise<Order>
```

* **Parameters**
  - `orderId`: \<_string_> - Order id.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.getOrderById('orderId');
```

___

<br>

## [buyMarket](#buyMarket)

Create market buy order.

```typescript
buyMarket(symbol: string, amount: number, sl: number, tp: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `amount`: \<_number_> - Order amount.
  - `sl`: \<_number_> - Stop loss price. If `sl = 0`, stop loss order will not be created.
  - `tp`: \<_number_> - Take profit price. If `tp = 0`, take profit order will not be created.
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.buyMarket('ETH/USDT', 1, 2150, 2200);
```

___

<br>

## [sellMarket](#sellMarket)

Create market sell order.

```typescript
sellMarket(symbol: string, amount: number, sl: number, tp: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `amount`: \<_number_> - Order amount.
  - `sl`: \<_number_> - Stop loss price. If `sl = 0`, stop loss order will not be created.
  - `tp`: \<_number>_ - Take profit price. If `tp = 0`, take profit order will not be created.
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.sellMarket('ETH/USDT', 1, 2200, 2150);
```

___

<br>

## [buyLimit](#buyLimit)

Create limit buy order.

```typescript
butLimit(symbol: string, amount: number, price: number, sl: number, tp: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `amount`: \<_number_> - Order amount.
  - `price`: \<_number_> - Order execution price.
  - `sl`: \<_number_> - Stop loss price. If `sl = 0`, stop loss order will not be created.
  - `tp`: \<_number_> - Take profit price. If `tp = 0`, take profit order will not be created.
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.buyLimit('ETH/USDT', 1, 2200, 2150, 2300);
```

___

<br>

## [sellLimit](#sellLimit)

Create limit sell order.

```typescript
sellLimit(symbol: string, amount: number, price: number, sl: number, tp: number, params?: Record<string, unknown>): Promise<Order>
```

* **Parameters**
  - `symbol`: \<_string_> - Trading symbol name.
  - `amount`: \<_number_> - Order amount.
  - `price`: \<_number_> - Order execution price.
  - `sl`: \<_number_> - Stop loss price. If `sl = 0`, stop loss order will not be created.
  - `tp`: \<_number_> - Take profit price. If `tp = 0`, take profit order will not be created.
  - `params?`: \<_Record<string, unknown>_> - Params for [createOrder](trading-api.md#createOrder) function.


* **Returns:** _Promise<[Order](trading-api.md#order)>_.

###### Example
```typescript
const exchange = new Exchange({ symbol: 'ETH/USDT', exchange: 'binance', hedgeMode: true });
const order = await exchange.sellLimit('ETH/USDT', 1, 2200, 2300, 2150);
```

___

<br>

















