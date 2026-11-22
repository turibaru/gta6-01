import { CONFIG } from './config.js';

// Garage — garasi pemain: ganti kendaraan, panel UI 350px di kiri (left 24px).
// selectVehicle TIDAK boleh memanggil dirinya sendiri (bug rekursi R8).
const GARAGE_PANEL_WIDTH = (CONFIG && typeof CONFIG.GARAGE_PANEL_WIDTH === 'number')
  ? CONFIG.GARAGE_PANEL_WIDTH : 350;
const MODELS = {
  sedan: { name: 'sedan', label: 'Sedan Pink', color: 0xff2e88, topSpeed: 12 },
  bike: { name: 'bike', label: 'Bike', color: 0x00e5ff, topSpeed: 16 },
  sport: { name: 'sport', label: 'Sport Cyan', color: 0x00e5ff, topSpeed: 20 },
};

export class Garage {
  constructor(scene) {
    this.scene = scene || null;
    this.current = 'sedan';
    this.isOpen = false;
    this.panel = null;
    if (typeof document !== 'undefined') {
      this.panel = document.getElementById('garage-panel');
      if (!this.panel) this.panel = this.buildPanel();
    }
  }

  buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'garage-panel';
    panel.style.position = 'absolute';
    panel.style.left = '24px';
    panel.style.top = '120px';
    panel.style.width = GARAGE_PANEL_WIDTH + 'px';
    panel.style.display = 'none';
    panel.style.background = 'rgba(10, 10, 26, 0.88)';
    panel.style.border = '2px solid #ff2e88';
    panel.style.color = '#fff';
    panel.style.fontFamily = 'monospace';
    panel.style.padding = '12px';
    panel.style.zIndex = '20';
    const title = document.createElement('div');
    title.textContent = 'GARAGE';
    title.style.fontSize = '22px';
    title.style.fontWeight = 'bold';
    title.style.color = '#ff2e88';
    panel.appendChild(title);
    for (const model of this.listVehicles()) {
      const row = document.createElement('div');
      row.style.marginTop = '8px';
      const label = document.createElement('span');
      label.textContent = MODELS[model].label;
      const btn = document.createElement('button');
      btn.textContent = 'PILIH';
      btn.style.marginLeft = '12px';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => { this.selectVehicle(model); this.refreshPanel(); });
      row.appendChild(label);
      row.appendChild(btn);
      panel.appendChild(row);
    }
    document.body.appendChild(panel);
    return panel;
  }

  refreshPanel() {
    if (!this.panel) return;
    const rows = this.panel.querySelectorAll('div');
    void rows;
  }

  listVehicles() {
    return ['sedan', 'bike', 'sport'];
  }

  modelInfo(model) {
    return MODELS[model] || MODELS.sedan;
  }

  selectVehicle(model) {
    if (!MODELS[model]) return this.current;
    this.current = model;
    this.refreshPanel();
    return this.current;
  }

  open() {
    this.isOpen = true;
    if (this.panel) this.panel.style.display = 'block';
    return this.isOpen;
  }

  close() {
    this.isOpen = false;
    if (this.panel) this.panel.style.display = 'none';
    return this.isOpen;
  }
}
