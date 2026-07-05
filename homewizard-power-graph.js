class HomeWizardPowerGraphCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.width = 0;
    this.height = 180;

    this.maxPoints = 90; // ~3 minuten bij 2 sec updates
    this.values = [];

    this.lastUpdate = 0;

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
  }

  animate() {
    this.draw();
    requestAnimationFrame(this.animate);
  }

draw() {
  const ctx = this.ctx;
  const w = this.width;
  const h = this.height;

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

  const zeroY = h / 2;

  // nullijn
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(w, zeroY);
  ctx.stroke();

  if (this.values.length < 2) return;

  const max = Math.max(...this.values, 1);
  const min = Math.min(...this.values, -1);
  const range = Math.max(Math.abs(max), Math.abs(min));

  const step = w / (this.maxPoints - 1);

  const points = this.values.map((v, i) => ({
    x: i * step,
    y: zeroY - (v / range) * (h / 2 - 10),
    v
  }));

  // =========================
  // FILL (BELANGRIJK: per segment)
  // =========================
  for (let i = 1; i < points.length; i++) {

    const p0 = points[i - 1];
    const p1 = points[i];

    const mid = (p0.v + p1.v) / 2;

    ctx.fillStyle = mid >= 0
      ? "rgba(168,85,247,0.25)"
      : "rgba(34,197,94,0.25)";

    ctx.beginPath();
    ctx.moveTo(p0.x, zeroY);
    ctx.lineTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p1.x, zeroY);
    ctx.closePath();
    ctx.fill();
  }

  // =========================
  // LINE (smooth Bézier)
  // =========================

  const linePath = new Path2D();
  linePath.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const cx = (p0.x + p1.x) / 2;

    linePath.bezierCurveTo(cx, p0.y, cx, p1.y, p1.x, p1.y);
  }

  // glow
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(168,85,247,0.35)";
  ctx.strokeStyle = "rgba(168,85,247,0.9)";
  ctx.lineWidth = 2.2;
  ctx.stroke(linePath);
  ctx.restore();

  // main line
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.2;
  ctx.stroke(linePath);
}

  getCardSize() {
    return 3;
  }
}

customElements.define(
  "homewizard-power-graph",
  HomeWizardPowerGraphCard
);