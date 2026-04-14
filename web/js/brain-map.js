/**
 * brain-map.js — Three.js 3D cluster visualization of songs.
 *
 * Renders songs as small spheres in a 3D cluster, with edges connecting
 * each node to its neighbors under the current mode (spectrum / aesthetic
 * / raw). Camera orbits around the cluster centroid based on device tilt
 * (roll/pitch) and zooms in/out via the proximity sensor.
 *
 * The renderer uses a dirty-flag pattern: renders are only issued when
 * state actually changes, to save battery on mobile.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/** Visualization modes. */
export const Mode = {
    SPECTRUM:  'spectrum',
    AESTHETIC: 'aesthetic',
    RAW:       'raw',
};

// --- Tunables --------------------------------------------------------------

const POSITION_SCALE     = 3.0;   // expand raw [-1,1] positions to [-3,3]
const NODE_RADIUS        = 0.04;
const NODE_COLOR         = 0x6366f1; // pleasant indigo/blue
const NODE_COLOR_SELECTED = 0xfbbf24; // warm highlight
const EDGE_COLOR         = 0x818cf8;
const EDGE_OPACITY       = 0.25;
const CAMERA_R_NEAR      = 0.8;
const CAMERA_R_FAR       = 2.2;
const DIM_FACTOR         = 0.4;   // non-neighbors keep 40% of their color
const SELECTED_SCALE     = 1.6;
const CROSSFADE_START    = 0.4;
const CROSSFADE_END      = 0.6;

// Reusable temporaries (avoids per-frame allocation)
const _matrix     = new THREE.Matrix4();
const _position   = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale      = new THREE.Vector3(1, 1, 1);
const _spherical  = new THREE.Spherical();
const _color      = new THREE.Color();


// --- Helpers ---------------------------------------------------------------

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
}

/**
 * Build an ordered-pair key for an edge so we can de-duplicate
 * mirror edges (a→b vs b→a).
 */
function edgeKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}


// --- BrainMap --------------------------------------------------------------

