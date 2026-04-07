import SwiftUI

struct ContentView: View {
    @State private var viewModel = ChartViewModel()

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Main chart
            VStack {
                Text("Baltimore, MD")
                    .font(.title2.bold())
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)

                TemperatureChartView(
                    data: viewModel.displayedData,
                    chartType: viewModel.chartType,
                    colorScheme: viewModel.colorScheme,
                    zoomLevel: viewModel.zoomLevel,
                    focusedMonth: viewModel.focusedMonth
                )
                .frame(maxHeight: .infinity)
                .padding(.horizontal)

                if !viewModel.isFaceTrackingAvailable {
                    Text("Face tracking unavailable — zoom disabled")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 4)
                }

                #if targetEnvironment(simulator)
                SimulatorControls(viewModel: viewModel)
                #endif
            }

            // Sensor state overlay
            SensorOverlayView(
                sortOrder: viewModel.sortOrder,
                monthFilter: viewModel.monthFilter,
                faceDistance: viewModel.faceDistanceCm,
                isTracking: viewModel.isTracking,
                chartType: viewModel.chartType,
                colorScheme: viewModel.colorScheme
            )
            .padding()
        }
        .background {
            // Invisible shake detector responder
            viewModel.shakeDetector.makeRepresentable()
        }
        .onAppear {
            viewModel.startAllSensors()
        }
        .onDisappear {
            viewModel.stopAllSensors()
        }
    }
}

// MARK: - Simulator Debug Controls

#if targetEnvironment(simulator)
struct SimulatorControls: View {
    @Bindable var viewModel: ChartViewModel

    @State private var simulatedRoll: Double = 0.0
    @State private var simulatedPitch: Double = 0.0

    var body: some View {
        VStack(spacing: 8) {
            Divider()
            Text("Simulator Controls")
                .font(.caption.bold())

            HStack {
                Text("Roll (sort)")
                    .font(.caption2)
                Slider(value: $simulatedRoll, in: -1.0...1.0)
                    .onChange(of: simulatedRoll) { _, newValue in
                        viewModel.tiltManager.setSimulatedTilt(
                            roll: newValue,
                            pitch: simulatedPitch
                        )
                    }
            }

            HStack {
                Text("Pitch (filter)")
                    .font(.caption2)
                Slider(value: $simulatedPitch, in: -1.0...1.0)
                    .onChange(of: simulatedPitch) { _, newValue in
                        viewModel.tiltManager.setSimulatedTilt(
                            roll: simulatedRoll,
                            pitch: newValue
                        )
                    }
            }

            Button("Simulate Shake") {
                viewModel.shakeDetector.handleShake()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(.horizontal)
        .padding(.bottom, 8)
    }
}
#endif

// MARK: - Preview

#Preview {
    ContentView()
}
