/**
 * temperature-data.js
 * Baltimore MD average monthly temperature data and helpers.
 */

export const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MONTH_FULL_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export const baltimoreData = [
    { month: 'Jan', monthIndex: 0,  averageHigh: 43, averageLow: 32 },
    { month: 'Feb', monthIndex: 1,  averageHigh: 47, averageLow: 34 },
    { month: 'Mar', monthIndex: 2,  averageHigh: 56, averageLow: 41 },
    { month: 'Apr', monthIndex: 3,  averageHigh: 67, averageLow: 50 },
    { month: 'May', monthIndex: 4,  averageHigh: 76, averageLow: 60 },
    { month: 'Jun', monthIndex: 5,  averageHigh: 85, averageLow: 69 },
    { month: 'Jul', monthIndex: 6,  averageHigh: 90, averageLow: 74 },
    { month: 'Aug', monthIndex: 7,  averageHigh: 87, averageLow: 72 },
    { month: 'Sep', monthIndex: 8,  averageHigh: 80, averageLow: 65 },
    { month: 'Oct', monthIndex: 9,  averageHigh: 69, averageLow: 53 },
    { month: 'Nov', monthIndex: 10, averageHigh: 57, averageLow: 43 },
    { month: 'Dec', monthIndex: 11, averageHigh: 46, averageLow: 34 },
];

/**
 * Returns the season name for a given month index (0-11).
 * @param {number} monthIndex - 0 = January, 11 = December
 * @returns {'winter'|'spring'|'summer'|'fall'}
 */
export function getSeason(monthIndex) {
    if (monthIndex === 11 || monthIndex <= 1) return 'winter';  // Dec, Jan, Feb
    if (monthIndex <= 4) return 'spring';                        // Mar, Apr, May
    if (monthIndex <= 7) return 'summer';                        // Jun, Jul, Aug
    return 'fall';                                                // Sep, Oct, Nov
}
