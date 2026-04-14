/**
 * app.js
 * Main application controller for the Sensor-Driven Audio Brain Map PWA.
 *
 * Wires together:
 *   - Sensors: TiltSensor, ShakeSensor, ProximitySensor
 *   - Visualization: BrainMap (+ NodePicker) on a WebGL canvas
 *   - UX: ModeController (cycles modes on shake), PanelUI (song detail panel)
 *   - Data/audio: loadLibrary(), AudioPlayer, AestheticStore
 *
 * NOTE ON LEGACY SENSOR FIELDS
 * ----------------------------
 * The sensor modules (tilt-sensor.js, shake-sensor.js, proximity-sensor.js)
 * were originally written for a temperature-chart app and still expose
 * chart-related fields that this brain-map app intentionally ignores:
 *
 *   - tiltSensor.sortOrder, tiltSensor.monthFilter
 *   - shakeSensor.currentChartType, shakeSensor.currentColorScheme
 *   - proximitySensor.focusedMonthIndex
 *
 * We only consume the raw/normalised sensor outputs:
 *   - tiltSensor.rollAngle, tiltSensor.pitchAngle      (-1..1 each)
 *   - shakeSensor.onShake()                            (event only)
 *   - proximitySensor.zoomLevel, .isTracking, .faceDistance
 *
 * The sensor modules must not be modified here; the legacy chart fields are
 * harmless and simply left unread.
 */

import { loadLibrary } from './song-library.js';
import { BrainMap } from './brain-map.js';
import { NodePicker } from './node-picker.js';
import { TiltSensor } from './tilt-sensor.js';
import { ShakeSensor } from './shake-sensor.js';
import { ProximitySensor } from './proximity-sensor.js';
import { ModeController, Mode } from './mode-controller.js';
import { AudioPlayer } from './audio-player.js';
import { AestheticStore } from './aesthetic-store.js';
import { PanelUI } from './panel-ui.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const permissionOverlay = document.getElementById('permission-overlay');
const startBtn          = document.getElementById('start-btn');
const mainUI            = document.getElementById('main-ui');
const fallbackControls  = document.getElementById('fallback-controls');

// Brain-map canvas + camera preview
const brainCanvas       = document.getElementById('brain-canvas');
const cameraPreview     = document.getElementById('camera-preview');

// HUD elements (repurposed from the old chart HUD)
const hudModeLabel      = document.getElementById('hud-mode-label');
const hudFaceIcon       = document.getElementById('hud-face-icon');
const hudFaceLabel      = document.getElementById('hud-face-label');
const hudTiltLabel      = document.getElementById('hud-tilt-label');
const hudSongLabel      = document.getElementById('hud-song-label');

// Fallback controls
const manualRoll        = document.getElementById('manual-roll');
const manualPitch       = document.getElementById('manual-pitch');
const manualZoom        = document.getElementById('manual-zoom');
const manualShake       = document.getElementById('manual-shake');

// ---------------------------------------------------------------------------
// Instances (sensors & non-visual services can be created eagerly; brainMap
// is constructed after the library loads so we can pass real song data in.)
// ---------------------------------------------------------------------------

const tiltSensor      = new TiltSensor();
const shakeSensor     = new ShakeSensor();
const proximitySensor = new ProximitySensor(cameraPreview);

const modeController  = new ModeController(Mode.SPECTRUM);
const audioPlayer     = new AudioPlayer();
const aestheticStore  = new AestheticStore();
const panelUI         = new PanelUI({ audioPlayer, aestheticStore });

/** @type {BrainMap|null} */
let brainMap = null;
/** @type {NodePicker|null} */
let nodePicker = null;
/** @type {{songs: Array, byId: Map, featureSpec: object}|null} */
let lib = null;

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

let selectedSongId = null;

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

const MODE_LABELS = {
    [Mode.SPECTRUM]:  'SPECTRUM',
    [Mode.AESTHETIC]: 'AESTHETIC',
    [Mode.RAW]:       'RAW',
};

/**
 * Build a short compass-style string (e.g. "N", "NE", "--") describing the
 * current tilt direction. Returns "--" when roll and pitch are both near
 * centre.
 */
function tiltCompass(roll, pitch) {
    const DEAD = 0.2;
    const nearZero = Math.abs(roll) < DEAD && Math.abs(pitch) < DEAD;
    if (nearZero) return '--';

    // Pitch: negative = tilted back (N), positive = tilted forward (S).
    // Roll: negative = left (W), positive = right (E).
    let ns = '';
    let ew = '';
    if (pitch < -DEAD) ns = 'N';
    else if (pitch > DEAD) ns = 'S';
    if (roll < -DEAD) ew = 'W';
    else if (roll > DEAD) ew = 'E';
    return `${ns}${ew}` || '--';
}

