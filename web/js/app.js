/**
 * app.js
 * Main application controller — wires up sensors, chart, HUD, and fallback controls.
 */

import { baltimoreData } from './temperature-data.js';
import { applyFilter, applySort, getLabel, getSortIcon } from './chart-config.js';
import { ChartManager } from './chart-manager.js';
import { TiltSensor } from './tilt-sensor.js';
import { ShakeSensor } from './shake-sensor.js';
import { ProximitySensor } from './proximity-sensor.js';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const permissionOverlay = document.getElementById('permission-overlay');
const startBtn         = document.getElementById('start-btn');
const mainUI           = document.getElementById('main-ui');
const fallbackControls = document.getElementById('fallback-controls');

// HUD elements
const hudSortIcon    = document.getElementById('hud-sort-icon');
const hudSortLabel   = document.getElementById('hud-sort-label');
const hudFilterLabel = document.getElementById('hud-filter-label');
const hudFaceIcon    = document.getElementById('hud-face-icon');
const hudFaceLabel   = document.getElementById('hud-face-label');
const hudChartIcon   = document.getElementById('hud-chart-icon');
const hudChartLabel  = document.getElementById('hud-chart-label');

// Fallback controls
const manualRoll  = document.getElementById('manual-roll');
const manualPitch = document.getElementById('manual-pitch');
const manualZoom  = document.getElementById('manual-zoom');
const manualShake = document.getElementById('manual-shake');

// Camera
const cameraPreview = document.getElementById('camera-preview');

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

const chart     = new ChartManager('temp-chart');
const tilt      = new TiltSensor();
const shake     = new ShakeSensor();
const proximity = new ProximitySensor(cameraPreview);

// ---------------------------------------------------------------------------
// State tracking
// ---------------------------------------------------------------------------

let currentSortOrder  = tilt.sortOrder;
let currentFilter     = tilt.monthFilter;

// ---------------------------------------------------------------------------
// Update pipeline
// ---------------------------------------------------------------------------

/** Recompute the displayed data and push it to the chart. */
function updateChartData() {
    const filtered = applyFilter(baltimoreData, tilt.monthFilter);
    const sorted   = applySort(filtered, tilt.sortOrder);
    chart.updateData(sorted);
}

/** Refresh the HUD with current sensor state. */
function updateHUD() {
    hudSortIcon.textContent  = getSortIcon(tilt.sortOrder);
    hudSortLabel.textContent = getLabel(tilt.sortOrder);
    hudFilterLabel.textContent = getLabel(tilt.monthFilter);

    if (proximity.isTracking && proximity.faceDistance !== null) {
        hudFaceIcon.textContent  = '😊';
        hudFaceLabel.textContent = `${Math.round(proximity.faceDistance)} cm`;
    } else {
        hudFaceIcon.textContent  = '😶‍🌫️';
        hudFaceLabel.textContent = proximity.isAvailable
            ? 'No face detected'
            : 'Face tracking unavailable';
    }

    const chartIcon = { bar: '📊', line: '📈', area: '📉' };
    hudChartIcon.textContent = chartIcon[shake.currentChartType] || '📊';
    hudChartLabel.textContent =
        `${getLabel(shake.currentChartType)} · ${getLabel(shake.currentColorScheme)}`;
}

// ---------------------------------------------------------------------------
// Sensor callbacks
// ---------------------------------------------------------------------------

tilt.onChange = () => {
    updateChartData();
    updateHUD();
};

shake.onShake = () => {
    chart.setChartType(shake.currentChartType);
    chart.setColorScheme(shake.currentColorScheme);
    updateHUD();
};

proximity.onChange = () => {
    chart.setZoom(proximity.zoomLevel, proximity.focusedMonthIndex);
    updateHUD();
};

// ---------------------------------------------------------------------------
// Fallback controls (desktop / sensors unavailable)
// ---------------------------------------------------------------------------

function setupFallbackControls() {
    fallbackControls.classList.remove('hidden');

    manualRoll.addEventListener('input', () => {
        tilt.setManualTilt(manualRoll.value / 100, manualPitch.value / 100);
    });

    manualPitch.addEventListener('input', () => {
        tilt.setManualTilt(manualRoll.value / 100, manualPitch.value / 100);
    });

    manualZoom.addEventListener('input', () => {
        proximity.setManualZoom(manualZoom.value / 100);
    });

    manualShake.addEventListener('click', () => {
        shake.simulateShake();
    });
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

startBtn.addEventListener('click', async () => {
    // Request motion permission (iOS 13+ requires user gesture)
    const motionGranted = await tilt.requestPermission();

    // Start sensors
    tilt.start();
    shake.start();
    await proximity.start();

    // Show fallback controls if sensors are unavailable
    const needsFallback = !motionGranted || !tilt.isAvailable || !proximity.isAvailable;
    if (needsFallback) {
        setupFallbackControls();
    }

    // Initialise chart with full dataset
    const initialData = applySort(
        applyFilter(baltimoreData, tilt.monthFilter),
        tilt.sortOrder
    );
    chart.init(initialData);

    // Switch from permission overlay to main UI
    permissionOverlay.classList.add('hidden');
    mainUI.classList.remove('hidden');

    // Initial HUD render
    updateHUD();
});
