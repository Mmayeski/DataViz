/* ================================================================
   audio-player.js
   Single-song audio playback wrapper around an <audio> element.
   ================================================================ */

/**
 * AudioPlayer — manages a single hidden <audio> element.
 * Exposes play / pause / togglePlay / stop and change callbacks.
 */
export class AudioPlayer {
    constructor() {
        /** @type {HTMLAudioElement} */
        this._el = document.createElement('audio');
        this._el.style.display = 'none';
        this._el.preload = 'none';
        document.body.appendChild(this._el);

        /** id of the song currently loaded into the element */
        this._currentSongId = null;

        /** public callbacks — consumers may assign directly */
        this.onStateChange = null;
        this.onEnded = null;

        // Wire up DOM events to our callbacks.
        this._el.addEventListener('play', () => this._fireStateChange());
        this._el.addEventListener('pause', () => this._fireStateChange());
        this._el.addEventListener('ended', () => {
            this._fireStateChange();
            if (typeof this.onEnded === 'function') {
                try { this.onEnded(); } catch (e) { console.warn('[audio-player] onEnded threw', e); }
            }
        });
        // Network / decode errors — don't let the UI hang.
        this._el.addEventListener('error', () => {
            console.warn('[audio-player] <audio> error for', this._currentSongId, this._el.error);
            this._fireStateChange();
        });
    }

    _fireStateChange() {
        if (typeof this.onStateChange === 'function') {
            try { this.onStateChange(); } catch (e) { console.warn('[audio-player] onStateChange threw', e); }
        }
    }

    /**
     * Play a song. If the same song is already loaded, just resumes.
     * Otherwise loads song.audioUrl and plays.
     * @param {object} song — must have { id, audioUrl }
     */
    async play(song) {
        if (!song || !song.id) return;

        // Same song already loaded — just resume.
        if (this._currentSongId === song.id && this._el.src) {
            try {
                await this._el.play();
            } catch (err) {
                console.warn('[audio-player] resume failed for', song.id, err);
                this._fireStateChange();
            }
            return;
        }

        // Different song — swap source.
        this._currentSongId = song.id;
        try {
            this._el.src = song.audioUrl || '';
            // Kick off playback. May reject if src 404s or is blocked.
            await this._el.play();
        } catch (err) {
            console.warn('[audio-player] play failed for', song.id, err);
            this._fireStateChange();
        }
    }

    /** Pause playback (keeps currentTime / src). */
    pause() {
        if (!this._el.paused) {
            this._el.pause();
        }
    }

    /**
     * Toggle play/pause for the given song.
     * If the same song is currently playing → pause.
     * Otherwise → play(song).
     */
    togglePlay(song) {
        if (!song || !song.id) return;
        if (this._currentSongId === song.id && this.isPlaying) {
            this.pause();
        } else {
            this.play(song);
        }
    }

    /** Stop playback and reset playhead. */
    stop() {
        this._el.pause();
        try { this._el.currentTime = 0; } catch (_) { /* ignore */ }
    }

    get isPlaying() {
        return !!this._el && !this._el.paused && !this._el.ended && this._el.currentTime >= 0 && this._el.src !== '';
    }

    get currentSongId() {
        return this._currentSongId;
    }
}
