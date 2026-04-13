/**
 * tilt-sensor.js
 * Wraps the DeviceMotion API to derive tilt-based sort order and month
 * filter for data visualization.  Designed for iPhone Safari (iOS 13+).
 */

import { LowPassFilter, deadZone } from './sensor-smoothing.js';
import { SortOrder, MonthFilter } from './chart-config.js';

const GRAVITY = 9.81;
const DEAD_ZONE_THRESHOLD = 0.15;
const LOW_PASS_ALPHA = 0.1;

/**
 * Clamp a number to the range [-1, 1].
 * @param {number} v
 * @returns {number}
 */
function clamp(v) {
    return Math.max(-1, Math.min(1, v));
}

export class TiltSensor {
    constructor() {
        /** @type {Function|null} Called when sortOrder or monthFilter changes. */
        this.onChange = null;

        this._rollFilter  = new LowPassFilter(LOW_PASS_ALPHA);
        this._pitchFilter = new LowPassFilter(LOW_PASS_ALPHA);

        this._roll  = 0; // filtered, normalised -1..1
        this._pitch = 0;

        this._sortOrder   = SortOrder.CHRONOLOGICAL;
        this._monthFilter = MonthFilter.ALL;

        this._listening = false;
        this._handler = this._onDeviceMotion.bind(this);
    }

    // ------------------------------------------------------------------
    // Permissions (iOS 13+)
    // ------------------------------------------------------------------

    /**
     * Request permission for device-motion events on iOS 13+.
     * @returns {Promise<boolean>} true if permission was granted.
     */
    async requestPermission() {
        if (
            typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function'
        ) {
            try {
                const state = await DeviceMotionEvent.requestPermission();
                return state === 'granted';
            } catch {
                return false;
            }
        }
        // Non-iOS or older browsers: permission is implicit.
        return true;
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

    /** Stop listening for devicemotion events and reset filters. */
    stop() {
        if (!this._listening) return;
        window.removeEventListener('devicemotion', this._handler);
        this._listening = false;
        this._rollFilter.reset();
        this._pitchFilter.reset();
    }

    // ------------------------------------------------------------------
    // Read-only state
    // ------------------------------------------------------------------

    /** Filtered roll angle normalised to -1.0 .. 1.0 (X axis). */
    get rollAngle() {
        return this._roll;
    }

    /** Filtered pitch angle normalised to -1.0 .. 1.0 (Y axis). */
    get pitchAngle() {
        return this._pitch;
    }

    /** Current sort order derived from roll (left/right tilt). */
    get sortOrder() {
        return this._sortOrder;
    }

    /** Current month filter derived from pitch (forward/back tilt). */
    get monthFilter() {
        return this._monthFilter;
    }

    /** Whether the DeviceMotion API is available at all. */
    get isAvailable() {
        return typeof DeviceMotionEvent !== 'undefined';
    }

    // ------------------------------------------------------------------
    // Manual / simulator override
    // ------------------------------------------------------------------

    /**
     * Manually set tilt values (useful for desktop testing or a virtual
     * joystick).  Values are clamped to -1..1 and run through the same
     * derivation logic as real sensor data.
     *
     * @param {number} roll  -1 (left) to 1 (right)
     * @param {number} pitch -1 (back) to 1 (forward)
     */
    setManualTilt(roll, pitch) {
        this._roll  = clamp(roll);
        this._pitch = clamp(pitch);
        this._deriveState();
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /**
     * devicemotion event handler.
     * @param {DeviceMotionEvent} event
     */
    _onDeviceMotion(event) {
        const accel = event.accelerationIncludingGravity;
        if (!accel) return;

        const rawX = (accel.x ?? 0) / GRAVITY;
        const rawY = (accel.y ?? 0) / GRAVITY;

        this._roll  = clamp(this._rollFilter.apply(rawX));
        this._pitch = clamp(this._pitchFilter.apply(rawY));

        this._deriveState();
    }

    /**
     * Derive sortOrder and monthFilter from the current roll/pitch values.
     * Uses dead-zone hysteresis so the previous state is kept when tilt is
     * near centre.
     */
    _deriveState() {
        const prevSort   = this._sortOrder;
        const prevFilter = this._monthFilter;

        // --- Sort order from roll (X) ---
        const dzRoll = deadZone(this._roll, DEAD_ZONE_THRESHOLD);
        if (dzRoll !== 0) {
            this._sortOrder = dzRoll < 0
                ? SortOrder.CHRONOLOGICAL
                : SortOrder.HOTTEST_FIRST;
        }
        // else: keep previous (hysteresis)

        // --- Month filter from pitch (Y) ---
        const dzPitch = deadZone(this._pitch, DEAD_ZONE_THRESHOLD);
        if (dzPitch !== 0) {
            this._monthFilter = dzPitch > 0
                ? MonthFilter.FIRST_HALF
                : MonthFilter.SECOND_HALF;
        } else {
            this._monthFilter = MonthFilter.ALL;
        }

        // Notify if anything changed.
        if (this._sortOrder !== prevSort || this._monthFilter !== prevFilter) {
            this.onChange?.();
        }
    }
}
