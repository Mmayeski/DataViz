import SwiftUI
import Charts

struct TemperatureChartView: View {
    let data: [TemperatureRecord]
    let chartType: ChartType
    let colorScheme: ChartColorScheme
    let zoomLevel: Double
    let focusedMonth: Month?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Average High Temperature")
                .font(.headline)
                .padding(.horizontal)

            Chart(data) { record in
                switch chartType {
                case .bar:
                    BarMark(
                        x: .value("Month", record.month.shortName),
                        y: .value("Temperature", record.averageHigh)
                    )
                    .applyColorScheme(colorScheme, record: record)

                case .line:
                    LineMark(
                        x: .value("Month", record.month.shortName),
                        y: .value("Temperature", record.averageHigh)
                    )
                    .interpolationMethod(.catmullRom)
                    .applyColorScheme(colorScheme, record: record)

                    PointMark(
                        x: .value("Month", record.month.shortName),
                        y: .value("Temperature", record.averageHigh)
                    )
                    .applyColorScheme(colorScheme, record: record)

                case .area:
                    AreaMark(
                        x: .value("Month", record.month.shortName),
                        y: .value("Temperature", record.averageHigh)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(areaGradient)
                    .applyColorScheme(colorScheme, record: record)
                }
            }
            .chartYScale(domain: 20 ... 100)
            .chartXScale(domain: visibleMonthNames)
            .modifier(TemperatureColorScaleModifier(isActive: colorScheme == .temperature))
            .chartXAxis {
                AxisMarks(values: .automatic) { _ in
                    AxisGridLine()
                    AxisValueLabel()
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine()
                    AxisValueLabel {
                        if let temp = value.as(Double.self) {
                            Text("\(Int(temp))\u{00B0}F")
                        }
                    }
                }
            }
            .animation(.easeInOut(duration: 0.3), value: chartType)
            .animation(.easeInOut(duration: 0.3), value: colorScheme)
            .animation(.easeInOut(duration: 0.3), value: zoomLevel)
        }
    }

    // MARK: - Zoom / Visible Months

    /// Returns the month short-names that should be visible based on the
    /// current zoom level and focused month.
    private var visibleMonthNames: [String] {
        let allMonths = data.map(\.month)
        guard !allMonths.isEmpty else { return [] }

        // At zoomLevel 1.0 show every month present in data.
        // At zoomLevel 0.0 show ~2-3 months centred on focusedMonth.
        let totalCount = allMonths.count
        let minVisible = min(3, totalCount)
        let clampedZoom = max(0, min(1, zoomLevel))
        let visibleCount = Int(
            round(Double(minVisible) + clampedZoom * Double(totalCount - minVisible))
        )

        let centre: Int
        if let focused = focusedMonth,
           let idx = allMonths.firstIndex(of: focused) {
            centre = idx
        } else {
            centre = totalCount / 2
        }

        let half = visibleCount / 2
        var start = centre - half
        var end = start + visibleCount

        // Clamp to valid range.
        if start < 0 {
            start = 0
            end = min(visibleCount, totalCount)
        }
        if end > totalCount {
            end = totalCount
            start = max(0, end - visibleCount)
        }

        return Array(allMonths[start ..< end]).map(\.shortName)
    }

    // MARK: - Color Scheme Helpers

    /// A gradient used for the area chart fill, drawn from bottom to top.
    private var areaGradient: LinearGradient {
        LinearGradient(
            gradient: Gradient(colors: [.blue.opacity(0.1), .blue.opacity(0.5)]),
            startPoint: .bottom,
            endPoint: .top
        )
    }

}

// MARK: - Temperature Color Scale Modifier

/// Conditionally applies the temperature-based foreground style scale.
struct TemperatureColorScaleModifier: ViewModifier {
    let isActive: Bool

    func body(content: Content) -> some View {
        if isActive {
            content.chartForegroundStyleScale(range: temperatureGradient)
        } else {
            content
        }
    }

    private var temperatureGradient: some ShapeStyle {
        Gradient(colors: [.blue, .cyan, .yellow, .orange, .red])
    }
}

// MARK: - ChartContent Color Scheme Modifier

/// Convenience extensions to apply the active color scheme to any chart mark.
extension ChartContent {
    @ChartContentBuilder
    func applyColorScheme(
        _ scheme: ChartColorScheme,
        record: TemperatureRecord
    ) -> some ChartContent {
        switch scheme {
        case .temperature:
            self.foregroundStyle(
                by: .value("Temp", record.averageHigh)
            )

        case .monochrome:
            self.foregroundStyle(Color.accentColor)

        case .seasonal:
            self.foregroundStyle(record.month.seasonColor)
        }
    }
}

// MARK: - Month Season Color

extension Month {
    /// Returns a colour representative of the meteorological season.
    var seasonColor: Color {
        switch self {
        case .december, .january, .february:
            return .blue
        case .march, .april, .may:
            return .green
        case .june, .july, .august:
            return .orange
        case .september, .october, .november:
            return .brown
        }
    }
}

// MARK: - Previews

#Preview("Bar - Temperature Colors") {
    TemperatureChartView(
        data: TemperatureRecord.baltimore,
        chartType: .bar,
        colorScheme: .temperature,
        zoomLevel: 1.0,
        focusedMonth: nil
    )
    .frame(height: 300)
    .padding()
}

#Preview("Line - Seasonal Colors") {
    TemperatureChartView(
        data: TemperatureRecord.baltimore,
        chartType: .line,
        colorScheme: .seasonal,
        zoomLevel: 1.0,
        focusedMonth: nil
    )
    .frame(height: 300)
    .padding()
}

#Preview("Area - Zoomed") {
    TemperatureChartView(
        data: TemperatureRecord.baltimore,
        chartType: .area,
        colorScheme: .monochrome,
        zoomLevel: 0.3,
        focusedMonth: .july
    )
    .frame(height: 300)
    .padding()
}
