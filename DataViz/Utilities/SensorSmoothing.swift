import Foundation

/// A simple low-pass filter for smoothing noisy sensor data.
///
/// The smoothing factor `alpha` controls responsiveness:
/// - Values closer to `1.0` track the input closely (less smoothing).
/// - Values closer to `0.0` respond slowly to changes (more smoothing).
struct LowPassFilter {
    let alpha: Double
    private var previousValue: Double?

    /// Creates a low-pass filter with the given smoothing factor.
    /// - Parameter alpha: A value in the range `0.0...1.0`. Defaults to `0.2`.
    init(alpha: Double = 0.2) {
        precondition((0.0...1.0).contains(alpha), "alpha must be between 0.0 and 1.0")
        self.alpha = alpha
    }

    /// Applies the filter to a new input value and returns the smoothed result.
    ///
    /// On the first call (or after a reset), the input value is returned unchanged.
    /// Subsequent calls return `alpha * newValue + (1 - alpha) * previousValue`.
    mutating func apply(_ newValue: Double) -> Double {
        guard let previous = previousValue else {
            previousValue = newValue
            return newValue
        }
        let filtered = alpha * newValue + (1.0 - alpha) * previous
        previousValue = filtered
        return filtered
    }

    /// Resets the filter, discarding any accumulated state.
    mutating func reset() {
        previousValue = nil
    }
}

/// Returns `0.0` if the absolute value of the input is below the threshold;
/// otherwise returns the input unchanged.
///
/// Useful for ignoring small sensor fluctuations that represent noise rather
/// than intentional movement.
/// - Parameters:
///   - value: The raw sensor value.
///   - threshold: The minimum absolute value to pass through.
/// - Returns: The original value, or `0.0` if within the dead zone.
func deadZone(_ value: Double, threshold: Double) -> Double {
    abs(value) < threshold ? 0.0 : value
}
