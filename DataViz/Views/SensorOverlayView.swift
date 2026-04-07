import SwiftUI

struct SensorOverlayView: View {
    let sortOrder: SortOrder
    let monthFilter: MonthFilter
    let faceDistance: Double?
    let isTracking: Bool
    let chartType: ChartType
    let colorScheme: ChartColorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Sort order
            HStack(spacing: 4) {
                Image(systemName: sortOrderIcon)
                Text(sortOrder.label)
            }

            // Month filter
            HStack(spacing: 4) {
                Image(systemName: "calendar")
                Text(monthFilter.label)
            }

            // Face distance
            HStack(spacing: 4) {
                Image(systemName: isTracking ? "face.smiling" : "face.dashed")
                if let distance = faceDistance {
                    Text(String(format: "%.0f cm", distance))
                } else {
                    Text("No face detected")
                }
            }

            // Chart type & color scheme
            HStack(spacing: 4) {
                Image(systemName: chartType.iconName)
                Text(colorScheme.label)
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Helpers

    /// SF Symbol name indicating the current sort direction.
    private var sortOrderIcon: String {
        switch sortOrder {
        case .chronological: return "arrow.right"
        case .hottestFirst:  return "arrow.down"
        case .coldestFirst:  return "arrow.up"
        }
    }
}

// MARK: - Previews

#Preview("Tracking") {
    SensorOverlayView(
        sortOrder: .hottestFirst,
        monthFilter: .summer,
        faceDistance: 42.5,
        isTracking: true,
        chartType: .bar,
        colorScheme: .temperature
    )
    .padding()
}

#Preview("No Face") {
    SensorOverlayView(
        sortOrder: .chronological,
        monthFilter: .all,
        faceDistance: nil,
        isTracking: false,
        chartType: .line,
        colorScheme: .monochrome
    )
    .padding()
}
