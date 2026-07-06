
class HomeWizardPowerGraphCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.width = 0;
    this.height = 180;

    this.maxPoints = 90; // ~3 minuten bij 2 sec updates
    this.values = [];

    this.lastUpdate = 0;
    this.needsRedraw = true;

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    
    const card = document.createElement("ha-card");
    card.style.background = "#111";
    card.style.borderRadius = "24px";
    card.style.overflow = "hidden";

    this.canvas.style.width = "100%";
    this.canvas.style.height = this.height + "px";

    card.appendChild(this.canvas);
    this.shadowRoot.appendChild(card);

    this._hass = null;

    this.animate = this.animate.bind(this);
  }

  setConfig(config) {
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;

    const entity = hass.states[this.config.entity];
    if (!entity) return;

    const value = Number(entity.state);

    const now = Date.now();

    // elke 2 seconden nieuwe waarde
    if (now - this.lastUpdate > 200) {
      this.addValue(value);
      this.lastUpdate = now;
    }
  }

  connectedCallback() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.animate();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;

    this.width = this.offsetWidth;
    this.height = 180;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  addValue(val) {
    this.values.push(val);

    if (this.values.length > this.maxPoints) {
      this.values.shift();
    }
    this.needsRedraw = true;
  }

  animate() {

      if (this.needsRedraw) {

          this.draw();

          this.needsRedraw = false;

  }

    requestAnimationFrame(this.animate);

}
interpolate(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: 0.5 * (
      (2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),

    y: 0.5 * (
      (2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    )
  };
}
draw() {
  const ctx = this.ctx;
  const w = this.width;
  const h = this.height;

  // Achtergrond
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

  // Nullijn
  const zeroY = Math.round(h / 2) + 0.5;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(w, zeroY);
  ctx.stroke();

  // Nog geen grafiek als er minder dan 2 punten zijn
  if (this.values.length < 2) return;

  // Schaal berekenen
  const max = Math.max(...this.values, 1);
  const min = Math.min(...this.values, -1);
  const range = Math.max(Math.abs(max), Math.abs(min));

  const step = w / (this.maxPoints - 1);

  // Punten berekenen
const count = this.values.length;

const points = this.values.map((v, i) => ({
  x: w - (count - 1 - i) * step,
  y: zeroY - (v / range) * (h / 2 - 10),
  value: v
}));
  // Grafieklijn
ctx.lineWidth = 2;

for (let i = 1; i < points.length; i++) {

  const p0 = points[i - 1];
  const p1 = points[i];

  const color =
    ((p0.value + p1.value) / 2) >= 0
      ? "#8b5cf6"     // paars
      : "#22c55e";    // groen

  ctx.strokeStyle = color;

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
}

  // Tijdelijke test: teken een wit bolletje op elk meetpunt

  ctx.fillStyle = "#ffffff";

  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

  getCardSize() {
    return 3;
  }
}

customElements.define(
  "homewizard-power-graph",
  HomeWizardPowerGraphCard
);