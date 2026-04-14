/* ================================================================
   panel-ui.js
   Bottom-sheet panel shown when a brain-map node (song) is tapped.
   Displays song info, a play button, and a chip editor for user
   "aesthetic" tags.
   ================================================================ */

/**
 * PanelUI — injects a fixed bottom sheet + backdrop into the DOM
 * and manages its open/close state + chip rendering.
 */
export class PanelUI {
    /**
     * @param {object} deps
     * @param {import('./audio-player.js').AudioPlayer} deps.audioPlayer
     * @param {import('./aesthetic-store.js').AestheticStore} deps.aestheticStore
     */
    constructor({ audioPlayer, aestheticStore }) {
        this.audioPlayer = audioPlayer;
        this.aestheticStore = aestheticStore;

        /** song currently displayed in the panel */
        this._song = null;
        this._isOpen = false;

        /** public close callback */
        this.onClose = null;

        this._buildDOM();
        this._wireEvents();

        // Re-render chips when tags elsewhere mutate. Preserve any
        // existing user-supplied handler by chaining.
        const prevStoreChange = this.aestheticStore.onChange;
        this.aestheticStore.onChange = () => {
            if (typeof prevStoreChange === 'function') {
                try { prevStoreChange(); } catch (e) { console.warn('[panel-ui] chained onChange threw', e); }
            }
            if (this._isOpen) this._renderChips();
        };

        // Re-render play button label on audio state changes.
        const prevAudioChange = this.audioPlayer.onStateChange;
        this.audioPlayer.onStateChange = () => {
            if (typeof prevAudioChange === 'function') {
                try { prevAudioChange(); } catch (e) { console.warn('[panel-ui] chained onStateChange threw', e); }
            }
            if (this._isOpen) this._renderPlayButton();
        };
    }

    // ---------- DOM construction ----------

    _buildDOM() {
        // Backdrop
        this.backdropEl = document.createElement('div');
        this.backdropEl.id = 'panel-backdrop';

        // Panel
        this.panelEl = document.createElement('div');
        this.panelEl.id = 'panel';
        this.panelEl.innerHTML = `
            <button id="panel-close" aria-label="Close">✕</button>
            <div id="panel-song-title"></div>
            <div id="panel-song-artist"></div>
            <button id="panel-play">▶ Play</button>
            <div id="panel-tags-header">Aesthetics</div>
            <div id="panel-tags-list"></div>
            <div id="panel-new-tag">
                <input id="panel-new-tag-input" placeholder="new aesthetic…" maxlength="24">
                <button id="panel-new-tag-add">+</button>
            </div>
        `;

        document.body.appendChild(this.backdropEl);
        document.body.appendChild(this.panelEl);

        // Cache refs
        this.titleEl = this.panelEl.querySelector('#panel-song-title');
        this.artistEl = this.panelEl.querySelector('#panel-song-artist');
        this.playBtn = this.panelEl.querySelector('#panel-play');
        this.closeBtn = this.panelEl.querySelector('#panel-close');
        this.tagsListEl = this.panelEl.querySelector('#panel-tags-list');
        this.newTagInput = this.panelEl.querySelector('#panel-new-tag-input');
        this.newTagAddBtn = this.panelEl.querySelector('#panel-new-tag-add');
    }

    _wireEvents() {
        this.closeBtn.addEventListener('click', () => this.close());
        this.backdropEl.addEventListener('click', () => this.close());

        this.playBtn.addEventListener('click', () => {
            if (!this._song) return;
            this.audioPlayer.togglePlay(this._song);
            // onStateChange will fire on play/pause; but play() failure
            // is also surfaced there, so this is covered.
        });

        this.newTagAddBtn.addEventListener('click', () => this._handleAddTag());
        this.newTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._handleAddTag();
            }
        });
    }

    _handleAddTag() {
        if (!this._song) return;
        const name = this.newTagInput.value.trim();
        if (!name) return;
        const tag = this.aestheticStore.createTag(name);
        if (tag) {
            this.aestheticStore.assign(this._song.id, tag.id);
        }
        this.newTagInput.value = '';
        // onChange from the store will re-render chips.
    }

    // ---------- rendering ----------

    _renderPlayButton() {
        const playingThis = this.audioPlayer.isPlaying &&
            this.audioPlayer.currentSongId === (this._song && this._song.id);
        this.playBtn.textContent = playingThis ? '❚❚ Pause' : '▶ Play';
    }

    _renderChips() {
        if (!this._song) {
            this.tagsListEl.innerHTML = '';
            return;
        }

        const allTags = this.aestheticStore.listTags();
        const assignedIds = new Set(
            this.aestheticStore.getTagsFor(this._song.id).map(t => t.id)
        );

        // Build fresh — panels are small enough to rebuild on each change.
        this.tagsListEl.innerHTML = '';
        for (const tag of allTags) {
            const isAssigned = assignedIds.has(tag.id);
            const chip = document.createElement('button');
            chip.className = 'tag-chip' + (isAssigned ? ' assigned' : '');
            chip.type = 'button';
            chip.textContent = tag.name;
            chip.dataset.tagId = tag.id;

            if (isAssigned) {
                chip.style.backgroundColor = tag.colorHex;
                chip.style.borderColor = tag.colorHex;
                chip.style.color = '#fff';
            } else {
                chip.style.backgroundColor = 'transparent';
                chip.style.borderColor = tag.colorHex;
                chip.style.color = tag.colorHex;
            }

            chip.addEventListener('click', () => {
                if (!this._song) return;
                if (isAssigned) {
                    this.aestheticStore.unassign(this._song.id, tag.id);
                } else {
                    this.aestheticStore.assign(this._song.id, tag.id);
                }
                // Re-render happens via store.onChange.
            });

            this.tagsListEl.appendChild(chip);
        }
    }

    // ---------- public API ----------

    /**
     * Open the panel for a given song.
     * @param {object} song — library song object ({ id, title, artist, audioUrl, ... })
     */
    open(song) {
        if (!song) return;
        this._song = song;
        this._isOpen = true;

        this.titleEl.textContent = song.title || song.id || 'Untitled';
        this.artistEl.textContent = song.artist || '';
        this._renderPlayButton();
        this._renderChips();

        this.backdropEl.classList.add('panel-open');
        this.panelEl.classList.add('panel-open');
    }

    /** Hide the panel and notify any onClose handler. */
    close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.backdropEl.classList.remove('panel-open');
        this.panelEl.classList.remove('panel-open');
        this._song = null;

        if (typeof this.onClose === 'function') {
            try { this.onClose(); } catch (e) { console.warn('[panel-ui] onClose threw', e); }
        }
    }

    get isOpen() {
        return this._isOpen;
    }
}
