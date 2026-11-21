// Neon Bay: Sunset Run — configuration and shared constants.
// All original content: a sun-soaked coastal city of our own invention.
(function () {
  'use strict';
  var NB = (window.NeonBay = window.NeonBay || {});

  NB.Config = {
    title: 'Neon Bay: Sunset Run',
    canvasWidth: 960,
    canvasHeight: 600,
    worldWidth: 3200,
    worldHeight: 2400,
    roadGap: 400,
    roadWidth: 96,
    blockSize: 304,
    // Sunset palette: warm asphalt, coral sky glow, teal water, neon pink signs.
    colors: {
      ground: '#3d2b4f',
      grass: '#4a7c59',
      sand: '#e8c07a',
      water: '#1d6f8e',
      waterDeep: '#14506b',
      road: '#2e2a33',
      roadEdge: '#f7c948',
      lane: '#e8e3d3',
      sidewalk: '#6b6470',
      buildingRoof: '#5b4a6e',
      buildingRoof2: '#7a5a72',
      buildingRoof3: '#46586e',
      neonPink: '#ff2e88',
      neonCyan: '#22d3ee',
      neonOrange: '#ff8c42',
      sun: '#ffb347',
      hudBg: 'rgba(12, 8, 24, 0.72)',
      hudText: '#fff3e0',
      hudAccent: '#ffd166'
    },
    player: {
      walkSpeed: 210,
      runSpeed: 300,
      radius: 13,
      health: 100
    },
    car: {
      accel: 420,
      reverseAccel: 260,
      maxSpeed: 520,
      maxReverse: 180,
      drag: 0.92,
      turnRate: 2.6,
      brake: 700,
      health: 100
    },
    trafficCount: 14,
    pedCount: 26,
    policeMax: 5,
    wantedDecaySeconds: 18,
    missionTimeBonus: 250,
    saveKey: 'neon-bay-sunset-run-save-v1',
    // Round 3: closer camera so the car reads bigger on screen.
    zoom: 1.5,
    garage: { x: 1650, y: 1250, radius: 90 },
    heliWanted: 4,
    roadblockWanted: 3
  };

  // Round 3 loadout. Slot 1 is the trusty pistol (infinite ammo); slots 2
  // and 3 are the new hardware; slot 4 is bare knuckles for close work.
  NB.Weapons = [
    { id: 'pistol', name: 'PISTOL', key: '1', damage: 16, rate: 0.32, speed: 900, spread: 0.03, pellets: 1, ammo: Infinity, maxAmmo: Infinity, color: '#ffd166' },
    { id: 'scattergun', name: 'SCATTERGUN', key: '2', damage: 11, rate: 0.85, speed: 760, spread: 0.20, pellets: 5, ammo: 24, maxAmmo: 24, color: '#ff8c42' },
    { id: 'smg', name: 'SMG', key: '3', damage: 8, rate: 0.09, speed: 980, spread: 0.09, pellets: 1, ammo: 120, maxAmmo: 120, color: '#22d3ee' },
    { id: 'fists', name: 'FISTS', key: '4', damage: 22, rate: 0.45, speed: 0, spread: 0, pellets: 0, ammo: Infinity, maxAmmo: Infinity, color: '#ff6b81' }
  ];

  // Round 3 radio: three synthwave stations, all synthesized live.
  NB.RadioStations = [
    { name: 'NEON 99.1', tag: 'synthwave', root: 110, bpm: 96, wave: 'sawtooth' },
    { name: 'OMBO 98.4', tag: 'midnight drive', root: 98, bpm: 82, wave: 'triangle' },
    { name: 'VICE FM', tag: 'sunset chase', root: 123.47, bpm: 116, wave: 'square' }
  ];

  // Round 3 respect ladder. RP comes from jobs, car theft and takedowns.
  NB.RespectRanks = [
    { name: 'ROOKIE', need: 0 },
    { name: 'HUSTLER', need: 150 },
    { name: 'FIXER', need: 400 },
    { name: 'SHOT CALLER', need: 800 },
    { name: 'KINGPIN', need: 1400 }
  ];

  // Round 3 garage menu at the safehouse (press G nearby).
  NB.GarageUpgrades = [
    { id: 'repair', name: 'REPAIR', desc: 'Full bodywork — car back to 100%', price: 100 },
    { id: 'armor', name: 'ARMOR +50 HP', desc: 'Plated doors, +50 max car health', price: 500 },
    { id: 'engine', name: 'ENGINE +60 TOP SPEED', desc: 'Tuned V8, +60 top speed', price: 800 },
    { id: 'repaint', name: 'REPAINT', desc: 'Fresh sunset paint job', price: 150 }
  ];

  // Round 3 crew: the voices behind the jobs.
  NB.Crew = {
    marco: { name: 'MARCO', role: 'wheelman', color: '#2ed573', initial: 'M', blurb: 'Knows every shortcut in Neon Bay.' },
    mira: { name: 'MIRA', role: 'fixer', color: '#ff2e88', initial: 'R', blurb: 'Runs the jobs, keeps the books.' },
    vega: { name: 'VEGA', role: 'rival racer', color: '#a55eea', initial: 'V', blurb: 'Undefeated on the Strip. Until tonight.' }
  };

  // Mission chain: a small original story about a courier in Neon Bay.
  NB.Missions = [
    {
      id: 'pickup',
      title: 'MISSION 1 — SUNSET PICKUP',
      brief: 'Rico needs the package from the pier. Get to the pink marker — on foot or in a car.',
      target: { x: 2900, y: 200 },
      timeLimit: 150,
      reward: 400,
      wantedOnStart: 0
    },
    {
      id: 'delivery',
      title: 'MISSION 2 — DELIVERY DASH',
      brief: 'Package secured. Deliver it to the Marina Hotel before the timer runs out. Drive fast.',
      target: { x: 500, y: 2100 },
      timeLimit: 75,
      reward: 900,
      wantedOnStart: 1
    },
    {
      id: 'escape',
      title: 'MISSION 3 — HEAT ESCAPE',
      brief: 'The Bay PD is on you! Lose the heat and reach the hideout at the old arcade.',
      target: { x: 1700, y: 1300 },
      timeLimit: 60,
      reward: 1500,
      wantedOnStart: 3
    },
    {
      id: 'grandprix',
      title: 'MISSION 4 — SUNSET GRAND PRIX',
      brief: 'Vega challenged you to a street race at sunset. Beat her through 4 checkpoints — first across the line takes the pot.',
      target: { x: 2600, y: 400 },
      timeLimit: 100,
      reward: 2000,
      wantedOnStart: 1,
      kind: 'race',
      checkpoints: [
        { x: 2600, y: 400 },
        { x: 600, y: 400 },
        { x: 600, y: 2000 },
        { x: 2600, y: 2000 }
      ]
    },
    {
      id: 'heist',
      title: 'MISSION 5 — HARBOR HEIST',
      brief: 'A money truck is parked at the Docks. Grab it, then shake a three-star tail and bring it home.',
      target: { x: 2750, y: 2100 },
      timeLimit: 90,
      reward: 2500,
      wantedOnStart: 3,
      kind: 'heist'
    },
    {
      id: 'cleanhouse',
      title: 'MISSION 6 — CLEAN HOUSE',
      brief: 'Five Coral runners are muscling in on Rico\'s turf. Take all five down and the Strip is ours again.',
      target: { x: 1700, y: 1300 },
      timeLimit: 120,
      reward: 3000,
      wantedOnStart: 2,
      kind: 'takedown',
      killsNeeded: 5
    },
    {
      id: 'kingpin',
      title: 'MISSION 7 — KINGPIN\'S LAST RUN',
      brief: 'The heist cash is in the truck. Haul it across the city to the boat at the Pier under a five-star tail — AIR-1 and roadblocks included. Don\'t stop.',
      target: { x: 2900, y: 200 },
      timeLimit: 120,
      reward: 5000,
      wantedOnStart: 5,
      kind: 'heist'
    }
  ];

  NB.CarPaints = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#eccc68', '#a55eea', '#ff6b81', '#70a1ff'];
  NB.PedShirts = ['#ff6b81', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#c8d64f', '#e17055'];
  NB.StreetNames = [
    'Palm Row', 'Sunset Blvd', 'Coral Ave', 'Neon Strip', 'Marina Way',
    'Flamingo St', 'Bayfront Dr', 'Tropic Ln', 'Vice Mile', 'Dusk Pkwy'
  ];
  NB.Districts = ['Old Arcade', 'Marina', 'Neon Strip', 'The Pier', 'Palm Heights', 'Bayfront'];
})();
