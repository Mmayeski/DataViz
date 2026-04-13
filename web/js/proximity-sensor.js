/**
 * proximity-sensor.js
 * Uses the front camera and FaceDetector API to estimate how far the user
 * is from the screen. Falls back to manual zoom control when FaceDetector
 * is unavailable (e.g. Safari / Firefox).
 */

import { LowPassFilter } from './sensor-smoothing.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fraction of video width at which face is considered "very close" (~20 cm). */
const FACE_FRACTION_CLOSE = 0.50;

/** Fraction of video width at which face is considered "far" (~60+ cm). */
const FACE_FRACTION_FAR = 0.10;

/** Approximate average human face width in cm. */
const BASE_FACE_WIDTH_CM = 14;

/** Rough scale factor for the distance formula. */
const DISTANCE_SCALE = 50;

/** Detection interval target in ms (~10 fps). */
const DETECTION_INTERVAL_MS = 100;

/** Zoom threshold below which lateral position maps to a focused month. */
const ZOOM_FOCUS_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// ProximitySensor
// ---------------------------------------------------------------------------

export class ProximitySensor {
    /**
     * @param {HTMLVideoElement} videoElement - The <video> element to attach
     *   the camera stream to (e.g. document.getElementById('camera-preview')).
     */
    constructor(videoElement) {
        /** @type {HTMLVideoElement} */
        this._video = videoElement;

        /** @type {MediaStream|null} */
        this._stream = null;

        /** @type {FaceDetector|null} */
        this._detector = null;

        /** @type {number|null} */
        this._intervalId = null;

        // State -----------------------------------------------------------------
        this._available = false;
        this._tracking = false;
        this._faceDistance = null;
        this._zoomLevel = 1.0;
        this._focusedMonthIndex = null;
        this._manualMode = false;

        // Smoothing filter for zoom to reduce jitter.
        this._zoomFilter = new LowPassFilter(0.25);

        /**
         * Optional callback invoked whenever any public property changes.
         * @type {Function|null}
         */
        this.onChange = null;
    }

    // -----------------------------------------------------------------------
    // Public getters
    // -----------------------------------------------------------------------

    /** True if the camera stream is active and face detection is supported. */
    get isAvailable() {
        return this._available;
    }

    /** True if a face is currently being tracked in the video frame. */
    get isTracking() {
        return this._tracking;
    }

    /** Estimated distance to the face in cm, or null if no face detected. */
    get faceDistance() {
        return this._faceDistance;
    }

    /**
     * Zoom level derived from face proximity.
     * 0.0 = zoomed all the way in (face very close).
     * 1.0 = zoomed all the way out (face far or no detection).
     */
    get zoomLevel() {
        return this._zoomLevel;
    }

    /**
     * Index 0-11 representing which month the user is "looking at",
     * based on the lateral (x) position of their face when zoomed in.
     * null when zoomed out (zoomLevel >= ZOOM_FOCUS_THRESHOLD).
     */
    get focusedMonthIndex() {
        return this._focusedMonthIndex;
    }

    // -----------------------------------------------------------------------
    // Public methods
    // -----------------------------------------------------------------------

    /**
     * Request camera access, create a FaceDetector (if supported), and begin
     * the detection loop.
     */
    async start() {
        // Check for FaceDetector support first.
        const hasFaceDetector = typeof window.FaceDetector === 'function';

        if (!hasFaceDetector) {
            // Graceful degradation — switch to manual mode.
            this._available = false;
            this._manualMode = true;
            this._notify();
            return;
        }

        try {
            this._stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
            });

            this._video.srcObject = this._stream;
            this._video.setAttribute('playsinline', '');
            await this._video.play();

            this._detector = new window.FaceDetector({ fastMode: true });
            this._available = true;

