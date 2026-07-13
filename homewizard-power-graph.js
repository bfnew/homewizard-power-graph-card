
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

sampleSplineSegment(p0, p1, p2, p3, step = 0.02) {

  const points = [];

  for (let t = 0; t <= 1; t += step) {

    const p = this.interpolate(p0, p1, p2, p3, t);

    // Vermogenswaarde op dit punt interpoleren
    const value = p1.value + (p2.value - p1.value) * t;

    points.push({
      x: p.x,
      y: p.y,
      value
    });

  }

  return points;

}

buildRenderSegments(points) {

  const segments = [];

  if (points.length < 2) return segments;

  for (let i = 0; i < points.length - 1; i++) {

    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    segments.push(
      this.sampleSplineSegment(p0, p1, p2, p3)
    );

  }

  return segments;

}

splitSamples(samples) {

  const result = [];

  if (samples.length === 0) return result;

  let current = [samples[0]];
  let currentPositive = samples[0].value >= 0;

  for (let i = 1; i < samples.length; i++) {

    const sample = samples[i];
    const positive = sample.value >= 0;

    if (positive !== currentPositive) {

      result.push({
        positive: currentPositive,
        samples: current
      });

      current = [sample];
      currentPositive = positive;

    } else {

      current.push(sample);

    }

  }

  result.push({
    positive: currentPositive,
    samples: current
  });

  return result;

}

getNiceScale(maxValue) {

  const steps = [
    10,
    20,
    50,
    100,
    200,
    500,
    1000,
    2000,
    5000,
    10000,
    20000
  ];

  const target = Math.abs(maxValue) / 2;

  for (const step of steps) {
    if (target <= step) {
      return step;
    }
  }

  return steps[steps.length - 1];

}

formatPower(value) {

  const negative = value < 0;
  const abs = Math.abs(value);

  let text;

  if (abs >= 1000) {

    const kw = abs / 1000;

    text =
      Number.isInteger(kw)
        ? `${kw} kW`
        : `${kw.toFixed(1)} kW`;

  } else {

    text = `${Math.round(abs)} W`;

  }

  return negative ? `-${text}` : text;

}





findZeroCrossing(p1, p2, zeroY) {

  const dy = p2.y - p1.y;

  if (Math.abs(dy) < 0.0001) return null;

  const t = (zeroY - p1.y) / dy;

  if (t <= 0 || t >= 1) return null;

  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: zeroY,
    t
  };

}



buildSpline(points) {

  const path = new Path2D();

  if (points.length < 2) return path;

  path.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {

    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let t = 0.05; t <= 1; t += 0.02) {

      const p = this.interpolate(p0, p1, p2, p3, t);

      path.lineTo(p.x, p.y);

    }

  }

  return path;

}

drawSmoothLine(points) {

  const ctx = this.ctx;
  const segments = this.buildRenderSegments(points);

  ctx.lineWidth = 2.4;

  for (const samples of segments) {

    const parts = this.splitSamples(samples);

    for (const part of parts) {

      if (part.samples.length < 2) continue;

      const color = part.positive
        ? "#A855F7"
        : "#16A34A";

      ctx.save();

      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;

      ctx.beginPath();
      ctx.moveTo(part.samples[0].x, part.samples[0].y);

      for (let i = 1; i < part.samples.length; i++) {
        ctx.lineTo(part.samples[i].x, part.samples[i].y);
      }

      ctx.stroke();
      ctx.restore();

    }

  }

}

