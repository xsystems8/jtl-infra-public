/**
 * Calculates profit of a long position
 * @param entryPrice - entry price of the position
 * @param closePrice - close price of the position
 * @param size - size of the position
 * @returns {number} - profit
 */
export function longProfit(entryPrice: number, closePrice: number, size: number): number {
  return (closePrice - entryPrice) * size;
}

/**
 * Calculates profit of a short position
 * @param entryPrice - entry price of the position
 * @param closePrice - close price of the position
 * @param size - size of the position
 * @returns {number} - profit
 */
export function shortProfit(entryPrice: number, closePrice: number, size: number): number {
  return (entryPrice - closePrice) * size;
}

/**
 * Calculates profit percent of a long position
 * @param entryPrice - entry price of the position
 * @param closePrice - close price of the position
 * @returns {number} - profit percent
 */

export function longProfitPercent(entryPrice: number, closePrice: number): number {
  return ((closePrice - entryPrice) / entryPrice) * 100;
}

/**
 * Calculates profit percent of a short position
 * @param entryPrice - entry price of the position
 * @param closePrice - close price of the position
 * @returns {number} - profit percent
 */
export function shortProfitPercent(entryPrice: number, closePrice: number): number {
  return ((entryPrice - closePrice) / entryPrice) * 100;
}

/**
 * Calculates profit  of a position based on side
 * @param side - side of the position
 * @param entryPrice - entry price of the position
 * @param closePrice - close price of the position
 * @param size - size of the position
 * @returns {number} - profit percent
 * @example positionProfit('long', 100, 200, 1)  returns 100
 */
export function positionProfit(side: 'long' | 'short', entryPrice: number, closePrice: number, size: number): number {
  if (side === 'long') {
    return longProfit(entryPrice, closePrice, size);
  }
  if (side === 'short') {
    return shortProfit(entryPrice, closePrice, size);
  }
  return null;
}

/**
 * Calculates the current unrealized pnl of all open positions
 * unrealizedPnl - calculated by the exchange / tester
 * @returns {Promise<number>} - unrealized pnl
 * @example getCurrentUnrealizedPnl()  returns 12
 */
export async function getCurrentUnrealizedPnl(): Promise<number> {
  let positions = await getPositions();
  let pnl = 0;
  for (let i = 0; i < positions.length; i++) {
    pnl += positions[i].unrealizedPnl;
  }
  return pnl;
}

/**
 * Calculates the current drawdown pnl of all open positions
 * the same as getCurrentUnrealizedPnl()
 * @returns {Promise<number>} - drawdown
 */
export async function getCurrentDrawdownA(): Promise<number> {
  let positions = await getPositions();
  let drawdown = 0;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i].side === 'long') {
      drawdown += longProfit(positions[i].entryPrice, close(), positions[i].size);
    } else {
      drawdown += shortProfit(positions[i].entryPrice, close(), positions[i].size);
    }
  }
  return drawdown;
}
