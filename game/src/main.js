// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between title, play, paused and wasted;
// missions, cash and best stats persist in localStorage. ?seed=N fixes the
// city. ?shot=start|drive|chase|mission (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CASH, EVENT_CRASH, EVENT_CRIME, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { ACTION_ACCEPT, ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
// Debug handle for automated play-testing (read-only state inspection).
window.__solara = world;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null) return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  renderer.snapCamera(world.state.player.x, world.state.player.y);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.save, 6, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let flash = null;
  let flashTimer = 0;
  let time = 0;
  let accumulator = 0;
  let last = performance.now();
  let muted = !!(save && save.muted);
  audio.setMuted(muted);

  function announce(message) {
    status.textContent = message;
  }

  function applySave() {
    if (!save) return;
    world.state.cash = save.cash || 40;
    world.state.missionIndex = Math.min(5, save.missionsDone || 0);
    world.state.missionState = world.state.missionIndex >= 5 ? 'done' : 'offered';
    world.state.storyDone = world.state.missionIndex >= 5;
    world.state.stats.bestCash = save.bestCash || world.state.cash;
    world.state.stats.wasted = save.wasted || 0;
    world.state.stats.missionsDone = world.state.missionIndex;
  }

  function persist() {
    const s = world.state;
    save = {
      cash: s.cash,
      missionsDone: s.missionIndex,
      bestCash: Math.max(save ? save.bestCash || 0 : 0, s.stats.bestCash, s.cash),
      wasted: s.stats.wasted,
      muted,
    };
    writeSave(save);
  }

  function startGame(fresh) {
    world.reset();
    if (!fresh) applySave();
    else save = null;
    accumulator = 0;
    flash = null;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing in Solara Bay. Press M to take the next job.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.wasted();
    persist();
    announce(`Wasted. $${world.state.cash} left.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
      persist();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      else if (actions & ACTION_ACCEPT) startGame(true); // M on the title = new game
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame(false);
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        persist();
        announce('Paused.');
      }
    }
    return actions;
  }

  function step(actions) {
    const mouse = input.mouse();
    const aim = renderer.screenToWorld(mouse.x, mouse.y);
    const worldInput = {
      moveX: input.moveX(),
      moveY: input.moveY(),
      run: input.run(),
      steer: input.moveX(),
      accel: input.moveY() < 0 ? 1 : 0,
      brake: input.moveY() > 0 ? 1 : 0,
      handbrake: input.handbrake(),
      interact: !!(actions & ACTION_INTERACT),
      punch: !!(actions & ACTION_PUNCH),
      shoot: mouse.down,
      aimX: aim.x,
      aimY: aim.y,
      accept: !!(actions & ACTION_ACCEPT),
    };
    const events = world.step(STEP, worldInput);
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.blip();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_CRIME) announce(`Heat up: ${world.state.wanted} star${world.state.wanted === 1 ? '' : 's'}.`);
    if (events & EVENT_MISSION) {
      const def = world.missionDef();
      flash = world.state.storyDone ? 'STORY COMPLETE — SOLARA BAY IS YOURS!' : 'JOB DONE — CASH BANKED!';
      flashTimer = 3;
      audio.jingle();
      persist();
      announce(flash);
    }
    if (events & EVENT_WASTED) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    const actions = handleActions();
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) flash = null;
    }
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { moveX: 0, moveY: 0, run: false, steer: 0, accel: 0, brake: 0, handbrake: false, interact: false, punch: false, shoot: false, aimX: 0, aimY: 0, accept: false });
    } else if (screen === SCREEN_PLAY) {
      accumulator += dt;
      let firstStep = true;
      while (accumulator >= STEP) {
        // One-shot pulses (E, F, M) fire on the first step only, never twice.
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    }
    const car = world.playerCar();
    const speed01 = car ? Math.min(1, Math.abs(car.speed) / 560) : 0;
    audio.update(dt, speed01, world.state.wanted, !!car);
    renderer.draw(world, screen, save, time, flash);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      persist();
      announce('Paused.');
    }
  });

  announce('Solara Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
