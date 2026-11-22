// garage.js — Garage: ganti kendaraan pemain + panel UI garasi.
// Compose dari r10-design-spec.md bagian 11. Deterministik: acak hanya via mulberry32.
import { CONFIG } from "./config.js";

// Daftar kendaraan (spec bagian 11): sedan pink, bike, sport cyan.
export const VEHICLES = [
  { model: "sedan", color: 0xff2e88, label: "SEDAN — Pink Cruiser", topSpeed: 32 },
  { model: "bike", color: 0xffe600, label: "BIKE — Neon Rider", topSpeed: 38 },
  { model: "sport", color: 0x00e5ff, label: "SPORT — Cyan Comet", topSpeed: 46 },
];

function three() {
  return typeof globalThis !== "undefined" ? globalThis.THREE || null : null;
}

export class Garage {
  constructor(game) {
    this.game = game || null;
    this.current = "sedan";
    this.isOpen = false;
    this.panel = null;
    this.vehicles = VEHICLES.map((v) => ({ ...v }));
    this.buildPanel();
  }

  // Bangun panel DOM garasi (lebar 350px, left 24px — spec bagian 4 + 11).
  buildPanel() {
    if (typeof document === "undefined") return;
    let panel = document.getElementById("garage-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "garage-panel";
      document.body.appendChild(panel);
    }
    panel.style.position = "absolute";
    panel.style.left = "24px";
    panel.style.top = "120px";
    panel.style.width = (CONFIG.GARAGE_PANEL_WIDTH || 350) + "px";
    panel.style.display = "none";
    panel.style.background = "rgba(10, 8, 24, 0.88)";
    panel.style.border = "2px solid #ff2e88";
    panel.style.borderRadius = "10px";
    panel.style.padding = "14px";
    panel.style.color = "#ffffff";
    panel.style.fontFamily = "monospace, sans-serif";
    panel.style.zIndex = "20";
    let html = "<h2 style=\"margin:0 0 8px;color:#ff2e88;letter-spacing:2px;\">GARAGE</h2>";
    for (const v of this.vehicles) {
      html += "<div data-model=\"" + v.model + "\" style=\"padding:8px;border:1px solid #333;border-radius:6px;margin-bottom:6px;cursor:pointer;\">"
        + "<b>" + v.label + "</b><br><span style=\"color:#00e5ff;\">Top speed " + v.topSpeed + "</span>"
        + " <button data-pick=\"" + v.model + "\">PILIH</button></div>";
    }
    html += "<p style=\"color:#ffe600;margin:6px 0 0;\">Tekan ENTER untuk keluar garasi.</p>";
    panel.innerHTML = html;
    panel.querySelectorAll("[data-pick]").forEach((btn) => {
      btn.addEventListener("click", () => this.selectVehicle(btn.getAttribute("data-pick")));
    });
    this.panel = panel;
  }

  // Ganti kendaraan pemain. TIDAK rekursif (bug R8: jangan panggil diri sendiri).
  selectVehicle(model) {
    const found = this.vehicles.find((v) => v.model === model);
    if (!found) return this.current;
    this.current = found.model;
    const g = this.game;
    if (g && g.entities) {
      g.entities.playerVehicle = found.model;
    }
    // Perbarui sorotan di panel tanpa memanggil selectVehicle lagi.
    if (this.panel) {
      this.panel.querySelectorAll("[data-model]").forEach((row) => {
        row.style.borderColor = row.getAttribute("data-model") === model ? "#ff2e88" : "#333";
      });
    }
    return this.current;
  }

  listVehicles() {
    return this.vehicles.map((v) => v.model);
  }

  open() {
    this.isOpen = true;
    if (this.panel) this.panel.style.display = "block";
    return true;
  }

  close() {
    this.isOpen = false;
    if (this.panel) this.panel.style.display = "none";
    return true;
  }

  // Model mesh kendaraan aktif (dipakai renderer / shots).
  makeVehicleMesh(model) {
    const THREE = three();
    if (!THREE) return null;
    const v = this.vehicles.find((x) => x.model === model) || this.vehicles[0];
    const group = new THREE.Group();
    if (model === "bike") {
      const frameMat = new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.3, metalness: 0.5 });
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 2.0), frameMat);
      frame.position.y = 0.7;
      group.add(frame);
      const wheelGeo = new THREE.TorusGeometry(0.36, 0.08, 8, 20);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
      for (const wz of [0.85, -0.85]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(0, 0.36, wz);
        group.add(wheel);
      }
      return group;
    }
    const bodyMat = new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.3, metalness: 0.45 });
    const bodyLen = model === "sport" ? 4.6 : 4.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, bodyLen), bodyMat);
    body.position.y = 0.55;
    group.add(body);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x11131c, roughness: 0.15, metalness: 0.6 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, model === "sport" ? 1.6 : 2.0), cabinMat);
    cabin.position.set(0, 1.15, model === "sport" ? -0.3 : -0.2);
    group.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const wheelPos = [
      [-0.85, 0.34, bodyLen / 2 - 0.7],
      [0.85, 0.34, bodyLen / 2 - 0.7],
      [-0.85, 0.34, -bodyLen / 2 + 0.7],
      [0.85, 0.34, -bodyLen / 2 + 0.7],
    ];
    for (const [wx, wy, wz] of wheelPos) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    }
    return group;
  }
}
