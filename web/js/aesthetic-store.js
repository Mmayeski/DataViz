/* ================================================================
   aesthetic-store.js
   localStorage-backed CRUD for user-created "aesthetic" tags and
   their assignments to songs. No backend.
   ================================================================ */

const STORAGE_KEY = 'brainmap.aesthetics.v1';

/**
 * Palette of dark-theme-friendly accent colors.
 * Cycled through when auto-assigning a color to a new tag.
 */
const COLOR_PALETTE = [
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#ef4444', // red
    '#14b8a6', // teal
    '#f472b6', // rose
    '#a78bfa', // lavender
    '#facc15', // yellow
    '#22d3ee', // cyan
    '#fb923c', // orange
];

/**
 * Generate a short unique-enough tag id.
 * Format: tag_<time36>_<rand4>
 */
function generateTagId() {
    return `tag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * AestheticStore — in-memory state mirror + localStorage persistence.
 */
export class AestheticStore {
    constructor() {
        /** @type {{tags: Array, assignments: Object<string, string[]>}} */
        this._state = { tags: [], assignments: {} };

        /** public mutation callback */
        this.onChange = null;

        this._load();
    }

    // ---------- persistence ----------

    _load() {
        let raw = null;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            console.warn('[aesthetic-store] localStorage unavailable', e);
        }
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.tags) && parsed.assignments && typeof parsed.assignments === 'object') {
                this._state = {
                    tags: parsed.tags,
                    assignments: parsed.assignments,
                };
            }
        } catch (e) {
            console.warn('[aesthetic-store] corrupted storage, resetting', e);
            this._state = { tags: [], assignments: {} };
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
        } catch (e) {
            console.warn('[aesthetic-store] persist failed', e);
        }
        if (typeof this.onChange === 'function') {
            try { this.onChange(); } catch (e) { console.warn('[aesthetic-store] onChange threw', e); }
        }
    }

    // ---------- tag CRUD ----------

    /** @returns {Array} copy of the tag list */
    listTags() {
        return this._state.tags.slice();
    }

    /**
     * Create a new tag.
     * @param {string} name
     * @param {string} [colorHex] — omit to auto-pick from palette
     * @returns {object|null} the new tag, or null if name was empty
     */
    createTag(name, colorHex) {
        const cleanName = (name || '').trim();
        if (!cleanName) return null;

        const color = colorHex || COLOR_PALETTE[this._state.tags.length % COLOR_PALETTE.length];
        const tag = {
            id: generateTagId(),
            name: cleanName,
            colorHex: color,
            createdAt: new Date().toISOString(),
        };
        this._state.tags.push(tag);
        this._persist();
        return tag;
    }

    renameTag(id, name) {
        const tag = this._state.tags.find(t => t.id === id);
        if (!tag) return;
        const cleanName = (name || '').trim();
        if (!cleanName) return;
        tag.name = cleanName;
        this._persist();
    }

    /** Delete a tag and remove it from every song's assignment list. */
    deleteTag(id) {
        const before = this._state.tags.length;
        this._state.tags = this._state.tags.filter(t => t.id !== id);
        if (this._state.tags.length === before) return; // nothing removed

        for (const songId of Object.keys(this._state.assignments)) {
            const filtered = this._state.assignments[songId].filter(tid => tid !== id);
            if (filtered.length === 0) {
                delete this._state.assignments[songId];
            } else {
                this._state.assignments[songId] = filtered;
            }
        }
        this._persist();
    }

    // ---------- assignments ----------

    assign(songId, tagId) {
        if (!songId || !tagId) return;
        const list = this._state.assignments[songId] || [];
        if (list.includes(tagId)) return;
        list.push(tagId);
        this._state.assignments[songId] = list;
        this._persist();
    }

    unassign(songId, tagId) {
        const list = this._state.assignments[songId];
        if (!list) return;
        const next = list.filter(t => t !== tagId);
        if (next.length === list.length) return; // nothing removed
        if (next.length === 0) {
            delete this._state.assignments[songId];
        } else {
            this._state.assignments[songId] = next;
        }
        this._persist();
    }

    /** @returns {Array<object>} full tag objects for a song */
    getTagsFor(songId) {
        const ids = this._state.assignments[songId] || [];
        return ids
            .map(id => this._state.tags.find(t => t.id === id))
            .filter(Boolean);
    }

    /** @returns {Array<string>} song ids that carry this tag */
    getSongsFor(tagId) {
        const out = [];
        for (const songId of Object.keys(this._state.assignments)) {
            if (this._state.assignments[songId].includes(tagId)) {
                out.push(songId);
            }
        }
        return out;
    }

    /**
     * Compute edges between songs that share at least one tag.
     * Used by the brain-map to draw aesthetic connections.
     * @returns {Array<[string, string]>}
     */
    computeAestheticEdges() {
        // Build tag -> [songIds] index.
        const tagToSongs = new Map();
        for (const [songId, tagIds] of Object.entries(this._state.assignments)) {
            for (const tagId of tagIds) {
                if (!tagToSongs.has(tagId)) tagToSongs.set(tagId, []);
                tagToSongs.get(tagId).push(songId);
            }
        }

        // For each tag, emit every unordered pair of its songs.
        // Use a Set of canonical strings to dedupe across multiple shared tags.
        const seen = new Set();
        const edges = [];
        for (const songIds of tagToSongs.values()) {
            for (let i = 0; i < songIds.length; i++) {
                for (let j = i + 1; j < songIds.length; j++) {
                    const a = songIds[i];
                    const b = songIds[j];
                    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    edges.push(a < b ? [a, b] : [b, a]);
                }
            }
        }
        return edges;
    }
}
