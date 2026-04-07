import SwiftUI

@Observable
final class ChartViewModel {

    // MARK: - Sensor Managers

    let tiltManager = TiltManager()
    let proximityManager = ProximityManager()
    let shakeDetector = ShakeDetector()

    // MARK: - Computed Properties

    /// The Baltimore temperature data, sorted and filtered based on current sensor state.
    var displayedData: [TemperatureRecord] {
        let filtered = TemperatureRecord.baltimore.filter { record in
            tiltManager.monthFilter.applies(to: record.month)
        }

        switch tiltManager.sortOrder {
        case .chronological:
            return filtered.sorted { $0.month.rawValue < $1.month.rawValue }
        case .hottestFirst:
            return filtered.sorted { $0.averageHigh > $1.averageHigh }
        case .coldestFirst:
            return filtered.sorted { $0.averageHigh < $1.averageHigh }
        }
    }

    var chartType: ChartType {
        shakeDetector.currentChartType
    }

    var colorScheme: ChartColorScheme {
        shakeDetector.currentColorScheme
    }

    var zoomLevel: Double {
        proximityManager.zoomLevel
    }

    var focusedMonth: Month? {
        guard let index = proximityManager.focusedMonthIndex else { return nil }
        return Month.allCases[index]
    }

    /// Face distance in centimeters for display, nil when not tracking.
    var faceDistanceCm: Double? {
        guard let meters = proximityManager.faceDistance else { return nil }
        return meters * 100.0
    }

    var sortOrder: SortOrder {
        tiltManager.sortOrder
    }

    var monthFilter: MonthFilter {
        tiltManager.monthFilter
    }

    var isTracking: Bool {
        proximityManager.isTracking
    }

    var isFaceTrackingAvailable: Bool {
        proximityManager.isAvailable
    }

    // MARK: - Lifecycle

    func startAllSensors() {
        tiltManager.startUpdates()
        proximityManager.start()
    }

    func stopAllSensors() {
        tiltManager.stopUpdates()
        proximityManager.stop()
    }
}
