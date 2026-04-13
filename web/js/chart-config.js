/**
 * chart-config.js
 * Enums, configuration, and helpers for chart types, sorting, filtering,
 * and color schemes.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ChartType = { BAR: 'bar', LINE: 'line', AREA: 'area' };
export const CHART_TYPES = [ChartType.BAR, ChartType.LINE, ChartType.AREA];

export const SortOrder = {
    CHRONOLOGICAL: 'chronological',
    HOTTEST_FIRST: 'hottestFirst',
    COLDEST_FIRST: 'coldestFirst',
};

export const MonthFilter = {
    ALL: 'all',
    FIRST_HALF: 'firstHalf',
    SECOND_HALF: 'secondHalf',
};

export const ColorScheme = {
    TEMPERATURE: 'temperature',
    MONOCHROME: 'monochrome',
    SEASONAL: 'seasonal',
};
export const COLOR_SCHEMES = [
    ColorScheme.TEMPERATURE,
    ColorScheme.MONOCHROME,
    ColorScheme.SEASONAL,
];

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/**
 * Cycle to the next value in an array, wrapping around.
 * @param {Array} array - The array to cycle through.
 * @param {*} current - The current value.
 * @returns {*} The next value in the array.
 */
export function cycleNext(array, current) {
    const idx = array.indexOf(current);
    return array[(idx + 1) % array.length];
}

/**
 * Return a human-readable label for any enum value used in this module.
 * @param {string} value - An enum string value.
 * @returns {string} Friendly label.
 */
export function getLabel(value) {
    const labels = {
        // ChartType
        bar: 'Bar',
        line: 'Line',
        area: 'Area',
        // SortOrder
        chronological: 'Chronological',
        hottestFirst: 'Hottest First',
        coldestFirst: 'Coldest First',
        // MonthFilter
        all: 'All Months',
        firstHalf: 'Jan \u2013 Jun',
        secondHalf: 'Jul \u2013 Dec',
        // ColorScheme
        temperature: 'Temperature',
        monochrome: 'Monochrome',
        seasonal: 'Seasonal',
    };
    return labels[value] ?? value;
}

/**
 * Return a sort-direction icon character for HUD display.
 * @param {string} sortOrder - A SortOrder value.
 * @returns {string} Arrow character.
 */
export function getSortIcon(sortOrder) {
    switch (sortOrder) {
        case SortOrder.HOTTEST_FIRST:  return '\u2193'; // ↓
        case SortOrder.COLDEST_FIRST:  return '\u2191'; // ↑
        case SortOrder.CHRONOLOGICAL:
        default:                       return '\u2192'; // →
    }
}

// ---------------------------------------------------------------------------
// Data transforms
// ---------------------------------------------------------------------------

/**
 * Filter a data array by month range.
 * @param {Array} data - Array of objects with a `monthIndex` property.
 * @param {string} filter - A MonthFilter value.
 * @returns {Array} Filtered (shallow-copied) array.
 */
export function applyFilter(data, filter) {
    switch (filter) {
        case MonthFilter.FIRST_HALF:
            return data.filter(d => d.monthIndex <= 5);
        case MonthFilter.SECOND_HALF:
            return data.filter(d => d.monthIndex >= 6);
        case MonthFilter.ALL:
        default:
            return [...data];
    }
}

/**
 * Sort a data array by the specified order. Returns a new array.
 * @param {Array} data - Array of objects with `monthIndex` and `averageHigh`.
 * @param {string} sortOrder - A SortOrder value.
 * @returns {Array} Sorted (shallow-copied) array.
 */
export function applySort(data, sortOrder) {
    const sorted = [...data];
    switch (sortOrder) {
        case SortOrder.HOTTEST_FIRST:
            return sorted.sort((a, b) => b.averageHigh - a.averageHigh);
        case SortOrder.COLDEST_FIRST:
            return sorted.sort((a, b) => a.averageHigh - b.averageHigh);
        case SortOrder.CHRONOLOGICAL:
        default:
            return sorted.sort((a, b) => a.monthIndex - b.monthIndex);
    }
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** A pleasant blue used for monochrome charts. */
export const MONOCHROME_COLOR = 'rgb(59, 130, 246)';

/**
 * Map a temperature to a color, interpolating from blue (30 F) to red (95 F).
 * @param {number} temp - Temperature in degrees Fahrenheit.
 * @returns {string} CSS rgb() color string.
 */
export function getTemperatureColor(temp) {
    // Clamp to [30, 95] range, then normalise to [0, 1].
    const t = Math.max(0, Math.min(1, (temp - 30) / (95 - 30)));

    // Blue (cold) -> Red (hot) via a simple linear interpolation.
    const r = Math.round(59  + t * (239 - 59));
    const g = Math.round(130 - t * 130);
    const b = Math.round(246 - t * 246);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Return a season-based color for a given month index.
 * @param {number} monthIndex - 0 = January, 11 = December.
 * @returns {string} CSS rgb() color string.
 */
export function getSeasonColor(monthIndex) {
    const colors = {
        winter: 'rgb(96, 165, 250)',   // blue
        spring: 'rgb(74, 222, 128)',   // green
        summer: 'rgb(251, 146, 60)',   // orange
        fall:   'rgb(180, 120, 60)',   // brown
    };

    // Inline season logic to avoid a cross-module dependency.
    let season;
    if (monthIndex === 11 || monthIndex <= 1) season = 'winter';
    else if (monthIndex <= 4) season = 'spring';
    else if (monthIndex <= 7) season = 'summer';
    else season = 'fall';

    return colors[season];
}
