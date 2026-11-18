// Every sound in Solara Bay is procedural WebAudio — there are no audio files.
// A low engine hum tracks the car's speed, a two-tone siren wails while the
// wanted level is up, one-shots cover gunshots, punches, pickups, crashes and
// the mission jingle, and a tiny step sequencer loops a lazy golden-hour groove
// (bass plus a plucked arpeggio) while you play.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let musicTimer = 0;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // Am — F — C — G roots, with a plucked major arpeggio over each bar.
  const BASS = [110, 87.31, 130.81, 98];
  const ARPS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];

  function musicTick() {
    if (!ctx || muted) return;
    const bar = (musicStep >> 3) % 4;
    const beat = musicStep & 7;
    if (beat === 0) tone(BASS[bar], 0.5, 'triangle', 0.16);
    if (beat % 2 === 0) tone(ARPS[bar][(beat >> 1) % 3], 0.22, 'sine', 0.07);
    musicStep += 1;
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    gunshot() { noise(0.16, 0.5, 2400); tone(160, 0.1, 'square', 0.2, 60); },
    punch() { noise(0.09, 0.35, 500); },
    blip() { tone(880, 0.09, 'sine', 0.18, 1320); },
    cash() { tone(660, 0.08, 'sine', 0.18); tone(990, 0.14, 'sine', 0.18); },
    crash() { noise(0.3, 0.5, 900); },
    jingle() {
      if (!ctx || muted) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        setTimeout(() => tone(f, 0.22, 'triangle', 0.2), i * 110);
      });
    },
    wasted() {
      if (!ctx || muted) return;
      [392, 311.13, 233.08, 155.56].forEach((f, i) => {
        setTimeout(() => tone(f, 0.4, 'sawtooth', 0.12), i * 180);
      });
    },
    update(dt, speed01, wanted, inCar) {
      if (!ctx || !started) return;
      if (ctx.state === 'suspended') return;
      if (inCar) {
        engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.09, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
      } else {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      }
      if (wanted > 0) {
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
        sirenTimer -= dt;
        if (sirenTimer <= 0) {
          sirenTimer = 0.42;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 880 : 660, ctx.currentTime, 0.05);
        }
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
      musicTimer -= dt;
      if (musicTimer <= 0) {
        musicTimer = 0.21;
        musicTick();
      }
    },
  };
}
