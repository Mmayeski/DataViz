/**
 * chart-manager.js
 * Manages a Chart.js instance with support for dynamic chart type switching,
 * color scheme changes, data updates, and proximity-based zoom.
 */

import {
    ChartType,
    ColorScheme,
    getTemperatureColor,
    getSeasonColor,
    MONOCHROME_COLOR,
} from './chart-config.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const Y_AXIS_MIN = 20;
const Y_AXIS_MAX = 100;
const ANIMATION_DURATION = 300;

/**
 * Number of data points visible when fully zoomed in (zoomLevel === 0).
 * We show roughly 2-3 months at maximum zoom.
 */
const MIN_VISIBLE_POINTS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an array of per-element background colors based on the active scheme.
 * @param {Array} data - Data array with { averageHigh, monthIndex }.
 * @param {string} scheme - A ColorScheme value.
 * @returns {string[]} Array of CSS color strings.
 */
function buildColors(data, scheme) {
    switch (scheme) {
        case ColorScheme.TEMPERATURE:
            return data.map(d => getTemperatureColor(d.averageHigh));
        case ColorScheme.SEASONAL:
            return data.map(d => getSeasonColor(d.monthIndex));
        case ColorScheme.MONOCHROME:
        default:
            return data.map(() => MONOCHROME_COLOR);
    }
}

/**
 * Create a vertical gradient for the "area" chart fill.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} baseColor - CSS rgb() string used as the top color.
 * @returns {CanvasGradient}
 */
function createAreaGradient(ctx, baseColor) {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, baseColor.replace('rgb', 'rgba').replace(')', ', 0.5)'));
    gradient.addColorStop(1, baseColor.replace('rgb', 'rgba').replace(')', ', 0.02)'));
    return gradient;
}

// ---------------------------------------------------------------------------
// ChartManager
// ---------------------------------------------------------------------------