export class BrainMap {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{ onNodeTap?: (id: string) => void }} opts
     */
    constructor(canvas, { onNodeTap } = {}) {
        this.canvas = canvas;
        this.onNodeTap = onNodeTap || null;

        // State
        this._songs     = [];
        this._idToIndex = new Map();   // songId -> instance index
        this._centroid  = new THREE.Vector3();
        this._mode      = Mode.SPECTRUM;
        this._selected  = null;
        this._aestheticEdgePairs = [];

        // Orbit state
        this._rollAngle  = 0;
        this._pitchAngle = 0;
        this._zoomLevel  = 1;   // start zoomed out

        // Three objects
        this._scene = null;
        this._camera = null;
        this._renderer = null;
        this._instancedMesh = null;
        this._spectrumEdges = null;  // LineSegments (always exist if data loaded)
        this._aestheticEdges = null; // LineSegments (for crossfade)
        this._resizeObserver = null;
        this._rafHandle = null;
        this._dirty = true;

        this._initThree();
    }

    // --- Public API --------------------------------------------------------

    /** Build instanced mesh + edges from song data. */
    init(songs) {
        this._songs = songs || [];
        this._idToIndex.clear();
        this._songs.forEach((s, i) => this._idToIndex.set(s.id, i));

        // Centroid of the cluster (in scaled space)
        const c = new THREE.Vector3();
        for (const s of this._songs) {
            c.x += s.position[0] * POSITION_SCALE;
            c.y += s.position[1] * POSITION_SCALE;
            c.z += s.position[2] * POSITION_SCALE;
        }
        if (this._songs.length > 0) c.divideScalar(this._songs.length);
        this._centroid.copy(c);

        this._buildNodes();
        this._rebuildEdges();
        this._updateCamera();
        this._markDirty();
    }

    /** @param {number} rollAngle  in [-1, 1] @param {number} pitchAngle in [-1, 1] */
    setOrbit(rollAngle, pitchAngle) {
        this._rollAngle  = clamp(rollAngle,  -1, 1);
        this._pitchAngle = clamp(pitchAngle, -1, 1);
        this._updateCamera();
        this._markDirty();
    }

    /** @param {number} zoomLevel 0 (close) to 1 (far). */
    setZoom(zoomLevel) {
        this._zoomLevel = clamp(zoomLevel, 0, 1);
        this._updateCamera();
        this._updateEdgeCrossfade();
        this._markDirty();
    }

    /** @param {string} mode one of Mode.* */
    setMode(mode) {
        if (mode === this._mode) return;
        this._mode = mode;
        this._rebuildEdges();
        this._applyNodeHighlights();
        this._markDirty();
    }

    /** @param {string|null} id */
    setSelected(id) {
        if (id === this._selected) return;
        this._selected = id;
        this._applyNodeHighlights();
        this._rebuildEdges();
        this._markDirty();
    }

    /** @param {Array<[string, string]>} edgePairs */
    setAestheticEdges(edgePairs) {
        this._aestheticEdgePairs = Array.isArray(edgePairs) ? edgePairs : [];
        this._rebuildEdges();
        this._markDirty();
    }

    /** Tear down GPU resources and listeners. */
    dispose() {
        if (this._rafHandle !== null) cancelAnimationFrame(this._rafHandle);
        this._rafHandle = null;

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }

        this._disposeEdges(this._spectrumEdges);
        this._disposeEdges(this._aestheticEdges);
        this._spectrumEdges = null;
        this._aestheticEdges = null;

        if (this._instancedMesh) {
            this._instancedMesh.geometry.dispose();
            this._instancedMesh.material.dispose();
            this._scene.remove(this._instancedMesh);
            this._instancedMesh = null;
        }

        if (this._renderer) {
            this._renderer.dispose();
            this._renderer = null;
        }

        this._scene = null;
        this._camera = null;
    }

    /** Exposed for NodePicker. */
    get camera()        { return this._camera; }
    get instancedMesh() { return this._instancedMesh; }
    get songIds()       { return this._songs.map(s => s.id); }

    // --- Internals ---------------------------------------------------------

    _initThree() {
        this._scene = new THREE.Scene();
        // Keep background transparent so CSS bg shows through.
        this._scene.background = null;

        const w = this.canvas.clientWidth  || 1;
        const h = this.canvas.clientHeight || 1;

        this._camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 100);
        this._camera.position.set(0, 0, CAMERA_R_FAR);

        this._renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this._renderer.setClearColor(0x000000, 0); // fully transparent
        this._renderer.setSize(w, h, false);

        // Soft shading
        const ambient = new THREE.AmbientLight(0xffffff, 0.55);
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(2, 3, 4);
        this._scene.add(ambient);
        this._scene.add(dir);

        // Responsive sizing
        this._resizeObserver = new ResizeObserver(() => this._handleResize());
        this._resizeObserver.observe(this.canvas);

        // Render loop (dirty-flag driven)
        const tick = () => {
            this._rafHandle = requestAnimationFrame(tick);
            if (this._dirty && this._renderer) {
                this._renderer.render(this._scene, this._camera);
                this._dirty = false;
            }
        };
        this._rafHandle = requestAnimationFrame(tick);
    }

    _handleResize() {
        if (!this._renderer || !this._camera) return;
        const w = this.canvas.clientWidth  || 1;
        const h = this.canvas.clientHeight || 1;
        this._renderer.setSize(w, h, false);
        this._camera.aspect = w / h;
        this._camera.updateProjectionMatrix();
        this._markDirty();
    }

    _buildNodes() {
        // If rebuilding, dispose previous mesh first.
        if (this._instancedMesh) {
            this._instancedMesh.geometry.dispose();
            this._instancedMesh.material.dispose();
            this._scene.remove(this._instancedMesh);
            this._instancedMesh = null;
        }

        const count = this._songs.length;
        if (count === 0) return;

        const geometry = new THREE.SphereGeometry(NODE_RADIUS, 16, 12);
        const material = new THREE.MeshStandardMaterial({
            metalness: 0.1,
            roughness: 0.6,
        });

        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Per-instance color buffer
        const colors = new Float32Array(count * 3);
        const instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = instanceColor;

        const baseColor = new THREE.Color(NODE_COLOR);
        for (let i = 0; i < count; i++) {
            const s = this._songs[i];
            _position.set(
                s.position[0] * POSITION_SCALE,
                s.position[1] * POSITION_SCALE,
                s.position[2] * POSITION_SCALE,
            );
            _matrix.compose(_position, _quaternion, _scale);
            mesh.setMatrixAt(i, _matrix);
            mesh.setColorAt(i, baseColor);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        this._scene.add(mesh);
        this._instancedMesh = mesh;
    }

    /**
     * Apply selection-driven highlights (scale + color intensity) to nodes.
     */
    _applyNodeHighlights() {
        const mesh = this._instancedMesh;
        if (!mesh) return;

        const baseColor = new THREE.Color(NODE_COLOR);
        const selColor  = new THREE.Color(NODE_COLOR_SELECTED);

        const selectedIndex =
            this._selected != null ? this._idToIndex.get(this._selected) : null;

        const neighborSet = new Set();
        if (this._selected != null) {
            const song = this._songs[selectedIndex];
            if (song && song.neighbors) {
                const list = song.neighbors[this._mode] || song.neighbors.combined || [];
                for (const n of list) neighborSet.add(n.id);
            }
            neighborSet.add(this._selected);
        }

        for (let i = 0; i < this._songs.length; i++) {
            const s = this._songs[i];
            const isSelected = (i === selectedIndex);
            const isNeighbor = neighborSet.has(s.id);

            // Position
            _position.set(
                s.position[0] * POSITION_SCALE,
                s.position[1] * POSITION_SCALE,
                s.position[2] * POSITION_SCALE,
            );

            // Scale (selected node is a bit bigger)
            const scl = isSelected ? SELECTED_SCALE : 1.0;
            _scale.set(scl, scl, scl);
            _matrix.compose(_position, _quaternion, _scale);
            mesh.setMatrixAt(i, _matrix);

            // Color
            if (isSelected) {
                _color.copy(selColor);
            } else if (this._selected == null || isNeighbor) {
                _color.copy(baseColor);
            } else {
                // Non-neighbor: dim toward black
                _color.copy(baseColor).multiplyScalar(DIM_FACTOR);
            }
            mesh.setColorAt(i, _color);
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    /**
     * Collect and de-duplicate edges for a given edge-producer.
     * producer: (song) => Array<{ id }> returning this song's neighbors.
     */
    _collectEdgesFromNeighbors(producer) {
        const pairs = [];
        const seen = new Set();
        for (const s of this._songs) {
            const list = producer(s) || [];
            for (const n of list) {
                if (!this._idToIndex.has(n.id)) continue;
                const k = edgeKey(s.id, n.id);
                if (seen.has(k)) continue;
                seen.add(k);
                pairs.push([s.id, n.id]);
            }
        }
        return pairs;
    }

    _collectSpectrumPairs() {
        return this._collectEdgesFromNeighbors(
            (s) => s.neighbors && s.neighbors.spectrum,
        );
    }

    _collectAestheticPairs() {
        // Prefer an explicitly-provided list (from /setAestheticEdges/);
        // fall back to the per-song neighbors.semantic list from the JSON.
        if (this._aestheticEdgePairs && this._aestheticEdgePairs.length > 0) {
            const seen = new Set();
            const out = [];
            for (const [a, b] of this._aestheticEdgePairs) {
                if (!this._idToIndex.has(a) || !this._idToIndex.has(b)) continue;
                const k = edgeKey(a, b);
                if (seen.has(k)) continue;
                seen.add(k);
                out.push([a, b]);
            }
            return out;
        }
        return this._collectEdgesFromNeighbors(
            (s) => s.neighbors && s.neighbors.semantic,
        );
    }

    /**
     * Rebuild both spectrum and aesthetic edge LineSegments. Depending on
     * mode, one or both may be visible; zoom crossfade is applied after.
     */
    _rebuildEdges() {
        if (this._songs.length === 0) return;

        // Filter to edges that touch the current selection if any
        const selected = this._selected;
        const filterPairs = (pairs) => {
            if (selected == null) return pairs;
            return pairs.filter(([a, b]) => a === selected || b === selected);
        };

        const spectrumPairs  = filterPairs(this._collectSpectrumPairs());
        const aestheticPairs = filterPairs(this._collectAestheticPairs());

        // When mode is RAW, we show no edges at all (but keep the layers
        // instantiated-but-empty so the crossfade code has stable state).
        const showSpectrum  = this._mode !== Mode.RAW;
        const showAesthetic = this._mode !== Mode.RAW;

        this._spectrumEdges  = this._rebuildEdgeLayer(
            this._spectrumEdges,  showSpectrum  ? spectrumPairs  : [], EDGE_COLOR);
        this._aestheticEdges = this._rebuildEdgeLayer(
            this._aestheticEdges, showAesthetic ? aestheticPairs : [], 0xf472b6);

        this._updateEdgeCrossfade();
    }

    /**
     * Create-or-update a LineSegments layer for the given edge pairs.
     * Returns the LineSegments object.
     */
    _rebuildEdgeLayer(existing, pairs, colorHex) {
        // Dispose old geometry (material can be reused).
        let line = existing;
        if (line) {
            line.geometry.dispose();
            this._scene.remove(line);
        }

        const positions = new Float32Array(pairs.length * 6);
        for (let i = 0; i < pairs.length; i++) {
            const [a, b] = pairs[i];
            const sa = this._songs[this._idToIndex.get(a)];
            const sb = this._songs[this._idToIndex.get(b)];
            const o = i * 6;
            positions[o    ] = sa.position[0] * POSITION_SCALE;
            positions[o + 1] = sa.position[1] * POSITION_SCALE;
            positions[o + 2] = sa.position[2] * POSITION_SCALE;
            positions[o + 3] = sb.position[0] * POSITION_SCALE;
            positions[o + 4] = sb.position[1] * POSITION_SCALE;
            positions[o + 5] = sb.position[2] * POSITION_SCALE;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = existing
            ? existing.material
            : new THREE.LineBasicMaterial({
                  transparent:   true,
                  opacity:       EDGE_OPACITY,
                  color:         colorHex,
                  vertexColors:  false,
              });

        line = new THREE.LineSegments(geometry, material);
        line.frustumCulled = false;
        this._scene.add(line);
        return line;
    }

    _disposeEdges(line) {
        if (!line) return;
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
        if (this._scene) this._scene.remove(line);
    }

    /**
     * Crossfade edge opacities based on the current zoom level.
     *
     * - zoom > CROSSFADE_END   (zoomed out):   spectrum only
     * - zoom < CROSSFADE_START (zoomed in):    aesthetic only
     * - zoom in-between:                       linear crossfade
     *
     * When the mode is explicitly AESTHETIC or SPECTRUM (non-raw), we bias
     * toward the chosen layer; crossfade only applies in SPECTRUM mode,
     * which is the "default" exploratory view.
     */
    _updateEdgeCrossfade() {
        if (!this._spectrumEdges || !this._aestheticEdges) return;

        const z = this._zoomLevel;
        let specOpacity = 0;
        let aestOpacity = 0;

        if (this._mode === Mode.RAW) {
            // no edges
        } else if (this._mode === Mode.AESTHETIC) {
            aestOpacity = EDGE_OPACITY;
        } else {
            // SPECTRUM (default): crossfade based on zoom
            if (z >= CROSSFADE_END) {
                specOpacity = EDGE_OPACITY;
            } else if (z <= CROSSFADE_START) {
                aestOpacity = EDGE_OPACITY;
            } else {
                const t = (z - CROSSFADE_START) / (CROSSFADE_END - CROSSFADE_START);
                specOpacity = EDGE_OPACITY * t;
                aestOpacity = EDGE_OPACITY * (1 - t);
            }
        }

        this._spectrumEdges.material.opacity  = specOpacity;
        this._aestheticEdges.material.opacity = aestOpacity;
        this._spectrumEdges.visible  = specOpacity  > 0.001;
        this._aestheticEdges.visible = aestOpacity  > 0.001;
    }

    /**
     * Recompute camera position from orbit state.
     * theta  = rollAngle  * PI
     * phi    = PI/2 + pitchAngle * (PI/2 * 0.9), clamped to [0.1, PI-0.1]
     * radius = lerp(0.8, 2.2, zoomLevel)
     */
    _updateCamera() {
        if (!this._camera) return;

        const theta  = this._rollAngle * Math.PI;
        let   phi    = Math.PI / 2 + this._pitchAngle * (Math.PI / 2 * 0.9);
        phi = clamp(phi, 0.1, Math.PI - 0.1);
        const radius = lerp(CAMERA_R_NEAR, CAMERA_R_FAR, this._zoomLevel);

        _spherical.set(radius, phi, theta);
        this._camera.position
            .setFromSpherical(_spherical)
            .add(this._centroid);
        this._camera.lookAt(this._centroid);
    }

    _markDirty() { this._dirty = true; }
}
