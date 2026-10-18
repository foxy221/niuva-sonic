/**
 * Schlag-Effekte des Vollbild-Visualizers: Schockwellen, Funken, Glut und das
 * gespiegelte Spektrum am unteren Rand. Die Klasse kennt weder DOM noch Audio:
 * `update` bekommt Bänder und Schlagstärken, `draw` zeichnet auf ein 2D-Canvas.
 * So lässt sich das Verhalten (wann es einen Ring gibt, wann Funken verlöschen)
 * ohne Browser prüfen.
 */

export interface FxInput {
  /** Millisekunden seit dem letzten Bild. */
  dt: number;
  /** Geglättete Bänder von tief nach hoch, je 0 bis 1. */
  bands: Float32Array;
  /** Schlagstärke je Bereich, 0 bis 1. */
  kicks: { bass: number; mid: number; high: number };
  /** Gesamtenergie, 0 bis 1. */
  energy: number;
  width: number;
  height: number;
  /** Mittelpunkt und halbe Breite des Covers in Canvas-Pixeln. */
  cover: { x: number; y: number; r: number };
  playing: boolean;
}

interface Ring {
  age: number;
  life: number;
  strength: number;
}

type SparkKind = "burst" | "glitter" | "ember";

interface Spark {
  kind: SparkKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  tone: number;
  sway: number;
}

export const MAX_SPARKS = 280;
const BASS_THRESHOLD = 0.5;
const BASS_COOLDOWN = 240;
const HIGH_THRESHOLD = 0.55;
const HIGH_COOLDOWN = 90;

export class BeatFx {
  rings: Ring[] = [];
  sparks: Spark[] = [];
  private bassCooldown = 0;
  private highCooldown = 0;
  private ember = 0;

  constructor(private random: () => number = Math.random) {}

  private between(min: number, max: number) {
    return min + this.random() * (max - min);
  }

  private add(spark: Spark) {
    this.sparks.push(spark);
    if (this.sparks.length > MAX_SPARKS) this.sparks.splice(0, this.sparks.length - MAX_SPARKS);
  }

