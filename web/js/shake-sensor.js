/**
 * shake-sensor.js
 * Detects shake gestures via the DeviceMotion API and cycles chart type /
 * color scheme on successive shakes.
 */

import { ChartType, ColorScheme, CHART_TYPES, COLOR_SCHEMES, cycleNext } from './chart-config.js';

const SHAKE_THRESHOLD          = 25;  // m/s^2 — for pure acceleration
const SHAKE_THRESHOLD_GRAVITY  = 35;  // m/s^2 — fallback when only accelerationIncludingGravity is available
const DEBOUNCE_MS              = 500;

export class ShakeSensor {
    constructor() {
        /** @type {Function|null} Called after a shake is detected. */
        this.onShake = null;

        this._shakeCount       = 0;
        this._currentChartType  = ChartType.BAR;
        this._currentColorScheme = ColorScheme.TEMPERATURE;

        this._lastShakeTime = 0;
        this._listening     = false;
        this._handler       = this._onDeviceMotion.bind(this);
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /** Start listening for devicemotion events. */
    start() {
        if (this._listening) return;
        window.addEventListener('devicemotion', this._handler);
        this._listening = true;
    }

    /** Stop listening for devicemotion events. */
    stop() {
        if (!this._listening) return;
        window.removeEventListener('devicemotion', this._handler);
        this._listening = false;
    }

    // ------------------------------------------------------------------
    // Read-only state
    // ------------------------------------------------------------------

    /** Total number of shakes detected since construction. */
    get shakeCount() {
        return this._shakeCount;
    }

    /** Current chart type (cycles on odd shakes). */
    get currentChartType() {
        return this._currentChartType;
    }

    /** Current color scheme (cycles on even shakes). */
    get currentColorScheme() {
        return this._currentColorScheme;
    }

    // ------------------------------------------------------------------
    // Manual / desktop trigger
    // ------------------------------------------------------------------

    /** Programmatically trigger a shake (useful for testing on desktop). */
    simulateShake() {
        this._triggerShake();
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /**
     * devicemotion event handler.
     * @param {DeviceMotionEvent} event
     */
    _onDeviceMotion(event) {
        let x, y, z;
        let threshold = SHAKE_THRESHOLD;

        const accel = event.acceleration;
        if (accel && accel.x != null) {
            x = accel.x;
            y = accel.y;
            z = accel.z ?? 0;
        } else {
            // Fallback: accelerationIncludingGravity (some browsers).
            const ag = event.accelerationIncludingGravity;
            if (!ag) return;
            x = ag.x ?? 0;
            y = ag.y ?? 0;
            z = ag.z ?? 0;
            threshold = SHAKE_THRESHOLD_GRAVITY;
        }

        const magnitude = Math.sqrt(x * x + y * y + z * z);
        if (magnitude > threshold) {
            const now = Date.now();
            if (now - this._lastShakeTime > DEBOUNCE_MS) {
                this._lastShakeTime = now;
                this._triggerShake();
            }
        }
    }

    /**
     * Core shake logic: increment counter, cycle the appropriate setting,
     * and notify.
     */
    _triggerShake() {
        this._shakeCount++;

        if (this._shakeCount % 2 === 1) {
            // Odd shake -> cycle chart type
            this._currentChartType = cycleNext(CHART_TYPES, this._currentChartType);
        } else {
            // Even shake -> cycle color scheme
            this._currentColorScheme = cycleNext(COLOR_SCHEMES, this._currentColorScheme);
        }

        this.onShake?.();
    }
}