export class ChartManager {
    /**
     * @param {string} canvasId - The DOM id of the <canvas> element.
     */
    constructor(canvasId) {
        /** @type {HTMLCanvasElement} */
        this._canvas = document.getElementById(canvasId);

        /** @type {Chart|null} */
        this._chart = null;

        /** @type {Array} Current data snapshot. */
        this._data = [];

        /** @type {string} Active chart type. */
        this._chartType = ChartType.BAR;

        /** @type {string} Active color scheme. */
        this._colorScheme = ColorScheme.TEMPERATURE;

        /** @type {number} Current zoom level (0 = zoomed in, 1 = zoomed out). */
        this._zoomLevel = 1.0;

        /** @type {number|null} Focused month index for zoom centering. */
        this._focusedMonth = null;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Initialise the chart with an initial data set.
     * @param {Array<{month: string, monthIndex: number, averageHigh: number, averageLow: number}>} data
     */
    init(data) {
        this._data = data;
        this._createChart();
    }

    /**
     * Replace the current data set (e.g. after sort / filter).
     * @param {Array} data
     */
    updateData(data) {
        this._data = data;
        this._applyData();
    }

    /**
     * Switch the chart visualisation type.
     * @param {'bar'|'line'|'area'} chartType - A ChartType value.
     */
    setChartType(chartType) {
        if (this._chartType === chartType) return;
        this._chartType = chartType;

        // Chart.js doesn't allow changing type in-place — rebuild.
        this._rebuildChart();
    }

    /**
     * Switch the color scheme used for bars / points / fills.
     * @param {'temperature'|'monochrome'|'seasonal'} colorScheme
     */
    setColorScheme(colorScheme) {
        if (this._colorScheme === colorScheme) return;
        this._colorScheme = colorScheme;
        this._applyColors();
    }

    /**
     * Adjust the visible x-axis range based on proximity zoom.
     * @param {number} zoomLevel - 0.0 (fully zoomed in) to 1.0 (all data visible).
     * @param {number|null} focusedMonthIndex - 0-11, center of the zoom window.
     */
    setZoom(zoomLevel, focusedMonthIndex) {
        this._zoomLevel = zoomLevel;
        this._focusedMonth = focusedMonthIndex;
        this._applyZoom();
    }

    /** Tear down the Chart.js instance and release resources. */
    destroy() {
        if (this._chart) {
            this._chart.destroy();
            this._chart = null;
        }
    }

    // -----------------------------------------------------------------------
    // Private — chart creation
    // -----------------------------------------------------------------------

    /** Build the Chart.js configuration object and instantiate the chart. */
    _createChart() {
        const ctx = this._canvas.getContext('2d');
        const labels = this._data.map(d => d.month);
        const values = this._data.map(d => d.averageHigh);
        const colors = buildColors(this._data, this._colorScheme);

        const datasetConfig = this._buildDatasetConfig(values, colors, ctx);

        this._chart = new Chart(ctx, {
            type: this._chartJsType(),
            data: {
                labels,
                datasets: [datasetConfig],
            },
            options: this._buildOptions(),
        });
    }

    /** Destroy and recreate the chart (needed when changing chart type). */
    _rebuildChart() {
        if (!this._chart) return;
        this.destroy();
        this._createChart();
        this._applyZoom();
    }

    // -----------------------------------------------------------------------
    // Private — dataset helpers
    // -----------------------------------------------------------------------

    /**
     * Map our ChartType to the Chart.js type string.
     * 'area' is rendered as a 'line' chart with fill enabled.
     */
    _chartJsType() {
        return this._chartType === ChartType.AREA ? 'line' : this._chartType;
    }

    /**
     * Build the dataset object for the current chart type.
     * @param {number[]} values
     * @param {string[]} colors
     * @param {CanvasRenderingContext2D} ctx
     * @returns {object}
     */
    _buildDatasetConfig(values, colors, ctx) {
        const base = {
            label: 'Average High (°F)',
            data: values,
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 2,
        };

        switch (this._chartType) {
            case ChartType.LINE:
                return {
                    ...base,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: colors,
                    pointRadius: 4,
                };

            case ChartType.AREA: {
                // For area, use a gradient fill based on the first color.
                const gradientColor = colors[0] || MONOCHROME_COLOR;
                const gradient = createAreaGradient(ctx, gradientColor);
                return {
                    ...base,
                    fill: true,
                    backgroundColor: gradient,
                    tension: 0.4,
                    pointBackgroundColor: colors,
                    pointRadius: 4,
                };
            }

            case ChartType.BAR:
            default:
                return {
                    ...base,
                    borderRadius: 4,
                    borderSkipped: false,
                };
        }
    }

    /** Build the shared Chart.js options object. */
    _buildOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: ANIMATION_DURATION,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.parsed.y}°F`,
                    },
                },
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.08)',
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                    },
                },
                y: {
                    min: Y_AXIS_MIN,
                    max: Y_AXIS_MAX,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.08)',
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: (value) => `${value}°F`,
                    },
                },
            },
        };
    }

    // -----------------------------------------------------------------------
    // Private — dynamic updates
    // -----------------------------------------------------------------------

    /** Push current _data into the existing chart and update. */
    _applyData() {
        if (!this._chart) return;

        const labels = this._data.map(d => d.month);
        const values = this._data.map(d => d.averageHigh);
        const colors = buildColors(this._data, this._colorScheme);
        const ctx = this._canvas.getContext('2d');

        this._chart.data.labels = labels;

        const ds = this._chart.data.datasets[0];
        ds.data = values;
        ds.backgroundColor = this._chartType === ChartType.AREA
            ? createAreaGradient(ctx, colors[0] || MONOCHROME_COLOR)
            : colors;
        ds.borderColor = colors;
        ds.pointBackgroundColor = colors;

        this._chart.update('active');
    }

    /** Reapply colors without changing data. */
    _applyColors() {
        if (!this._chart) return;

        const colors = buildColors(this._data, this._colorScheme);
        const ctx = this._canvas.getContext('2d');
        const ds = this._chart.data.datasets[0];

        ds.backgroundColor = this._chartType === ChartType.AREA
            ? createAreaGradient(ctx, colors[0] || MONOCHROME_COLOR)
            : colors;
        ds.borderColor = colors;
        ds.pointBackgroundColor = colors;

        this._chart.update('active');
    }

    /** Adjust x-axis min/max based on current zoom and focused month. */
    _applyZoom() {
        if (!this._chart) return;

        const total = this._data.length;
        if (total === 0) return;

        const xScale = this._chart.options.scales.x;

        if (this._zoomLevel >= 0.99) {
            // Fully zoomed out — show everything.
            xScale.min = undefined;
            xScale.max = undefined;
        } else {
            // Number of visible points: interpolate between MIN_VISIBLE_POINTS
            // and total based on zoomLevel.
            const visibleCount = Math.round(
                MIN_VISIBLE_POINTS + this._zoomLevel * (total - MIN_VISIBLE_POINTS)
            );

            // Center on focusedMonth if available, else center of data.
            let centerIndex;
            if (this._focusedMonth !== null) {
                // Find the data index whose monthIndex matches focusedMonth.
                const match = this._data.findIndex(d => d.monthIndex === this._focusedMonth);
                centerIndex = match >= 0 ? match : Math.floor(total / 2);
            } else {
                centerIndex = Math.floor(total / 2);
            }

            const half = Math.floor(visibleCount / 2);
            let minIdx = centerIndex - half;
            let maxIdx = minIdx + visibleCount - 1;

            // Clamp to data bounds.
            if (minIdx < 0) {
                minIdx = 0;
                maxIdx = Math.min(total - 1, visibleCount - 1);
            }
            if (maxIdx >= total) {
                maxIdx = total - 1;
                minIdx = Math.max(0, maxIdx - visibleCount + 1);
            }

            // Chart.js category scale accepts label values for min/max.
            xScale.min = this._chart.data.labels[minIdx];
            xScale.max = this._chart.data.labels[maxIdx];
        }

        this._chart.update('active');
    }
}
