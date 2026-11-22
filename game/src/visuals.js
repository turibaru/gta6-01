// visuals.js — Efek partikel & kilat — GTA 6 R7
// Spec §5 + §17.4/§17.7c. muzzle flash, jejak asap/percik tabrakan,
// lampu rem, asap knalpot + partikel api mobil rival yang dihentikan
// (emissive oranye + asap). Pool partikel MAKSIMAL 40 sprite —
// spawn baru saat pool penuh menggantikan partikel tertua.

export const MAX_PARTICLES = 40;

export class Visuals {
  constructor() {
    this.particles = []; // {x,y,z,vx,vy,vz,life,maxLife,color,size,kind}
    this.muzzleFlashes = []; // {x,z,heading,life} — dibaca render.js
    this.brakeLights = false;
  }

  _push(p) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
    return p;
  }

  spawn(p) {
    return this._push({
      x: p.x || 0, y: p.y == null ? 0.5 : p.y, z: p.z || 0,
      vx: p.vx || 0, vy: p.vy || 0, vz: p.vz || 0,
      life: p.life || 0.6, maxLife: p.life || 0.6,
      color: p.color || '#ffffff', size: p.size || 0.5,
      kind: p.kind || 'spark',
    });
  }

  // Kilat moncong senjata di posisi + heading penembak.
  flashMuzzle(x, z, heading = 0) {
    this.muzzleFlashes.push({ x, z, heading, life: 0.08 });
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: x + Math.sin(heading) * 1.2, y: 1.1, z: z + Math.cos(heading) * 1.2,
        vx: (Math.random() - 0.5) * 4, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 4,
        life: 0.12, color: '#ffd166', size: 0.6, kind: 'flash',
      });
    }
    return this.muzzleFlashes[this.muzzleFlashes.length - 1];
  }

  // Percik kuning saat tabrakan (damageCar/damagePlayer).
  sparks(x, z, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      this.spawn({
        x, y: 0.8, z,
        vx: Math.sin(a) * s, vy: 1 + Math.random() * 3, vz: Math.cos(a) * s,
        life: 0.4 + Math.random() * 0.3, color: '#facc15', size: 0.4, kind: 'spark',
      });
    }
    return this;
  }

  // Asap abu-abu (tabrakan / knalpot).
  smoke(x, z, n = 3, color = '#9ca3af') {
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5), y: 0.6, z: z + (Math.random() - 0.5),
        vx: (Math.random() - 0.5) * 0.5, vy: 0.8 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 0.5,
        life: 0.9 + Math.random() * 0.6, color, size: 0.8, kind: 'smoke',
      });
    }
    return this;
  }

  // Asap knalpot saat akselerasi (ringan: 1 sprite per panggilan).
  exhaust(x, z, heading) {
    const bx = x - Math.sin(heading) * 2.2;
    const bz = z - Math.cos(heading) * 2.2;
    return this.spawn({
      x: bx, y: 0.4, z: bz,
      vx: -Math.sin(heading) * 1.5, vy: 0.5, vz: -Math.cos(heading) * 1.5,
      life: 0.7, color: '#6b7280', size: 0.5, kind: 'smoke',
    });
  }

  // Api mobil rival yang dihentikan (misi 9): emissive oranye + asap.
  rivalFire(x, z) {
    for (let i = 0; i < 4; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 1.5, y: 0.8 + Math.random() * 0.6, z: z + (Math.random() - 0.5) * 1.5,
        vx: (Math.random() - 0.5), vy: 1.5 + Math.random(), vz: (Math.random() - 0.5),
        life: 0.5 + Math.random() * 0.4, color: '#fb923c', size: 0.9, kind: 'fire',
      });
    }
    this.spawn({ x, y: 1.6, z, vx: 0, vy: 1.2, vz: 0, life: 1.2, color: '#4b5563', size: 1.1, kind: 'smoke' });
    return this;
  }

  setBrakeLights(on) {
    this.brakeLights = !!on;
    return this.brakeLights;
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= p.kind === 'smoke' ? -0.2 * dt : 4 * dt;
      if (p.y < 0.05) p.y = 0.05;
    }
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      this.muzzleFlashes[i].life -= dt;
      if (this.muzzleFlashes[i].life <= 0) this.muzzleFlashes.splice(i, 1);
    }
    return this.particles;
  }

  clear() {
    this.particles = [];
    this.muzzleFlashes = [];
    return this;
  }
}

export default Visuals;