/** Refresh the HUD with current sensor + app state. */
function updateHUD() {
    if (hudModeLabel) {
        hudModeLabel.textContent = MODE_LABELS[modeController.current] ?? '';
    }

    if (hudFaceIcon && hudFaceLabel) {
        if (proximitySensor.isTracking && proximitySensor.faceDistance !== null) {
            hudFaceIcon.textContent  = 'FACE';
            hudFaceLabel.textContent = `${Math.round(proximitySensor.faceDistance)} cm`;
        } else {
            hudFaceIcon.textContent  = 'FACE';
            hudFaceLabel.textContent = proximitySensor.isAvailable
                ? 'No face detected'
                : 'Face tracking unavailable';
        }
    }

    if (hudTiltLabel) {
        hudTiltLabel.textContent = tiltCompass(
            tiltSensor.rollAngle,
            tiltSensor.pitchAngle,
        );
    }

    if (hudSongLabel) {
        if (selectedSongId && lib) {
            const song = lib.byId.get(selectedSongId);
            hudSongLabel.textContent = song?.title ?? 'Nothing selected';
        } else {
            hudSongLabel.textContent = 'Nothing selected';
        }
    }
}

// ---------------------------------------------------------------------------
// Node-tap + panel handlers
// ---------------------------------------------------------------------------

function handleNodeTap(songId) {
    if (!lib) return;
    const song = lib.byId.get(songId);
    if (!song) return;

    selectedSongId = songId;
    brainMap?.setSelected(songId);
    panelUI.open(song);
    updateHUD();
}

panelUI.onClose = () => {
    selectedSongId = null;
    brainMap?.setSelected(null);
    updateHUD();
};

// ---------------------------------------------------------------------------
// Sensor callbacks (wired after BrainMap is constructed)
// ---------------------------------------------------------------------------

function wireSensorCallbacks() {
    tiltSensor.onChange = () => {
        brainMap?.setOrbit(tiltSensor.rollAngle, tiltSensor.pitchAngle);
        updateHUD();
    };

    proximitySensor.onChange = () => {
        brainMap?.setZoom(proximitySensor.zoomLevel);
        updateHUD();
    };

    shakeSensor.onShake = () => {
        modeController.cycle();
        brainMap?.setMode(modeController.current);

        // Aesthetic mode needs a freshly computed edge set each time we
        // enter it (the user may have updated their aesthetic preferences).
        if (modeController.current === Mode.AESTHETIC) {
            brainMap?.setAestheticEdges(aestheticStore.computeAestheticEdges());
        }
        updateHUD();
    };

    // Rebuild aesthetic edges live if the user changes preferences while
    // aesthetic mode is active.
    aestheticStore.onChange = () => {
        if (modeController.current === Mode.AESTHETIC) {
            brainMap?.setAestheticEdges(aestheticStore.computeAestheticEdges());
        }
    };
}

// ---------------------------------------------------------------------------
// Fallback controls (desktop / sensors unavailable)
// ---------------------------------------------------------------------------

function setupFallbackControls() {
    fallbackControls.classList.remove('hidden');

    const pushManualTilt = () => {
        const r = Number(manualRoll.value)  / 100;
        const p = Number(manualPitch.value) / 100;
        // setManualTilt updates the sensor's internal state but does NOT
        // fire onChange (it's routed through _deriveState which only fires
        // when the legacy sortOrder / monthFilter change). Push the values
        // straight to the brain-map so the UI stays live.
        tiltSensor.setManualTilt(r, p);
        brainMap?.setOrbit(tiltSensor.rollAngle, tiltSensor.pitchAngle);
        updateHUD();
    };

    manualRoll.addEventListener('input', pushManualTilt);
    manualPitch.addEventListener('input', pushManualTilt);

    manualZoom.addEventListener('input', () => {
        proximitySensor.setManualZoom(Number(manualZoom.value) / 100);
    });

    manualShake.addEventListener('click', () => {
        shakeSensor.simulateShake();
    });
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

startBtn.addEventListener('click', async () => {
    // 1. Ask iOS for motion permission (must be inside the click handler).
    const motionGranted = await tiltSensor.requestPermission();

    // 2. Start sensors. proximitySensor.start() is async because it opens
    //    the camera stream.
    tiltSensor.start();
    shakeSensor.start();
    await proximitySensor.start();

    // 3. Load the song library (JSON + feature spec).
    lib = await loadLibrary();

    // 4. Build the 3-D brain map and the tap-picker on top of it.
    brainMap = new BrainMap(brainCanvas, { onNodeTap: handleNodeTap });
    brainMap.init(lib.songs);
    brainMap.setMode(modeController.current);

    nodePicker = new NodePicker(brainCanvas, brainMap, handleNodeTap);

    // 5. Wire sensor callbacks now that the brain-map exists.
    wireSensorCallbacks();

    // 6. Reveal the UI.
    permissionOverlay.classList.add('hidden');
    mainUI.classList.remove('hidden');

    // 7. If any sensor failed to initialise, show manual controls.
    const needsFallback =
        !motionGranted ||
        !tiltSensor.isAvailable ||
        !proximitySensor.isAvailable;
    if (needsFallback) {
        setupFallbackControls();
    }

    // 8. Seed the brain-map with the current (possibly zeroed) sensor state
    //    and render the initial HUD.
    brainMap.setOrbit(tiltSensor.rollAngle, tiltSensor.pitchAngle);
    brainMap.setZoom(proximitySensor.zoomLevel);
    updateHUD();
});
