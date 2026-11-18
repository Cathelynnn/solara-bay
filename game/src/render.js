// Drawing only: the world's state and the current screen go in, pixels come
// out. A camera follows the player across the 3200x2400 city; the golden-hour
// feel is baked into the palette (a warm wash, long building shadows). The HUD
// carries cash, wanted stars, health, ammo, speed, the objective line and a
// live minimap.
import { BEACH_X, FONT, OCEAN_X, PALETTE, PLAYER, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';
import { isRoad } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW_W = 1280;
const VIEW_H = 720;
const MINI = { x: 1052, y: 16, w: 212, h: 158 };

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const camera = { x: 1000, y: 1400 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.dpr = ratio;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.x = (canvas.width - VIEW_W * view.scale) / 2;
    view.y = (canvas.height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawGround(world) {
    const { buildings, palms } = world.city;
    // Grass base, then the ocean and the sand on the east edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = PALETTE.oceanDeep;
    ctx.fillRect(OCEAN_X, 0, WORLD.width - OCEAN_X, WORLD.height);
    ctx.fillStyle = PALETTE.ocean;
    ctx.fillRect(OCEAN_X, 0, 90, WORLD.height);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(BEACH_X, 0, OCEAN_X - BEACH_X, WORLD.height);
    // Sidewalk strips along every road.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - 14, 0, ROAD_W + 28, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2 - 14, WORLD.width, ROAD_W + 28);
    // Asphalt.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of ROADS_X) {
      for (let y = 20; y < WORLD.height; y += 64) ctx.fillRect(rx - 3, y, 6, 30);
    }
    for (const ry of ROADS_Y) {
      for (let x = 20; x < WORLD.width; x += 64) ctx.fillRect(x, ry - 3, 30, 6);
    }
    // Buildings: long shadow, wall, roof, windows.
    for (const b of buildings) {
      ctx.fillStyle = 'rgba(40, 20, 10, 0.28)';
      ctx.fillRect(b.x + b.height * 0.45, b.y + b.height * 0.45, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x + 3, b.y + 3, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255, 246, 232, 0.35)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx + cy) % 2 === 0) ctx.fillRect(b.x + 8 + cx * 26, b.y + 8 + cy * 26, 10, 10);
        }
      }
    }
    // Palms.
    for (const palm of palms) {
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + palm.lean * 26, palm.y - 26);
      ctx.stroke();
      ctx.fillStyle = '#3f8f4f';
      const topX = palm.x + palm.lean * 26;
      const topY = palm.y - 26;
      for (let f = 0; f < 5; f += 1) {
        const a = (f / 5) * Math.PI * 2 + palm.lean;
        ctx.beginPath();
        ctx.ellipse(topX + Math.cos(a) * 12, topY + Math.sin(a) * 8, 14, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Marina boat at the east edge — the heist getaway.
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(OCEAN_X + 18, 1170, 64, 22);
    ctx.fillStyle = '#3d7dd9';
    ctx.fillRect(OCEAN_X + 34, 1152, 30, 18);
  }

  function drawPickup(pk, time) {
    const bob = Math.sin(pk.bob) * 3;
    const y = pk.y + bob;
    if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 11, y - 11, 22, 22);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(pk.x - 3, y - 8, 6, 16);
      ctx.fillRect(pk.x - 8, y - 3, 16, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(pk.x - 10, y - 7, 20, 14);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(pk.x - 7, y - 4, 4, 8);
      ctx.fillRect(pk.x - 1, y - 4, 4, 8);
      ctx.fillRect(pk.x + 5, y - 4, 4, 8);
    } else if (pk.kind === 'cash') {
      ctx.fillStyle = '#58d68d';
      ctx.fillRect(pk.x - 11, y - 7, 22, 14);
      text('$', pk.x, y + 5, 13, '#14532d', 'center');
    } else {
      // Mission package / loot: a pulsing gold diamond.
      const pulse = 1 + Math.sin(time * 5) * 0.15;
      ctx.fillStyle = PALETTE.gold;
      ctx.save();
      ctx.translate(pk.x, y);
      ctx.rotate(Math.PI / 4);
      ctx.scale(pulse, pulse);
      ctx.fillRect(-10, -10, 20, 20);
      ctx.restore();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pk.x, y, 24 + Math.sin(time * 5) * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(40, 20, 10, 0.3)';
    ctx.fillRect(-26, -12, 54, 28);
    // Wheels.
    ctx.fillStyle = '#161616';
    ctx.fillRect(-20, -16, 12, 6);
    ctx.fillRect(8, -16, 12, 6);
    ctx.fillRect(-20, 10, 12, 6);
    ctx.fillRect(8, 10, 12, 6);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-27, -13, 54, 26, 7);
    ctx.fill();
    // Windshield and roof.
    ctx.fillStyle = 'rgba(180, 220, 240, 0.85)';
    ctx.fillRect(6, -10, 10, 20);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(-8, -10, 12, 20);
    if (car.kind === 'taxi') {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(-4, -13, 8, 26);
      text('TAXI', 0, 4, 8, '#222', 'center');
    }
    if (car.kind === 'cop') {
      ctx.fillStyle = '#161616';
      ctx.fillRect(-27, -13, 14, 26);
      const blink = Math.floor(time * 4 + car.flash) % 2 === 0;
      ctx.fillStyle = blink ? PALETTE.copLightR : PALETTE.copLightB;
      circle(ctx, -2, -8, 4);
      circle(ctx, -2, 8, 4);
      ctx.fillStyle = '#fff';
      text('PD', -14, 4, 9, '#161616', 'center');
    }
    if (car.kind === 'sport') {
      ctx.fillStyle = '#ff5a3c';
      ctx.fillRect(-27, -13, 6, 26);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, walkPhase, dead) {
    if (dead) {
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(x, y, 13, 7, angle, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const bob = Math.sin(walkPhase) * 2;
    ctx.fillStyle = 'rgba(40, 20, 10, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    circle(ctx, x, y + bob * 0.3, 11);
    ctx.fillStyle = '#e8b98a';
    circle(ctx, x + Math.cos(angle) * 4, y + Math.sin(angle) * 4 + bob * 0.3, 6);
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4 + bob * 0.3, 6, angle - 1.4, angle + 1.4);
    ctx.fill();
  }

  function drawWorld(world, time) {
    const s = world.state;
    drawGround(world);
    // Mission marker: a gold beacon with a pulsing ring at the target.
    const target = world.missionTarget();
    if (target && s.missionState === 'active') {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 34 + Math.sin(time * 4) * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 52 - Math.sin(time * 4) * 6);
      ctx.lineTo(target.x - 9, target.y - 30);
      ctx.lineTo(target.x + 9, target.y - 30);
      ctx.closePath();
      ctx.fill();
    }
    for (const pk of s.pickups) if (pk.active) drawPickup(pk, time);
    for (const ped of s.peds) drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.walkPhase, ped.dead);
    for (const car of s.cars) drawCar(car, time);
    for (const cop of s.cops) {
      if (cop.down) drawPerson(cop.x, cop.y, cop.angle, '#3b6fd4', 0, true);
      else drawPerson(cop.x, cop.y, cop.angle, '#3b6fd4', time * 8, false);
    }
    // The player: Mara, teal jacket, gold hair.
    const p = s.player;
    if (!p.inCar) {
      drawPerson(p.x, p.y, p.angle, '#2ec4b6', p.walkPhase, false);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 6, p.angle - 1.2, p.angle + 1.2);
      ctx.fill();
      if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Bullets as tracers.
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 2;
    for (const b of s.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of s.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      circle(ctx, pt.x, pt.y, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawMinimap(world) {
    const s = world.state;
    const sx = MINI.w / WORLD.width;
    const sy = MINI.h / WORLD.height;
    ctx.fillStyle = PALETTE.minimapBg;
    ctx.fillRect(MINI.x, MINI.y, MINI.w, MINI.h);
    ctx.strokeStyle = PALETTE.hudBg;
    ctx.lineWidth = 2;
    ctx.strokeRect(MINI.x, MINI.y, MINI.w, MINI.h);
    ctx.fillStyle = '#8a7f70';
    for (const rx of ROADS_X) ctx.fillRect(MINI.x + rx * sx - 2, MINI.y, 4, MINI.h);
    for (const ry of ROADS_Y) ctx.fillRect(MINI.x, MINI.y + ry * sy - 2, MINI.w, 4);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(MINI.x + OCEAN_X * sx, MINI.y, MINI.w - OCEAN_X * sx, MINI.h);
    ctx.fillStyle = '#e8cf96';
    ctx.fillRect(MINI.x + BEACH_X * sx, MINI.y, (OCEAN_X - BEACH_X) * sx, MINI.h);
    const target = world.missionTarget();
    if (target && s.missionState === 'active') {
      ctx.fillStyle = PALETTE.gold;
      circle(ctx, MINI.x + target.x * sx, MINI.y + target.y * sy, 5);
    }
    for (const car of s.cars) {
      if (car.kind === 'cop' && car.driver === 'cop') {
        ctx.fillStyle = '#ff3b30';
        circle(ctx, MINI.x + car.x * sx, MINI.y + car.y * sy, 3);
      }
    }
    for (const cop of s.cops) {
      if (!cop.down) {
        ctx.fillStyle = '#ff3b30';
        circle(ctx, MINI.x + cop.x * sx, MINI.y + cop.y * sy, 2);
      }
    }
    // Player arrow.
    ctx.save();
    ctx.translate(MINI.x + s.player.x * sx, MINI.y + s.player.y * sy);
    ctx.rotate(s.player.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHud(world, time) {
    const s = world.state;
    ctx.textBaseline = 'alphabetic';
    // Cash and health, top-left.
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(14, 12, 250, 64);
    text(`$${s.cash}`, 26, 40, 26, '#58d68d', 'left');
    text(`Ammo ${s.ammo}`, 150, 40, 18, PALETTE.text, 'left');
    ctx.fillStyle = '#3a2c22';
    ctx.fillRect(26, 50, 226, 12);
    ctx.fillStyle = s.player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(26, 50, 226 * (s.player.health / PLAYER.health), 12);
    // Wanted stars, top-centre.
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(VIEW_W / 2 - 110, 12, 220, 44);
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < s.wanted ? '★' : '☆';
    text(stars, VIEW_W / 2, 44, 26, s.wanted > 0 ? PALETTE.star : PALETTE.starEmpty, 'center');
    // Objective line, under the stars.
    const def = world.missionDef();
    let objective = 'Press M to take the next job.';
    if (def && s.missionState === 'active') {
      objective = def.name + ' — ' + def.hint;
      if (def.id === 'dockside-run') objective += ` (${s.packagesGot}/3)`;
      if (def.id === 'heat-check') objective += ` (peak ${s.missionHeat}★)`;
      if (def.timeLimit) objective += ` — ${Math.max(0, Math.ceil(s.missionTimer))}s left`;
    } else if (s.storyDone) {
      objective = 'Story complete — Solara Bay is yours. Free roam!';
    } else if (def && s.missionState === 'offered') {
      objective = `${def.name}: ${def.brief} (press M)`;
    }
    ctx.fillStyle = PALETTE.hudBg;
    ctx.font = `bold 15px ${FONT}`;
    const ow = Math.min(820, ctx.measureText(objective).width + 28);
    ctx.fillRect(VIEW_W / 2 - ow / 2, 62, ow, 30);
    text(objective, VIEW_W / 2, 83, 15, PALETTE.text, 'center');
    // Speed, bottom-right.
    const car = world.playerCar();
    if (car) {
      const mph = Math.round(Math.abs(car.speed) * 0.12);
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(VIEW_W - 150, VIEW_H - 64, 136, 50);
      text(`${mph}`, VIEW_W - 96, VIEW_H - 26, 30, PALETTE.text, 'center');
      text('MPH', VIEW_W - 40, VIEW_H - 30, 13, PALETTE.muted, 'left');
      if (Math.abs(car.speed) > 420) {
        // Speed lines at the screen edges.
        ctx.strokeStyle = 'rgba(255, 246, 232, 0.25)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i += 1) {
          const y = 80 + i * 100 + ((time * 600) % 100);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(46, y);
          ctx.moveTo(VIEW_W, y + 40);
          ctx.lineTo(VIEW_W - 46, y + 40);
          ctx.stroke();
        }
      }
    }
    // Controls reminder, bottom-left.
    text('E car · F punch · Click shoot · M mission · P pause · N mute', 16, VIEW_H - 16, 13, PALETTE.muted, 'left');
    drawMinimap(world);
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineH = 30;
    const height = 150 + lines.length * lineH + 70;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW_W / 2, y + 74, 44, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 128 + i * lineH, 19, PALETTE.muted, 'center');
    }
    text(prompt, VIEW_W / 2, y + height - 30, 20, PALETTE.gold, 'center');
  }

  function draw(world, screen, save, time, flash) {
    const s = world.state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // The camera chases the player, clamped to the world, plus shake.
    const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
    const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
    camera.x += (s.player.x - camera.x) * 0.12;
    camera.y += (s.player.y - camera.y) * 0.12;
    const camX = Math.max(VIEW_W / 2, Math.min(WORLD.width - VIEW_W / 2, camera.x)) + shakeX;
    const camY = Math.max(VIEW_H / 2, Math.min(WORLD.height - VIEW_H / 2, camera.y)) + shakeY;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x - (camX - VIEW_W / 2) * view.scale, view.y - (camY - VIEW_H / 2) * view.scale);
    drawWorld(world, time);
    // Back to screen space for the HUD and the panels.
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Golden-hour wash over everything.
    ctx.fillStyle = 'rgba(255, 170, 80, 0.07)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Sun, salt and stolen cars.',
        'Mara Reyes came back to Solara Bay with $40 and a grudge.',
        'The Bay Bank took her brother’s garage. Tonight she takes it back.',
        '',
        'WASD walk · Shift run · E enter car · W/S drive · Space handbrake',
        'Mouse aim + Click shoot · F punch · M accept mission · P pause',
        '',
        save && save.missionsDone > 0 ? `Continue: ${save.missionsDone} of 5 jobs done · $${save.cash} in pocket` : 'New game: $40, no heat, five jobs ahead.',
        save ? `Best haul $${save.bestCash || 0} · ${save.wasted || 0} times wasted` : '',
      ];
      drawPanel('SOLARA BAY', lines, save && save.missionsDone > 0 ? 'Press Enter to continue — or M for a new game' : 'Press Enter or click to start', PALETTE.gold);
      return;
    }
    drawHud(world, time);
    if (flash) {
      ctx.fillStyle = 'rgba(255, 220, 120, 0.85)';
      ctx.fillRect(VIEW_W / 2 - 240, 120, 480, 56);
      text(flash, VIEW_W / 2, 156, 24, '#3a2400', 'center');
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits. The cops do not forget.', `Cash $${s.cash} · ${s.stats.missionsDone} of 5 jobs done`], 'Press P to resume', PALETTE.text);
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', ['The cops scraped you off the asphalt.', `You lost 10% of your cash. $${s.cash} left.`], 'Press Enter to get back up', PALETTE.healthLow);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** Screen pixels -> world coordinates, for mouse aiming. */
    screenToWorld(sx, sy) {
      const camX = Math.max(VIEW_W / 2, Math.min(WORLD.width - VIEW_W / 2, camera.x));
      const camY = Math.max(VIEW_H / 2, Math.min(WORLD.height - VIEW_H / 2, camera.y));
      return {
        x: (sx * view.dpr - view.x) / view.scale + camX - VIEW_W / 2,
        y: (sy * view.dpr - view.y) / view.scale + camY - VIEW_H / 2,
      };
    },
    snapCamera(x, y) {
      camera.x = x;
      camera.y = y;
    },
  };
}
