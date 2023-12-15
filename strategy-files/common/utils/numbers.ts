const DEFAULT_TOLERANCE = 0.000000001;
/**
 * Normalize a number to a given number of digits
 * @param number The number to normalize
 * @param digits The number of digits to normalize to
 * @returns {number} The normalized number
 * @example normalize(1.23456789, 4) // 1.2346
 */
export const normalize = (number: number, digits = 2): number => {
  return parseFloat(number.toFixed(digits));
};

/**
 * Check if a number is zero
 * @param number The number to check
 * @param tolerance The tolerance to use
 * @returns {boolean} True if the number is zero within the tolerance provided
 * @example isZero(0.000000000000005) // true
 */
export const isZero = (number: number, tolerance = DEFAULT_TOLERANCE): boolean => {
  return Math.abs(number) < tolerance;
};

//TODO add to manual information about tolerance why we use it
/**
 * Check if a number is equal to another number within a tolerance value
 * @param a The first number
 * @param b The second number
 * @param tolerance The tolerance to use for the comparison
 * @returns {boolean} True if the numbers are equal within the tolerance provided
 * @example isEqual(1.000000000000005, 1) // true
 */
export const isEqual = (a: number, b: number, tolerance = DEFAULT_TOLERANCE): boolean => {
  return Math.abs(a - b) < tolerance;
};

export function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function max(number: number, max: number) {
  return Math.min(number, max);
}

export function min(number: number, min: number) {
  return Math.max(number, min);
}
