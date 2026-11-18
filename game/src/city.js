// Solara Bay's city layout: a seeded grid of roads, blocks of procedural
// buildings, palms along the beach and the avenues, and the sand-and-ocean
// edge on the east side. This module is pure data — it draws nothing — so the
// world rules and the renderer both read the same layout from here.
import { BEACH_X, OCEAN_X, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';

const ROOFS = ['#c96f4a', '#b85c5a', '#d9a05b', '#7d8ba0', '#a8674e', '#8fa98f', '#c98a4a', '#6f7f9e'];
const WALLS = ['#e8dcc0', '#dcc7a8', '#cbb59a', '#e0cbb0', '#d5bfa0'];

function buildRoads() {
  const rects = [];
  for (const x of ROADS_X) rects.push({ x: x - ROAD_W / 2, y: 0, w: ROAD_W, h: WORLD.height });
  for (const y of ROADS_Y) rects.push({ x: 0, y: y - ROAD_W / 2, w: WORLD.width, h: ROAD_W });
  return rects;
}

/** True when the point sits on asphalt — a road — rather than a block or the beach. */
export function isRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function createCity(random) {
  const buildings = [];
  const palms = [];
  // Sidewalk margin around each road: nothing may be built inside it.
  const margin = ROAD_W / 2 + 26;

  // One or more buildings per block cell between neighbouring roads, jittered.
  for (let ix = 0; ix < ROADS_X.length; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length; iy += 1) {
      const x0 = ix === 0 ? 40 : ROADS_X[ix - 1] + margin;
      const x1 = ROADS_X[ix] - margin;
      const y0 = iy === 0 ? 40 : ROADS_Y[iy - 1] + margin;
      const y1 = ROADS_Y[iy] - margin;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cols = x1 - x0 > 260 ? 2 : 1;
      const rows = y1 - y0 > 260 ? 2 : 1;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const bx = x0 + ((x1 - x0) / cols) * cx + 8 + random() * 10;
          const by = y0 + ((y1 - y0) / rows) * cy + 8 + random() * 10;
          const bw = (x1 - x0) / cols - 24 - random() * 14;
          const bh = (y1 - y0) / rows - 24 - random() * 14;
          if (bw < 50 || bh < 50 || bx + bw > BEACH_X - 30) continue;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            height: 14 + random() * 46,
            roof: ROOFS[(random() * ROOFS.length) | 0],
            wall: WALLS[(random() * WALLS.length) | 0],
            windows: 3 + ((random() * 4) | 0),
          });
        }
      }
    }
  }

  // Palms: a ragged line down the beach, plus a few on the wide avenue corners.
  for (let y = 120; y < WORLD.height - 80; y += 90 + random() * 70) {
    palms.push({ x: BEACH_X - 30 - random() * 40, y, lean: random() * 0.6 - 0.3 });
  }
  for (const rx of ROADS_X) {
    for (let n = 0; n < 3; n += 1) {
      palms.push({ x: rx + ROAD_W / 2 + 14, y: 200 + random() * (WORLD.height - 400), lean: random() * 0.6 - 0.3 });
    }
  }

  const roads = buildRoads();

  /** The building a circle (x, y, r) overlaps, or null when it overlaps none. */
  function buildingHit(x, y, r) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }

  /** Push a circle out of buildings and the world edge; true when it moved. */
  function resolveCircle(p, r) {
    let pushed = false;
    const b = buildingHit(p.x, p.y, r);
    if (b) {
      // Shove it out through the closest face of the building.
      const fromLeft = p.x + r - b.x;
      const fromRight = b.x + b.w + r - p.x;
      const fromTop = p.y + r - b.y;
      const fromBottom = b.y + b.h + r - p.y;
      const m = Math.min(fromLeft, fromRight, fromTop, fromBottom);
      if (m === fromLeft) p.x = b.x - r;
      else if (m === fromRight) p.x = b.x + b.w + r;
      else if (m === fromTop) p.y = b.y - r;
      else p.y = b.y + b.h + r;
      pushed = true;
    }
    if (p.x < r + 8) { p.x = r + 8; pushed = true; }
    if (p.x > WORLD.width - r - 8) { p.x = WORLD.width - r - 8; pushed = true; }
    if (p.y < r + 8) { p.y = r + 8; pushed = true; }
    if (p.y > WORLD.height - r - 8) { p.y = WORLD.height - r - 8; pushed = true; }
    return pushed;
  }

  /** A random point on a road — where traffic and pedestrians start. */
  function randomRoadPoint() {
    if (random() < 0.5) {
      const rx = ROADS_X[(random() * ROADS_X.length) | 0];
      return { x: rx + (random() - 0.5) * (ROAD_W - 40), y: 80 + random() * (WORLD.height - 160) };
    }
    const ry = ROADS_Y[(random() * ROADS_Y.length) | 0];
    return { x: 80 + random() * (WORLD.width - 160), y: ry + (random() - 0.5) * (ROAD_W - 40) };
  }

  /** A random point on a sidewalk strip beside a road — pedestrian turf. */
  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    const onAvenue = ROADS_X.some((rx) => Math.abs(p.x - rx) < ROAD_W / 2);
    if (onAvenue) p.x += (p.x % 2 > 1 ? 1 : -1) * (ROAD_W / 2 + 8);
    else p.y += (p.y % 2 > 1 ? 1 : -1) * (ROAD_W / 2 + 8);
    return p;
  }

  return { buildings, palms, roads, buildingHit, resolveCircle, randomRoadPoint, randomSidewalkPoint };
}

export { BEACH_X, OCEAN_X };
