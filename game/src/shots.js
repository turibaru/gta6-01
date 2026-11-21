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
        caption: 'Neon Bay at sunset — driving the Strip past DONUT PALACE and TATTOO VICE, the neon radar tracking the pink mission beacon ahead.'
      },
      {
        name: 'drive',
        file: '2-drive.jpg',
        shot: 'drive',
        caption: 'Cruising Neon Bay traffic with the neon radar, the pulsing mission beacon and the objective banner live in the HUD.'
      },
      {
        name: 'chase',
        file: '3-chase.jpg',
        shot: 'chase',
        caption: 'Four-star wanted level — five wanted stars lit under the objective banner, AIR-1 overhead, a roadblock ahead, Bay PD cruisers in a fan.'
      },
      {
        name: 'mission',
        file: '4-mission.jpg',
        shot: 'mission',
        caption: 'Mission 6 shootout — scattergun out, Coral runners closing in, tracers in the air, wanted stars climbing on the neon radar.'
      }
    ]
  };
})();
