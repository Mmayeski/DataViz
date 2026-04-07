import SwiftUI
import UIKit

// MARK: - ShakeDetector

@Observable
final class ShakeDetector {

    // MARK: - Published properties

    private(set) var shakeCount: Int = 0
    private(set) var currentChartType: ChartType = .bar
    private(set) var currentColorScheme: ChartColorScheme = .temperature

    // MARK: - Private state

    private var lastShakeDate: Date = .distantPast
    private let debounceInterval: TimeInterval = 0.5

    // MARK: - Shake handling

    /// Called by the embedded view controller when a shake gesture is detected.
    func handleShake() {
        let now = Date()
        guard now.timeIntervalSince(lastShakeDate) >= debounceInterval else { return }
        lastShakeDate = now

        shakeCount += 1

        if shakeCount.isMultiple(of: 2) {
            // Even shake: cycle color scheme.
            currentColorScheme = currentColorScheme.next()
        } else {
            // Odd shake: cycle chart type.
            currentChartType = currentChartType.next()
        }
    }

    // MARK: - View helper

    /// Returns a zero-sized representable view that enables shake detection.
    /// Embed this in your SwiftUI hierarchy so the underlying view controller
    /// can become first responder and receive motion events.
    func makeRepresentable() -> some View {
        ShakeDetectorRepresentable(detector: self)
            .frame(width: 0, height: 0)
            .allowsHitTesting(false)
    }
}

// MARK: - ShakeDetectingViewController

/// A UIViewController whose sole purpose is to become first responder
/// and forward shake-motion events to the associated `ShakeDetector`.
final class ShakeDetectingViewController: UIViewController {

    /// A closure invoked when a shake gesture ends.
    var onShake: (() -> Void)?

    override var canBecomeFirstResponder: Bool { true }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
    }

    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        super.motionEnded(motion, with: event)
        if motion == .motionShake {
            onShake?()
        }
    }
}

// MARK: - ShakeDetectorRepresentable

/// A `UIViewControllerRepresentable` that embeds a `ShakeDetectingViewController`
/// so SwiftUI views can respond to device shake gestures.
struct ShakeDetectorRepresentable: UIViewControllerRepresentable {

    let detector: ShakeDetector

    func makeUIViewController(context: Context) -> ShakeDetectingViewController {
        let controller = ShakeDetectingViewController()
        controller.onShake = { [weak detector] in
            detector?.handleShake()
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: ShakeDetectingViewController, context: Context) {
        uiViewController.onShake = { [weak detector] in
            detector?.handleShake()
        }
    }
}
