// Keyboard and pointer input for Solara Bay. Movement keys are held state;
// one-shot presses (enter car, punch, accept a mission, pause, mute, confirm)
// are queued as bit flags and picked up exactly once by the game loop, so a
// press that lands between two frames is never lost and never counted twice.
// The mouse is tracked in screen pixels; the renderer turns it into world
// coordinates when the player aims.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_ACCEPT = 16;
export const ACTION_MUTE = 32;

const KEY_UP = new Set(['ArrowUp', 'KeyW']);
const KEY_DOWN = new Set(['ArrowDown', 'KeyS']);
const KEY_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_RUN = new Set(['ShiftLeft', 'ShiftRight']);
const KEY_BRAKE = new Set(['Space']);
const KEY_CONFIRM = new Set(['Enter']);
const KEY_PAUSE = new Set(['KeyP', 'Escape']);
const KEY_INTERACT = new Set(['KeyE']);
const KEY_PUNCH = new Set(['KeyF']);
const KEY_ACCEPT = new Set(['KeyM']);
const KEY_MUTE = new Set(['KeyN']);

// The keys that steer or drive the game also scroll the page by default, so the
// game swallows them; the rest are left alone.
const HELD_KEYS = [KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_RUN, KEY_BRAKE];

function keyIn(code, sets) {
  for (const set of sets) if (set.has(code)) return true;
  return false;
}

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseHeld = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (keyIn(event.code, HELD_KEYS)) event.preventDefault();
      return;
    }
    if (keyIn(event.code, HELD_KEYS)) {
      held.add(event.code);
      event.preventDefault();
    } else if (KEY_CONFIRM.has(event.code)) queued |= ACTION_CONFIRM;
    else if (KEY_PAUSE.has(event.code)) queued |= ACTION_PAUSE;
    else if (KEY_INTERACT.has(event.code)) queued |= ACTION_INTERACT;
    else if (KEY_PUNCH.has(event.code)) queued |= ACTION_PUNCH;
    else if (KEY_ACCEPT.has(event.code)) queued |= ACTION_ACCEPT;
    else if (KEY_MUTE.has(event.code)) queued |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // Losing the window mid-drive must not leave a key stuck down.
  window.addEventListener('blur', () => {
    held.clear();
    mouseHeld = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseHeld = true;
    if (event.button === 0) queued |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseHeld = false;
  });

  function anyHeld(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    moveX() {
      return (anyHeld(KEY_RIGHT) ? 1 : 0) - (anyHeld(KEY_LEFT) ? 1 : 0);
    },
    moveY() {
      return (anyHeld(KEY_DOWN) ? 1 : 0) - (anyHeld(KEY_UP) ? 1 : 0);
    },
    run() {
      return anyHeld(KEY_RUN);
    },
    handbrake() {
      return anyHeld(KEY_BRAKE);
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseHeld };
    },
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
