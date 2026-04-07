# DataViz — Sensor-Driven Temperature Visualization

An experimental iOS app that replaces traditional touch-based chart interaction with **iPhone sensor input**. Tilt, move, and shake your phone to explore Baltimore's average monthly temperatures.

## Sensor Interactions

| Gesture | Sensor | Effect |
|---|---|---|
| **Tilt left/right** | Accelerometer (CoreMotion) | Sort data: chronological ↔ hottest-first |
| **Tilt forward/back** | Accelerometer (CoreMotion) | Filter months: all ↔ first-half ↔ second-half |
| **Move phone closer/farther** | Face tracking (ARKit) | Zoom in to a single month ↔ full year |
| **Shake** | Motion events (UIKit) | Cycle chart type (bar → line → area) and color scheme |

## Requirements

- **iOS 17.0+**
- **Xcode 15+**
- iPhone with TrueDepth camera (iPhone X or later) for face-distance zoom
- Physical device recommended — accelerometer and face tracking don't work in the Simulator (debug sliders are provided instead)

## Getting Started

### Option A: XcodeGen (Recommended)

```bash
# Install XcodeGen if you don't have it
brew install xcodegen

# Generate the Xcode project
cd DataViz
xcodegen generate

# Open in Xcode
open DataViz.xcodeproj
```

### Option B: Manual Xcode Setup

1. Create a new iOS App project in Xcode (SwiftUI, iOS 17+)
2. Delete the auto-generated ContentView.swift
3. Drag the entire `DataViz/` source folder into the project navigator
4. Set the Info.plist path in Build Settings to `DataViz/App/Info.plist`
5. Build and run

## Project Structure

```
DataViz/
  App/            → App entry point and Info.plist
  Models/         → Temperature data and configuration enums
  SensorManagers/ → CoreMotion, ARKit, and shake detection wrappers
  ViewModels/     → Central ViewModel combining sensors + data
  Views/          → SwiftUI views (chart, overlay, content root)
  Utilities/      → Low-pass filter and dead-zone helpers
  Resources/      → Asset catalog
```

## Simulator Support

When running in the iOS Simulator, sensor hardware is unavailable. The app provides:
- **Sliders** for simulating tilt (roll and pitch)
- A **"Simulate Shake" button** for cycling chart types
- Face tracking is disabled with a status message

## Tech Stack

- SwiftUI + Swift Charts
- CoreMotion (accelerometer)
- ARKit (face distance tracking via TrueDepth camera)
- iOS 17 Observation framework (`@Observable`)
