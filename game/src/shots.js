// Neon Bay — screenshot scene presets.
// Each scene is a real gameplay state reached through the game's own code
// (applyShot in main.js); this file only names the scenes and their
// camera-friendly starting conditions for the screenshot tool.
(function () {
  'use strict';
  var NB = window.NeonBay;

  NB.Shots = {
    scenes: [
      {
        name: 'start',
        file: '1-start.jpg',
        shot: 'start',
        caption: 'Neon Bay at sunset — driving the Strip, neon radar tracking the run, mission beacon marking the pier pickup.'
      },
      {
        name: 'drive',
        file: '2-drive.jpg',
        shot: 'drive',
        caption: 'Cruising Neon Bay traffic — neon radar, objective banner and named shop signs (Sugar Rush Donuts, Old Arcade) live in the HUD.'
      },
      {
        name: 'chase',
        file: '3-chase.jpg',
        shot: 'chase',
        caption: 'Four-star wanted level — wanted stars lit and flashing, AIR-1 overhead, a roadblock ahead, Bay PD cruisers in a fan.'
      },
      {
        name: 'mission',
        file: '4-mission.jpg',
        shot: 'hero',
        caption: 'Mission 7 hero frame — KINGPIN\'S LAST RUN under five stars: the money truck at the Pier, the beacon over the boat, AIR-1 overhead, a roadblock and Bay PD cruisers closing in, neon radar tracking it all.'
      }
    ]
  };
})();
