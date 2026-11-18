// Solara Bay: all the numbers that tune the game, in one file — the city grid,
// how the player and the cars move, what raises the wanted level, the five story
// jobs, the palette and the story text. The world is a fixed 3200x2400 coastal
// city; the camera just shows a slice of it, so nothing here depends on the
// size of the browser window.
export const STEP = 1 / 60;

export const WORLD = { width: 3200, height: 2400 };

// Avenues run north-south, streets run east-west. ROAD_W is the asphalt width;
// the sidewalks sit just outside it.
export const ROADS_X = [400, 1000, 1600, 2200, 2800];
export const ROADS_Y = [400, 900, 1400, 1900];
export const ROAD_W = 120;
export const BEACH_X = 2920; // sand begins here
export const OCEAN_X = 3040; // water begins here

export const PLAYER = {
  radius: 14,
  walk: 185,
  run: 330,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseMax: 160,
  maxSpeed: 560,
  copMaxSpeed: 620,
  trafficSpeed: 190,
  steer: 2.6,
  grip: 6.5,
};

// How the wanted level behaves: what each crime is worth, and how long the
// player has to stay quiet — and out of sight of the police — before it drops.
export const WANTED = {
  max: 5,
  decayQuietSeconds: 15,
  decayPoliceRange: 520,
  steal: 1,
  hitPed: 1,
  shoot: 1,
  copDown: 2,
};

export const MISSIONS = [
  {
    id: 'hot-wheels',
    name: '1 · Hot Wheels',
    brief: 'Rico needs wheels. Steal any car and bring it to the North Garage.',
    hint: 'Walk up to a parked car and press E. Drive to the gold marker.',
    reward: 500,
    target: { x: 2800, y: 400, label: 'North Garage' },
  },
  {
    id: 'dockside-run',
    name: '2 · Dockside Run',
    brief: 'Three packages are stashed around the city. Collect them, then drop them at the South Docks.',
    hint: 'Drive or walk over each gold package, then reach the docks marker.',
    reward: 800,
    target: { x: 400, y: 1900, label: 'South Docks' },
    packages: [
      { x: 1000, y: 900 },
      { x: 2200, y: 1400 },
      { x: 1600, y: 400 },
    ],
  },
  {
    id: 'heat-check',
    name: '3 · Heat Check',
    brief: 'The crew needs to know you can shake a tail. Get to 2 stars, then lose the cops back to 0.',
    hint: 'Steal a car or punch a cop to raise heat. Then hide until the stars fade.',
    reward: 1000,
    target: { x: 1600, y: 1400, label: 'Lay low anywhere' },
  },
  {
    id: 'cross-town',
    name: '4 · Cross-Town Getaway',
    brief: 'The whole force is on you. Cross the city to the West Gate in 75 seconds — with the law on your tail.',
    hint: 'Floor it. Handbrake (Space) around corners. Do not stop.',
    reward: 1500,
    timeLimit: 75,
    target: { x: 400, y: 400, label: 'West Gate' },
  },
  {
    id: 'marina-heist',
    name: '5 · Marina Heist',
    brief: 'One last job. Grab the loot from the Bay Bank, then reach the boat at the marina — the cops will not let you walk away.',
    hint: 'Grab the gold loot, then drive east to the marina. The boat is waiting.',
    reward: 3000,
    target: { x: 3060, y: 1200, label: 'Marina Boat' },
    loot: { x: 1600, y: 900 },
  },
];

export const PALETTE = {
  backdrop: '#1a120e',
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  sand: '#e8cf96',
  ocean: '#2f7fb8',
  oceanDeep: '#256a9e',
  road: '#3d3a38',
  roadEdge: '#57504a',
  sidewalk: '#b8ab8d',
  lane: '#e8d44d',
  buildingRoof: '#c96f4a',
  text: '#fff6e8',
  muted: '#d8c9a8',
  gold: '#f2c94c',
  panel: 'rgba(24, 16, 12, 0.88)',
  hudBg: 'rgba(24, 16, 12, 0.72)',
  health: '#58d68d',
  healthLow: '#e5534b',
  star: '#f2c94c',
  starEmpty: '#6b5a44',
  cop: '#3b6fd4',
  copLightR: '#ff3b30',
  copLightB: '#3b82ff',
  minimapBg: 'rgba(20, 14, 10, 0.85)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** localStorage key for cash, jobs done, best haul and the mute setting. */
export const SAVE_KEY = 'solara-bay.save.v1';

export const STORY = {
  title: 'SOLARA BAY',
  tagline: 'Sun, salt and stolen cars.',
  blurb: 'Mara Reyes came back to Solara Bay with $40 and a grudge. The Bay Bank took her brother’s garage. Tonight she takes it back — one hot car, one loud job at a time.',
  controls: [
    'WASD / Arrows — walk · Shift — run',
    'E — enter / exit a car (stealing raises heat)',
    'W/S — drive · A/D — steer · Space — handbrake',
    'Mouse aim + Click — shoot · F — punch',
    'M — accept mission · P / Esc — pause · N — mute',
  ],
};
