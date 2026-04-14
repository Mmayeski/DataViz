/**
 * node-picker.js — Raycaster-backed tap-to-select for the brain map.
 *
 * Attaches a pointerdown/pointerup listener pair to the canvas; fires
 * onPick(songId) on a genuine tap (small movement delta). Drags are
 * swallowed so the orbit gesture doesn't accidentally select a node.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// If the pointer moves more than this many CSS pixels between down and
// up, the gesture is treated as a drag rather than a tap.
const TAP_SLOP_PX = 8;

export class NodePicker {
    /**
     * @param {HTMLCanvasElement}   canvas
     * @param {THREE.Camera}        camera
     * @param {THREE.InstancedMesh} instancedMesh
     * @param {string[]}            songIds  instanceId -> song id
     */
    constructor(canvas, camera, instancedMesh, songIds) {
        this.canvas        = canvas;
        this.camera        = camera;
        this.instancedMesh = instancedMesh;
        this.songIds       = songIds;

        this._raycaster = new THREE.Raycaster();
        this._ndc       = new THREE.Vector2();
        this._onPick    = null;

        this._downX  = 0;
        this._downY  = 0;
        this._downId = null;

        this._boundDown = (e) => this._handlePointerDown(e);
        this._boundUp   = (e) => this._handlePointerUp(e);

        this.canvas.addEventListener('pointerdown', this._boundDown, { passive: true });
        this.canvas.addEventListener('pointerup',   this._boundUp,   { passive: true });
    }

    /** @param {(id: string) => void} cb */
    setOnPick(cb) {
        this._onPick = cb || null;
    }

    dispose() {
        this.canvas.removeEventListener('pointerdown', this._boundDown);
        this.canvas.removeEventListener('pointerup',   this._boundUp);
        this._onPick = null;
        this.instancedMesh = null;
        this.camera = null;
    }

    // --- Internals ---------------------------------------------------------

    _handlePointerDown(event) {
        this._downX  = event.clientX;
        this._downY  = event.clientY;
        this._downId = event.pointerId;
    }

    _handlePointerUp(event) {
        if (event.pointerId !== this._downId) return;
        this._downId = null;

        // Reject if it looks like a drag
        const dx = event.clientX - this._downX;
        const dy = event.clientY - this._downY;
        if ((dx * dx + dy * dy) > (TAP_SLOP_PX * TAP_SLOP_PX)) return;

        if (!this._onPick || !this.instancedMesh || !this.camera) return;

        // Screen coords → normalized device coords
        const rect = this.canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
        const y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
        this._ndc.set(x, y);

        this._raycaster.setFromCamera(this._ndc, this.camera);
        const hits = this._raycaster.intersectObject(this.instancedMesh, false);
        if (hits.length === 0) return;

        // Nearest hit has the smallest distance; intersectObject sorts by default.
        const hit = hits[0];
        const idx = hit.instanceId;
        if (idx == null) return;
        const id = this.songIds[idx];
        if (id == null) return;

        this._onPick(id);
    }
}