drawFill(points, zeroY) {

  const ctx = this.ctx;

  const segments = this.buildRenderSegments(points);

  for (const samples of segments) {

    if (samples.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(samples[0].x, zeroY);

    for (const p of samples) {
      ctx.lineTo(p.x, p.y);
    }

    ctx.lineTo(samples[samples.length - 1].x, zeroY);
    ctx.closePath();

    ctx.fillStyle =
      samples[0].value >= 0
        ? "rgba(124,58,237,0.30)"
        : "rgba(22,163,74,0.30)";

    ctx.fill();
  }

}




draw() {
  const ctx = this.ctx;
  const w = this.width;
  const h = this.height;
  const topPadding = 35;
  const bottomPadding = 10;
  const graphHeight = h - topPadding - bottomPadding;
  const leftPadding = 150;
  const rightPadding = 10;
  const graphWidth = w - leftPadding - rightPadding;


  // Achtergrond
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);

// Actuele waarde linksboven
const currentValue =
  this.values.length > 0
    ? this.values[this.values.length - 1]
    : 0;

const absValue = Math.abs(currentValue);

const text =
  absValue >= 1000
    ? (currentValue / 1000).toFixed(2) + " kW"
    : Math.round(currentValue) + " W";

  const valueText =
  absValue >= 1000
    ? (currentValue / 1000).toFixed(2)
    : Math.round(currentValue).toString();

const unitText =
  absValue >= 1000
    ? "kW"
    : "W";

ctx.textAlign = "left";
ctx.textBaseline = "top";

ctx.fillStyle =
  currentValue >= 0
    ? "#A855F7"
    : "#16A34A";

// Titel
ctx.font = "12px Arial";
ctx.fillStyle = "#9ca3af";
ctx.fillText("VERMOGEN", 20, 12);



// Groot getal
ctx.font = "bold 34px Arial";
ctx.fillText(valueText, 20, 28);

// Kleine eenheid
ctx.font = "16px Arial";
ctx.fillText(unitText, 22, 66);

// Import / Export indicatoren

const importActive = currentValue >= 0;
const exportActive = currentValue < 0;

// Import bolletje
ctx.beginPath();
ctx.arc(20, 95, 5, 0, Math.PI * 2);
ctx.fillStyle = importActive ? "#A855F7" : "#555555";
ctx.fill();

ctx.font = "14px Arial";
ctx.fillStyle = "#d1d5db";
ctx.fillText("Import", 32, 88);

// Export bolletje
ctx.beginPath();
ctx.arc(20, 118, 5, 0, Math.PI * 2);
ctx.fillStyle = exportActive ? "#16A34A" : "#555555";
ctx.fill();

ctx.fillStyle = "#d1d5db";
ctx.fillText("Export", 32, 111);

  // Nullijn
  const zeroY = Math.round(topPadding + graphHeight / 2) + 0.5;

  // Schaal berekenen
  const max = Math.max(...this.values, 1);
  const min = Math.min(...this.values, -1);
  const range = Math.max(Math.abs(max), Math.abs(min));
  const scaleStep = this.getNiceScale(range);

  // Rasterlijnen
ctx.lineWidth = 1;
ctx.strokeStyle = "#2b2b2b";

const spacing = graphHeight / 4;

for (let i = 1; i <= 2; i++) {

  // boven
  ctx.beginPath();
  ctx.moveTo(leftPadding, zeroY - i * spacing);
  ctx.lineTo(leftPadding + graphWidth, zeroY - i * spacing);
  ctx.stroke();

  // onder
  ctx.beginPath();
  ctx.moveTo(leftPadding, zeroY + i * spacing);
  ctx.lineTo(leftPadding + graphWidth, zeroY + i * spacing);
  ctx.stroke();

}

  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#8a8a8a";

  const labelX = leftPadding - 10;

  ctx.fillText(this.formatPower(scaleStep * 2), labelX, zeroY - spacing * 2);
  ctx.fillText(this.formatPower(scaleStep), labelX, zeroY - spacing);
  ctx.fillText("0", labelX, zeroY);
  ctx.fillText(this.formatPower(-scaleStep), labelX, zeroY + spacing);
  ctx.fillText(this.formatPower(-scaleStep * 2), labelX, zeroY + spacing * 2);


  ctx.strokeStyle = "#606060";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(leftPadding, zeroY);
  ctx.lineTo(leftPadding + graphWidth, zeroY);
  ctx.stroke();

  // Nog geen grafiek als er minder dan 2 punten zijn
  if (this.values.length < 2) return;

 
  
  
  const step = graphWidth / (this.maxPoints - 1);
  
  // Punten berekenen
const count = this.values.length;

const points = this.values.map((v, i) => ({
  x: leftPadding + graphWidth - (count - 1 - i) * step,
  y: zeroY - (v / range) * (graphHeight / 2),
  value: v
}));
  // Grafieklijn

this.drawFill(points, zeroY);

this.drawSmoothLine(points);



}

  getCardSize() {
    return 3;
  }
}

customElements.define(
  "homewizard-power-graph",
  HomeWizardPowerGraphCard
);