import { error } from '../log';

/**
 * Rounds timestamp to the nearest timeframe (in milliseconds)
 * @param timestamp - timestamp in milliseconds
 * @param tfMin - timeframe in minutes (1, 5, 15, 60, 240, 1440, 10080, 43200)
 * @returns {number}
 */
export function roundTimeByTimeframe(timestamp: number, tfMin: number): number {
  tfMin = tfMin * 60 * 1000;
  return Math.floor(timestamp / tfMin) * tfMin;
}

// /**
//  *  Rounds timestamp to the nearest timeframe
//  * @param timestamp - timestamp in milliseconds
//  * @param tfMin - timeframe in minutes (1, 5, 15, 60, 240)
//  * @returns {number|null} - rounded timestamp in milliseconds
//  */
// export const roundTimeframe = (timestamp: number, tfMin: number): number | null => {
//   const date = new Date(timestamp);
//   const currentMinutes = date.getMinutes();
//   const currentHours = date.getHours();
//   date.setSeconds(0);
//   date.setMilliseconds(0);
//
//   switch (tfMin) {
//     case 1: {
//       return date.getTime();
//     }
//     case 5: {
//       if (currentMinutes < 5) {
//         date.setMinutes(0);
//         return date.getTime();
//       }
//       if (currentMinutes < 10) {
//         date.setMinutes(5);
//         return date.getTime();
//       }
//       if (currentMinutes < 15) {
//         date.setMinutes(10);
//         return date.getTime();
//       }
//       if (currentMinutes < 20) {
//         date.setMinutes(15);
//         return date.getTime();
//       }
//       if (currentMinutes < 25) {
//         date.setMinutes(20);
//         return date.getTime();
//       }
//       if (currentMinutes < 30) {
//         date.setMinutes(25);
//         return date.getTime();
//       }
//       if (currentMinutes < 35) {
//         date.setMinutes(30);
//         return date.getTime();
//       }
//       if (currentMinutes < 40) {
//         date.setMinutes(35);
//         return date.getTime();
//       }
//       if (currentMinutes < 45) {
//         date.setMinutes(40);
//         return date.getTime();
//       }
//       if (currentMinutes < 50) {
//         date.setMinutes(45);
//         return date.getTime();
//       }
//       if (currentMinutes < 55) {
//         date.setMinutes(50);
//         return date.getTime();
//       }
//       if (currentMinutes < 60) {
//         date.setMinutes(55);
//         return date.getTime();
//       }
//       return null;
//     }
//     case 15: {
//       if (currentMinutes < 15) {
//         date.setMinutes(0);
//         return date.getTime();
//       }
//       if (currentMinutes < 30) {
//         date.setMinutes(15);
//         return date.getTime();
//       }
//       if (currentMinutes < 45) {
//         date.setMinutes(30);
//         return date.getTime();
//       }
//       if (currentMinutes < 60) {
//         date.setMinutes(45);
//         return date.getTime();
//       }
//       return null;
//     }
//     case 60: {
//       date.setMinutes(0);
//       return date.getTime();
//     }
//     case 240: {
//       date.setMinutes(0);
//       if (currentHours < 4) {
//         date.setHours(0);
//         return date.getTime();
//       }
//       if (currentHours < 8) {
//         date.setHours(4);
//         return date.getTime();
//       }
//       if (currentHours < 12) {
//         date.setHours(8);
//         return date.getTime();
//       }
//       if (currentHours < 16) {
//         date.setHours(12);
//         return date.getTime();
//       }
//       if (currentHours < 20) {
//         date.setHours(16);
//         return date.getTime();
//       }
//       if (currentHours < 24) {
//         date.setHours(20);
//         return date.getTime();
//       }
//       return null;
//     }
//     default: {
//       return null;
//     }
//   }
// };

const timeframeMapString = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w',
  '1M': '1M',
  m1: '1m',
  m5: '5m',
  m15: '15m',
  m60: '1h',
  m240: '4h',
  m1440: '1d',
  m10080: '1w',
  m43200: '1M',
  h1: '1h',
  h4: '4h',
  d1: '1d',
  w1: '1w',
  M1: '1M',
};
const timeframeMapNumber = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
  '1w': 10080,
  '1M': 43200,
  m1: 1,
  m5: 5,
  m15: 15,
  h1: 60,
  h4: 240,
  d1: 1440,
  w1: 10080,
  M1: 43200,
};

/**
 * Converts timeframe to string
 * @param timeframe - timeframe in minutes (1, 5, 15, 60, 240, 1440, 10080, 43200)
 * @returns {*} ('1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M')
 */
export const convertTimeframeToString = (timeframe: string | number): string => {
  if (typeof timeframe === 'string') {
    return timeframeMapString[timeframe];
  }
  if (typeof timeframe === 'number') {
    return timeframeMapString[`m${timeframe}`];
  }
};

export const convertTimeframeToNumber = (timeframe: string | number): number => {
  if (typeof timeframe === 'string') {
    return timeframeMapNumber[timeframe];
  }
  if (typeof timeframe === 'number') {
    if (timeframeMapString[`m${timeframe}`]) return timeframe;
    else {
      error('convertTimeframeToNumber', `Timeframe ${timeframe} is not supported`);
      return null;
    }
  }
};

export function calculateCandlesInMonth(timeStart: number, tfMin = 1) {
  let date = new Date(timeStart);

  let startOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  let startOfMonthTimestamp = startOfMonth.getTime();

  let endOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  let endOfMonthTimestamp = endOfMonth.getTime() + 24 * 60 * 60 * 1000;

  // _consoleInfo(
  //   'calculateCandlesInMonth',
  //   'start ',
  //   timeToString(startOfMonthTimestamp),
  //   'end ',
  //   timeToString(endOfMonthTimestamp),
  // );

  return Math.ceil((endOfMonthTimestamp - startOfMonthTimestamp) / (tfMin * 60 * 1000));
}
