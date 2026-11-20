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
        name: 'cover',
        file: '01-cover.jpg',
        shot: 'cover',
        caption: 'Neon Bay at sunset — driving the Strip with the mission marker ahead.'
      },
      {
        name: 'chase',
        file: '02-chase.jpg',
        shot: 'chase',
        caption: 'Three-star wanted level — Bay PD cruisers closing in, minimap and HUD live.'
      },
      {
        name: 'mission',
        file: '03-mission.jpg',
        shot: 'mission',
        caption: 'Mission 1 pickup at the pier — beach, palms and the pink target marker.'
      },
      {
        name: 'drive',
        file: '04-drive.jpg',
        shot: 'drive',
        caption: 'Cruising Neon Bay traffic with pedestrians, neon signs and the HUD.'
      }
    ]
  };
})();
