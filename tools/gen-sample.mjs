// Generates web/data/songs.sample.json — deterministic fake fixture
// so UI streams can build without real audio.
//
// Run: node tools/gen-sample.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'web', 'data', 'songs.sample.json');

// Simple seeded PRNG (mulberry32) for deterministic output.
function prng(seed) {
    return function () {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const random = prng(42);
const NUM_SONGS = 20;
const K = 8;

const titles = [
    'Glass Horizon', 'Midnight Cartography', 'Velvet Current', 'Paperwork Dreams',
    'Static Garden', 'Soft Machinery', 'Lunar Drift', 'Neon Orchard',
    'Ceiling Ocean', 'Cobalt Hours', 'Hemisphere Lull', 'Copper Sleep',
    'Vapor Archive', 'Tidal Room', 'Chalk Circuitry', 'Afterimage',
    'Long Daylight', 'Mercury Pulse', 'Warm Static', 'Threshold Song',
];
const artists = [
    'Phantom Loop', 'Sable Motion', 'Kite & Low', 'The Slow Index', 'Marquee Hum',
];

// Generate positions roughly clustered (3 loose clusters).
function pos(i) {
    const cluster = i % 3;
    const center = [
        [ 0.4,  0.0, -0.3],
        [-0.3,  0.4,  0.2],
        [ 0.0, -0.4,  0.3],
    ][cluster];
    return [
        center[0] + (random() - 0.5) * 0.6,
        center[1] + (random() - 0.5) * 0.6,
        center[2] + (random() - 0.5) * 0.6,
    ].map(v => +v.toFixed(4));
}

const songs = Array.from({ length: NUM_SONGS }, (_, i) => {
    const id = `sng_${String(i + 1).padStart(4, '0')}`;
    return {
        id,
        title: titles[i],
        artist: artists[i % artists.length],
        durationSec: +(120 + random() * 180).toFixed(1),
        audioUrl: `audio/${id}.mp3`,
        position: pos(i),
        tempoBpm: Math.round(80 + random() * 80),
        features: {
            centroidMean: +(1500 + random() * 3000).toFixed(1),
            rolloffMean: +(4000 + random() * 4000).toFixed(1),
            rmsMean: +(0.05 + random() * 0.3).toFixed(4),
            zcrMean: +(0.05 + random() * 0.2).toFixed(4),
        },
    };
});

// Fake neighbors: for each song, pick K others at random with decreasing scores.
function pickNeighbors(selfIdx) {
    const indices = Array.from({ length: NUM_SONGS }, (_, j) => j).filter(j => j !== selfIdx);
    // Shuffle
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, K).map((j, rank) => ({
        id: songs[j].id,
        score: +(0.95 - rank * 0.06 - random() * 0.04).toFixed(3),
    }));
}

for (let i = 0; i < NUM_SONGS; i++) {
    songs[i].neighbors = {
        spectrum: pickNeighbors(i),
        semantic: pickNeighbors(i),
        combined: pickNeighbors(i),
    };
}

const out = {
    version: 1,
    generatedAt: new Date().toISOString(),
    isSample: true,
    featureSpec: { handcraftedDim: 70, embeddingDim: 1024, k: K },
    songs,
};

writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${NUM_SONGS} sample songs to ${OUT}`);
