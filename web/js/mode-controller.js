/**
 * mode-controller.js
 * Cycles through visualization modes for the brain-map on each shake.
 */

export const Mode = {
    SPECTRUM: 'spectrum',
    AESTHETIC: 'aesthetic',
    RAW: 'raw',
};

const ORDER = [Mode.SPECTRUM, Mode.AESTHETIC, Mode.RAW];

export class ModeController {
    /**
     * @param {string} initial - One of the Mode constants.
     */
    constructor(initial = Mode.SPECTRUM) {
        this._current = ORDER.includes(initial) ? initial : Mode.SPECTRUM;
        /** @type {Function|null} Called after the current mode changes. */
        this.onChange = null;
    }

    /** The current mode (one of the Mode constants). */
    get current() {
        return this._current;
    }

    /** Advance to the next mode in ORDER (wraps around). */
    cycle() {
        const idx = ORDER.indexOf(this._current);
        const next = ORDER[(idx + 1) % ORDER.length];
        this._setAndNotify(next);
    }

    /**
     * Jump directly to a specific mode. Unknown modes are ignored.
     * @param {string} mode
     */
    setMode(mode) {
        if (!ORDER.includes(mode)) return;
        if (mode === this._current) return;
        this._setAndNotify(mode);
    }

    // --- internal ---

    _setAndNotify(mode) {
        this._current = mode;
        this.onChange?.(mode);
    }
}
