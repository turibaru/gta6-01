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
    saveKey: 'neon-bay-sunset-run-save-v1'
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
