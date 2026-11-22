// game/src/garage.js — Garage: ganti kendaraan + panel UI 350px.
// Spec: r10-design-spec.md bagian 11 (Garage).
import { CONFIG } from "./config.js";

const PANEL_WIDTH = (CONFIG && CONFIG.GARAGE_PANEL_WIDTH) || 350;

export class Garage {
  constructor(scene) {
    this.scene = scene || null;
    this.current = "sedan";
    this.isOpen = false;
    this.models = {
      sedan: { id: "sedan", label: "Sedan Pink", color: "#ff4da6" },
      bike: { id: "bike", label: "Bike", color: "#ff7a00" },
      sport: { id: "sport", label: "Sport Cyan", color: "#00e5ff" },
    };
    this.panel = null;
    if (typeof document !== "undefined") this._buildPanel();
  }

  _buildPanel() {
    const panel = document.createElement("div");
    panel.id = "garage-panel";
    panel.style.position = "absolute";
    panel.style.left = "24px";
    panel.style.top = "96px";
    panel.style.width = PANEL_WIDTH + "px";
    panel.style.display = "none";
    panel.style.background = "rgba(10,10,24,0.88)";
    panel.style.border = "2px solid #ff2e88";
    panel.style.color = "#ffffff";
    panel.style.fontFamily = "monospace";
    panel.style.padding = "16px";
    panel.style.zIndex = "20";
    const title = document.createElement("h2");
    title.textContent = "GARAGE";
    title.style.margin = "0 0 12px 0";
    title.style.color = "#ff2e88";
    panel.appendChild(title);
    const list = document.createElement("div");
    const ids = Object.keys(this.models);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const btn = document.createElement("button");
      btn.textContent = this.models[id].label;
      btn.setAttribute("data-model", id);
      btn.style.display = "block";
      btn.style.width = "100%";
      btn.style.margin = "6px 0";
      btn.style.padding = "10px";
      btn.style.background = "#1a1a2e";
      btn.style.color = this.models[id].color;
      btn.style.border = "1px solid " + this.models[id].color;
      btn.style.fontFamily = "monospace";
      btn.style.cursor = "pointer";
      btn.addEventListener("click", () => { this.selectVehicle(id); });
      list.appendChild(btn);
    }
    panel.appendChild(list);
    const hint = document.createElement("div");
    hint.textContent = "Pilih kendaraan, lalu tekan ENTER.";
    hint.style.marginTop = "10px";
    hint.style.color = "#00e5ff";
    panel.appendChild(hint);
    if (document.body) document.body.appendChild(panel);
    this.panel = panel;
  }

  // Ganti kendaraan pemain. TIDAK rekursif (bug R8).
  selectVehicle(model) {
    if (!this.models[model]) return this.current;
    this.current = model;
    if (this.panel) {
      const buttons = this.panel.querySelectorAll("button[data-model]");
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        const mid = b.getAttribute("data-model");
        const selected = mid === model;
        b.style.background = selected ? "#ff2e88" : "#1a1a2e";
        b.style.color = selected ? "#ffffff" : this.models[mid].color;
      }
    }
    return this.current;
  }

  open() {
    this.isOpen = true;
    if (this.panel) this.panel.style.display = "block";
  }

  close() {
    this.isOpen = false;
    if (this.panel) this.panel.style.display = "none";
  }

  listVehicles() {
    return ["sedan", "bike", "sport"];
  }
}