            // Start the detection loop.
            this._startLoop();
        } catch (err) {
            console.warn('[ProximitySensor] Could not start:', err);
            this._available = false;
            this._manualMode = true;
        }

        this._notify();
    }

    /** Stop the camera stream and detection loop. */
    stop() {
        this._stopLoop();

        if (this._stream) {
            for (const track of this._stream.getTracks()) {
                track.stop();
            }
            this._stream = null;
        }

        this._video.srcObject = null;
        this._tracking = false;
        this._faceDistance = null;
        this._available = false;
        this._notify();
    }

    /**
     * Manually set the zoom level (for desktop / fallback slider).
     * @param {number} level - Value between 0.0 (zoomed in) and 1.0 (zoomed out).
     */
    setManualZoom(level) {
        this._manualMode = true;
        this._zoomLevel = Math.max(0, Math.min(1, level));
        this._tracking = false;
        this._faceDistance = null;

        // When manually zoomed in, default focus to center month (index 6).
        if (this._zoomLevel < ZOOM_FOCUS_THRESHOLD) {
            this._focusedMonthIndex = 6;
        } else {
            this._focusedMonthIndex = null;
        }

        this._notify();
    }

    // -----------------------------------------------------------------------
    // Private — detection loop
    // -----------------------------------------------------------------------

    /** Start the periodic face-detection loop. */
    _startLoop() {
        if (this._intervalId !== null) return;
        this._intervalId = setInterval(() => this._detect(), DETECTION_INTERVAL_MS);
    }

    /** Stop the detection loop. */
    _stopLoop() {
        if (this._intervalId !== null) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    /** Run a single detection frame. */
    async _detect() {
        if (!this._detector || this._video.readyState < 2) return;

        try {
            const faces = await this._detector.detect(this._video);

            if (faces.length === 0) {
                this._tracking = false;
                this._faceDistance = null;
                // Slowly drift zoom back to 1.0 when face lost.
                this._zoomLevel = this._zoomFilter.apply(1.0);
                this._focusedMonthIndex = null;
                this._notify();
                return;
            }

            // Use the largest detected face.
            const face = faces.reduce((a, b) =>
                b.boundingBox.width > a.boundingBox.width ? b : a
            );

            const bbox = face.boundingBox;
            const videoWidth = this._video.videoWidth || 1;
            const faceWidthFraction = bbox.width / videoWidth;

            // --- Zoom level (linear interpolation, clamped) ---
            // fraction FACE_FRACTION_CLOSE → zoom 0.0 (close)
            // fraction FACE_FRACTION_FAR   → zoom 1.0 (far)
            const rawZoom = 1.0 - (faceWidthFraction - FACE_FRACTION_FAR)
                / (FACE_FRACTION_CLOSE - FACE_FRACTION_FAR);
            const clampedZoom = Math.max(0, Math.min(1, rawZoom));
            this._zoomLevel = this._zoomFilter.apply(clampedZoom);

            // --- Estimated distance in cm ---
            this._faceDistance = Math.round(
                BASE_FACE_WIDTH_CM / (faceWidthFraction * videoWidth) * DISTANCE_SCALE * videoWidth
            );

            // --- Focused month from lateral position ---
            if (this._zoomLevel < ZOOM_FOCUS_THRESHOLD) {
                const faceCenterX = (bbox.x + bbox.width / 2) / videoWidth;
                // Mirror: front camera is flipped, so 0 on screen = right side.
                // Map 0..1 to 0..11 (left of frame = Jan, right = Dec).
                this._focusedMonthIndex = Math.min(
                    11,
                    Math.max(0, Math.floor(faceCenterX * 12))
                );
            } else {
                this._focusedMonthIndex = null;
            }

            this._tracking = true;
            this._notify();
        } catch (err) {
            // FaceDetector.detect can throw on invalid image states — ignore.
            console.warn('[ProximitySensor] detection error:', err);
        }
    }

    /** Fire the onChange callback if one is registered. */
    _notify() {
        if (typeof this.onChange === 'function') {
            this.onChange();
        }
    }
}
