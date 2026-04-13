# DataViz — Sensor-Driven Temperature Visualization

An experimental **Progressive Web App** that replaces traditional touch-based chart interaction with **iPhone sensor input**. Tilt, shake, and move your phone closer/farther to explore Baltimore's average monthly temperatures.

Built as a web app so it runs entirely in **Safari on iPhone** — no Mac, no Xcode, no App Store required.

## Sensor Interactions

| Gesture | Web API | Effect |
|---|---|---|
| **Tilt left/right** | DeviceMotion (accelerometer X) | Sort: chronological ↔ hottest-first |
| **Tilt forward/back** | DeviceMotion (accelerometer Y) | Filter months: all / first-half / second-half |
| **Phone closer/farther from face** | `getUserMedia` + FaceDetector API | Zoom in/out on the chart |
| **Shake** | DeviceMotion (acceleration spike) | Cycle chart type (bar → line → area) and color scheme |

## Quick Start (Develop on Windows / iPad)

### 1. Serve the `web/` folder

You need to serve the files over HTTPS (motion sensors and camera require a secure context). Easiest options:

**Option A — Local Python server + ngrok**
```bash
cd web
python -m http.server 8000
# In another terminal:
ngrok http 8000
# Open the https://...ngrok.io URL on your iPhone
```

**Option B — GitHub Pages (recommended, zero setup)**
1. Push this repo to GitHub
2. In repo Settings → Pages, deploy from `claude/sensor-driven-viz-app-lXyvb` branch, `/web` folder
3. Open the resulting `https://<user>.github.io/DataViz/` URL on your iPhone

**Option C — Netlify drop**
- Drag the `web/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop) — instant HTTPS URL.

### 2. Open on your iPhone

1. Visit the URL in Safari
2. Tap **"Enable Sensors & Start"**
3. Approve motion sensor and camera permissions
4. Tilt, shake, and lean in!

### 3. (Optional) "Install" as a home-screen app

In Safari: tap the **Share** button → **Add to Home Screen**. The app launches full-screen with no browser chrome, just like a native iOS app.

## Browser Compatibility

| Feature | iOS Safari | Chrome (Android) | Desktop |
|---|---|---|---|
| Tilt (DeviceMotion) | ✅ (after permission prompt) | ✅ | ❌ — manual sliders |
| Shake (DeviceMotion) | ✅ | ✅ | ❌ — "Simulate Shake" button |
| Face proximity (FaceDetector) | ❌ — not in Safari | ✅ | ⚠️ Chrome only |
| Manual zoom slider | ✅ (always) | ✅ | ✅ |

When face tracking isn't supported, a manual zoom slider appears automatically.

## Project Structure

```
web/
  index.html              → App shell + permission overlay
  manifest.json           → PWA manifest (installable to home screen)
  sw.js                   → Service worker (offline caching)
  css/
    styles.css            → Dark theme, responsive layout
  js/
    app.js                → Main controller — wires everything together
    temperature-data.js   → Baltimore monthly averages
    chart-config.js       → Enums, sort/filter logic, color helpers
    chart-manager.js      → Chart.js wrapper (bar/line/area, zoom, colors)
    sensor-smoothing.js   → Low-pass filter + dead-zone helpers
    tilt-sensor.js        → DeviceMotion accelerometer → sort/filter
    shake-sensor.js       → Acceleration spike → cycle chart/color
    proximity-sensor.js   → Front camera + FaceDetector → zoom
  icons/
    icon.svg              → App icon for home-screen install
```

## Tech Stack

- Vanilla JavaScript (ES modules) — no build step required
- [Chart.js 4](https://www.chartjs.org/) (loaded from CDN) for charting
- DeviceMotion API for tilt + shake
- `navigator.mediaDevices.getUserMedia` + `FaceDetector` API for proximity
- Service Worker for offline / installable PWA

## Development Notes

- All sensor APIs require **HTTPS** (or `localhost`) — they will silently fail on plain `http://`.
- iOS 13+ requires a **user gesture** before granting motion permission — that's why there's a "Start" button instead of auto-starting on page load.
- The desktop fallback controls (sliders + button) appear automatically when sensors aren't available, making development on a regular browser straightforward.

## What's Next (Ideas)

- Add more datasets (precipitation, humidity, multi-year comparisons)
- Use device orientation (compass) for a different sort dimension
- Add ambient light sensor for color-scheme switching
- Support multiple cities, swiped between with a long shake