  private burst(count: number, strength: number, input: FxInput, unit: number) {
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = ((this.between(0.08, 0.3) + strength * 0.2) * unit) / 1000;
      const edge = input.cover.r * this.between(0.9, 1.1);
      this.add({
        kind: "burst",
        x: input.cover.x + Math.cos(angle) * edge,
        y: input.cover.y + Math.sin(angle) * edge,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: this.between(900, 1800),
        size: this.between(1.2, 3.4),
        tone: Math.floor(this.random() * 4),
        sway: 0,
      });
    }
  }

  private glitter(count: number, input: FxInput) {
    for (let i = 0; i < count; i++) {
      this.add({
        kind: "glitter",
        x: this.random() * input.width,
        y: this.random() * input.height,
        vx: 0,
        vy: 0,
        age: 0,
        life: this.between(250, 520),
        size: this.between(0.9, 2.2),
        tone: 3,
        sway: 0,
      });
    }
  }

  private spawnEmber(input: FxInput, unit: number) {
    this.add({
      kind: "ember",
      x: this.random() * input.width,
      y: input.height + 8,
      vx: 0,
      vy: -(this.between(0.02, 0.06) * unit) / 1000,
      age: 0,
      life: this.between(4000, 8000),
      size: this.between(1, 2.6),
      tone: Math.floor(this.random() * 3),
      sway: this.random() * Math.PI * 2,
    });
  }

  update(input: FxInput) {
    const { dt, kicks, playing } = input;
    const unit = Math.max(input.width, input.height);
    this.bassCooldown -= dt;
    this.highCooldown -= dt;

    if (playing && kicks.bass > BASS_THRESHOLD && this.bassCooldown <= 0) {
      const strength = Math.min(1, kicks.bass);
      this.bassCooldown = BASS_COOLDOWN;
      this.rings.push({ age: 0, life: 1500 + strength * 600, strength });
      this.burst(Math.round(8 + 22 * strength), strength, input, unit);
    }
    if (playing && kicks.high > HIGH_THRESHOLD && this.highCooldown <= 0) {
      this.highCooldown = HIGH_COOLDOWN;
      this.glitter(3 + Math.round(5 * kicks.high), input);
    }

    // Glut steigt immer auf, bei lauter Musik dichter.
    this.ember += dt * (0.004 + (playing ? input.energy : 0) * 0.012);
    while (this.ember >= 1) {
      this.ember -= 1;
      this.spawnEmber(input, unit);
    }

    for (const ring of this.rings) ring.age += dt;
    this.rings = this.rings.filter((ring) => ring.age < ring.life);

    const drag = Math.exp(-dt / 900);
    for (const spark of this.sparks) {
      spark.age += dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      if (spark.kind === "burst") {
        spark.vx *= drag;
        spark.vy *= drag;
      } else if (spark.kind === "ember") {
        spark.x += Math.sin(spark.age / 700 + spark.sway) * 0.03 * dt;
      }
    }
    this.sparks = this.sparks.filter((spark) => spark.age < spark.life);
  }

  /** Spektrum, Schockwellen und Funken. `colors`: Akzent, Violett, Bernstein, Hell. */
  draw(ctx: CanvasRenderingContext2D, input: FxInput, colors: string[], scale: number) {
    const { width: W, height: H, bands } = input;
    const unit = Math.max(W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    this.drawSpectrum(ctx, bands, W, H, colors);

    for (const ring of this.rings) {
      const p = ring.age / ring.life;
      const radius = input.cover.r + (1 - (1 - p) ** 3) * unit * 0.5;
      const fade = (1 - p) ** 1.5;
      ctx.globalAlpha = fade * 0.55 * ring.strength;
      ctx.lineWidth = ((1 - p) * (4 + 14 * ring.strength) + 1) * scale;
      ctx.strokeStyle = colors[0];
      ctx.beginPath();
      ctx.arc(input.cover.x, input.cover.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = fade * 0.32 * ring.strength;
      ctx.lineWidth = Math.max(1, (1 - p) * 6 * scale);
      ctx.strokeStyle = colors[1];
      ctx.beginPath();
      ctx.arc(input.cover.x, input.cover.y, radius * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const spark of this.sparks) {
      const fadeIn = Math.min(1, spark.age / 150);
      const fadeOut = Math.min(1, (spark.life - spark.age) / (spark.life * 0.45));
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut)) * (spark.kind === "ember" ? 0.5 : 0.9);
      ctx.fillStyle = colors[spark.tone % colors.length];
      const r = spark.size * scale;
      ctx.globalAlpha = alpha * 0.2;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** Gespiegelter Berg: Bässe in der Mitte, Höhen an den Rändern. */
  private drawSpectrum(ctx: CanvasRenderingContext2D, bands: Float32Array, W: number, H: number, colors: string[]) {
    const n = bands.length;
    const points = n * 2;
    const maxH = H * 0.32;
    const heightAt = (j: number) => {
      const i = j < n ? n - 1 - j : j - n;
      return Math.min(1, Math.pow(Math.max(0, bands[i]), 1.25) * 1.5) * maxH;
    };
    const x = (j: number) => ((j + 0.5) / points) * W;

    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, colors[2]);
    gradient.addColorStop(0.3, colors[1]);
    gradient.addColorStop(0.5, colors[0]);
    gradient.addColorStop(0.7, colors[1]);
    gradient.addColorStop(1, colors[2]);

    const path = (stretch: number) => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, H - heightAt(0) * stretch);
      for (let j = 0; j < points - 1; j++) {
        const midX = (x(j) + x(j + 1)) / 2;
        const midY = H - ((heightAt(j) + heightAt(j + 1)) / 2) * stretch;
        ctx.quadraticCurveTo(x(j), H - heightAt(j) * stretch, midX, midY);
      }
      ctx.lineTo(W, H - heightAt(points - 1) * stretch);
      ctx.lineTo(W, H);
      ctx.closePath();
    };

    ctx.fillStyle = gradient;
    // Äußere weiche Hülle, darin der satte Körper und oben eine helle Kante.
    ctx.globalAlpha = 0.1;
    path(1.45);
    ctx.fill();
    ctx.globalAlpha = 0.26;
    path(1);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, H - heightAt(0));
    for (let j = 0; j < points - 1; j++) {
      ctx.quadraticCurveTo(x(j), H - heightAt(j), (x(j) + x(j + 1)) / 2, H - (heightAt(j) + heightAt(j + 1)) / 2);
    }
    ctx.lineTo(W, H - heightAt(points - 1));
    ctx.stroke();
  }
}
