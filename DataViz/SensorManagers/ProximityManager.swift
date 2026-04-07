import ARKit
import Observation

@Observable
final class ProximityManager: NSObject, ARSessionDelegate {

    // MARK: - Public Properties

    /// Distance from the device to the user's face in meters; nil when no face is detected.
    private(set) var faceDistance: Double?

    /// Zoom level mapped from face distance.
    /// 0.0 = fully zoomed in (single month), 1.0 = fully zoomed out (all months).
    /// Defaults to fully zoomed out when tracking is unavailable.
    private(set) var zoomLevel: Double = 1.0

    /// When zoomed in (zoomLevel < 0.5), the month index (0-11) the user is focusing on
    /// based on lateral face position. nil when zoomed out or no face detected.
    private(set) var focusedMonthIndex: Int?

    /// Whether ARKit face tracking is supported on this device.
    private(set) var isAvailable: Bool = false

    /// Whether a face is currently being tracked.
    private(set) var isTracking: Bool = false

    // MARK: - Private Properties

    private let arSession = ARSession()

    /// Exponential smoothing factor. Lower = smoother but more latent.
    private let smoothingFactor: Double = 0.3

    /// The previously smoothed distance, used for exponential smoothing.
    private var smoothedDistance: Double?

    // MARK: - Distance-to-Zoom Mapping Constants

    /// Face distance (meters) that maps to zoomLevel 0.0 (fully zoomed in).
    private let minDistance: Double = 0.2

    /// Face distance (meters) at or above which zoomLevel is 1.0 (fully zoomed out).
    private let maxDistance: Double = 0.6

    // MARK: - Lateral Mapping Constants

    /// Expected lateral range of the face X position in meters (roughly ±15 cm).
    private let lateralMin: Double = -0.15
    private let lateralMax: Double = 0.15

    // MARK: - Initializer

    override init() {
        super.init()
        isAvailable = ARFaceTrackingConfiguration.isSupported
        arSession.delegate = self
    }

    // MARK: - Public Methods

    /// Starts face-tracking if the device supports it. No-op otherwise.
    func start() {
        guard isAvailable else { return }

        let configuration = ARFaceTrackingConfiguration()
        configuration.isLightEstimationEnabled = false
        arSession.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    }

    /// Pauses the AR session and resets tracking state.
    func stop() {
        arSession.pause()
        resetState()
    }

    // MARK: - ARSessionDelegate

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        guard let faceAnchor = anchors.compactMap({ $0 as? ARFaceAnchor }).first else {
            return
        }

        let transform = faceAnchor.transform

        // ARKit's camera coordinate system has -Z pointing out from the camera.
        // The face anchor transform's translation column (column 3) gives the
        // face position in camera space. Negate Z to get a positive distance.
        let rawDistance = Double(-transform.columns.3.z)

        // Apply exponential smoothing.
        let smoothed: Double
        if let previous = smoothedDistance {
            smoothed = previous + smoothingFactor * (rawDistance - previous)
        } else {
            smoothed = rawDistance
        }
        smoothedDistance = smoothed

        // Update public state.
        faceDistance = smoothed
        isTracking = faceAnchor.isTracked

        // Map distance to zoom level: 0.2m → 0.0, 0.6m → 1.0, clamped.
        let normalized = (smoothed - minDistance) / (maxDistance - minDistance)
        zoomLevel = min(max(normalized, 0.0), 1.0)

        // Determine focused month from lateral position when zoomed in.
        if zoomLevel < 0.5 {
            let lateralX = Double(transform.columns.3.x)
            let lateralNormalized = (lateralX - lateralMin) / (lateralMax - lateralMin)
            let clamped = min(max(lateralNormalized, 0.0), 1.0)
            focusedMonthIndex = min(Int(clamped * 12.0), 11)
        } else {
            focusedMonthIndex = nil
        }
    }

    func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
        let removedFace = anchors.contains { $0 is ARFaceAnchor }
        if removedFace {
            resetState()
        }
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        resetState()
    }

    func sessionWasInterrupted(_ session: ARSession) {
        resetState()
    }

    // MARK: - Private Helpers

    private func resetState() {
        faceDistance = nil
        smoothedDistance = nil
        isTracking = false
        zoomLevel = 1.0
        focusedMonthIndex = nil
    }
}
