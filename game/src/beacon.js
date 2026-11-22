// NEON BAY: SUNSET RUN — beacon.js
// Pilar cahaya + cincin di target misi (Render.setBeacon).
// game.beacon {x, z, visible}; warna pink (misi) / cyan (hideout);
// opacity ~0.6 supaya terbaca. Posisi diupdate tiap frame dari
// missions.beaconTarget(spawns). Ditulis fresh di sesi terekam ronde 6,
// dari design spec §5.

export class Beacon {
  constructor(render) {
    this.render = render || null;
    this.x = 0;
    this.z = 0;
    this.visible = false;
    this.color = 'pink'; // 'pink' misi biasa, 'cyan' hideout
    this.opacity = 0.6;
  }

  set(x, z, visible, color) {
    this.x = x;
    this.z = z;
    this.visible = !!visible;
    if (color) this.color = color;
    if (this.render && this.render.setBeacon) {
      this.render.setBeacon(x, z, !!visible);
    }
    return this;
  }

  hide() {
    return this.set(this.x, this.z, false);
  }

  // Dipanggil tiap frame oleh main.js.
  update(missions, spawns) {
    if (!missions || !spawns) {
      this.hide();
      return this;
    }
    const target = missions.beaconTarget ? missions.beaconTarget(spawns) : null;
    if (!target) {
      this.hide();
      return this;
    }
    const stage = missions.currentStage ? missions.currentStage() : null;
    const color = stage && stage.target === 'hideout' ? 'cyan' : 'pink';
    return this.set(target.x, target.z, true, color);
  }
}
