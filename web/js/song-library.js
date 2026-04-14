/* ================================================================
   song-library.js
   Loads the song library (songs.json, falling back to
   songs.sample.json) and exposes a lookup map + feature spec.
   ================================================================ */

/**
 * Attempt to fetch + parse a JSON file.
 * Returns the parsed object, or null if the request fails in any way.
 */
async function tryLoad(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        return null;
    }
}

/**
 * Load the song library. Tries data/songs.json first,
 * falls back to data/songs.sample.json.
 *
 * @returns {Promise<{songs: Array, byId: Map<string, object>, featureSpec: object}>}
 */
export async function loadLibrary() {
    let parsed = await tryLoad('data/songs.json');
    let isSample = false;

    if (!parsed) {
        parsed = await tryLoad('data/songs.sample.json');
        isSample = true;
    }

    if (!parsed) {
        throw new Error('[song-library] failed to load any library file');
    }

    const songs = Array.isArray(parsed.songs) ? parsed.songs : [];
    const byId = new Map(songs.map(s => [s.id, s]));

    console.info('[song-library] loaded', songs.length, 'songs (sample:', isSample, ')');

    return {
        songs,
        byId,
        featureSpec: parsed.featureSpec || {},
    };
}
