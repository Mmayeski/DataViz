import CoreMotion
import Foundation

@Observable
final class TiltManager {

    // MARK: - Published properties

    private(set) var rollAngle: Double = 0.0
    private(set) var pitchAngle: Double = 0.0
    private(set) var sortOrder: SortOrder = .chronological
    private(set) var monthFilter: MonthFilter = .all

    // MARK: - Private state

    private let motionManager = CMMotionManager()
    private var rollFilter = LowPassFilter(alpha: 0.1)
    private var pitchFilter = LowPassFilter(alpha: 0.1)
    private let updateInterval: TimeInterval = 1.0 / 30.0 // 30 Hz
    private let deadZoneThreshold = 0.15

    // MARK: - Lifecycle

    init() {
        startUpdates()
    }

    deinit {
        stopUpdates()
    }

    // MARK: - Public API

    func startUpdates() {
        #if targetEnvironment(simulator)
        // On the simulator, accelerometer is unavailable.
        // Properties can be set manually via `setSimulatedTilt(roll:pitch:)`.
        #else
        guard motionManager.isAccelerometerAvailable else { return }
        motionManager.accelerometerUpdateInterval = updateInterval

        let queue = OperationQueue()
        queue.name = "com.dataviz.tiltmanager.accelerometer"
        queue.maxConcurrentOperationCount = 1

        motionManager.startAccelerometerUpdates(to: queue) { [weak self] data, _ in
            guard let self, let data else { return }

            let rawRoll = max(-1.0, min(1.0, data.acceleration.x))
            let rawPitch = max(-1.0, min(1.0, data.acceleration.y))

            let smoothedRoll = self.rollFilter.apply(rawRoll)
            let smoothedPitch = self.pitchFilter.apply(rawPitch)

            Task { @MainActor in
                self.applyTilt(roll: smoothedRoll, pitch: smoothedPitch)
            }
        }
        #endif
    }

    func stopUpdates() {
        #if targetEnvironment(simulator)
        // Nothing to stop on the simulator.
        #else
        motionManager.stopAccelerometerUpdates()
        rollFilter.reset()
        pitchFilter.reset()
        #endif
    }

    // MARK: - Simulator support

    #if targetEnvironment(simulator)
    /// Allows manual tilt injection for testing on the simulator.
    func setSimulatedTilt(roll: Double, pitch: Double) {
        let clampedRoll = max(-1.0, min(1.0, roll))
        let clampedPitch = max(-1.0, min(1.0, pitch))
        applyTilt(roll: clampedRoll, pitch: clampedPitch)
    }
    #endif

    // MARK: - Private helpers

    private func applyTilt(roll: Double, pitch: Double) {
        rollAngle = roll
        pitchAngle = pitch

        // Derive sort order from roll with dead-zone hysteresis.
        let dzRoll = deadZone(rollAngle, threshold: deadZoneThreshold)
        if dzRoll != 0 {
            if dzRoll < 0 {
                sortOrder = .chronological
            } else {
                sortOrder = .hottestFirst
            }
        }
        // When dzRoll == 0 (inside dead zone), keep the previous sortOrder (hysteresis).

        // Derive month filter from pitch with dead-zone hysteresis.
        let dzPitch = deadZone(pitchAngle, threshold: deadZoneThreshold)
        if dzPitch < 0 {
            monthFilter = .firstHalf
        } else if dzPitch > 0 {
            monthFilter = .secondHalf
        } else {
            monthFilter = .all
        }
    }
}
