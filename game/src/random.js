// A deterministic PRNG (mulberry32) so a fixed seed always builds the same city,
// the same traffic and the same screenshot frames — repeatability is what makes
// the ?shot= scenes and the live tests stable from run to run.

export function createRandom(seed) {
  // Force the seed into a signed 32-bit integer, whatever the caller passed.
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
