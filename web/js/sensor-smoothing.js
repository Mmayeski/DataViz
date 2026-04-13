/**
 * sensor-smoothing.js
 * Low-pass filter and dead-zone utilities for smoothing noisy sensor input.
 */

/**
 * First-order IIR (infinite impulse response) low-pass filter.
 *
 * Each call to `apply()` blends the new sample with the previous output:
 *   output = alpha * newValue + (1 - alpha) * previousOutput
 *
 * A smaller alpha produces heavier smoothing (slower response).
 */
export class LowPassFilter {
    /**
     * @param {number} [alpha=0.2] - Smoothing factor in the range (0, 1].
     *   Values closer to 0 give heavier smoothing; 1 means no smoothing.
     */
    constructor(alpha = 0.2) {
        this.alpha = alpha;
        this._previous = null;
    }

    /**
     * Feed a new raw sample and return the filtered value.
     * @param {number} newValue - The latest sensor reading.
     * @returns {number} Smoothed value.
     */
    apply(newValue) {
        if (this._previous === null) {
            this._previous = newValue;
            return newValue;
        }
        this._previous = this.alpha * newValue + (1 - this.alpha) * this._previous;
        return this._previous;
    }

    /** Reset the filter so the next sample is treated as the first. */
    reset() {
        this._previous = null;
    }
}

/**
 * Dead-zone function: returns 0 when the absolute value of the input
 * is below the given threshold, otherwise returns the original value.
 *
 * Useful for ignoring sensor noise or tiny joystick drift.
 *
 * @param {number} value - Raw input value.
 * @param {number} threshold - Values with |value| < threshold are zeroed.
 * @returns {number} 0 if within the dead zone, otherwise `value`.
 */
export function deadZone(value, threshold) {
    return Math.abs(value) < threshold ? 0 : value;
}
