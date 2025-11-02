const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const powerupEl = document.getElementById("powerup");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resumeBtn = document.getElementById("resume-btn");
const overlay = document.getElementById("overlay");

const GRAVITY = 0.35;
const FLAP = -6.8;
const PLANE_RADIUS = 22;
const BASE_SPEED = 2.4;

const POWER_UP_TYPES = [
  {
    name: "Shield",
    color: "#4cd964",
    duration: 6000,
    apply(game) {
      game.plane.shielded = true;
    },
    update(game, remaining) {
      powerupEl.textContent = `Power-up: Shield (${(remaining / 1000).toFixed(1)}s)`;
    },
    clear(game) {
      game.plane.shielded = false;
    },
  },
  {
    name: "Slow Motion",
    color: "#ffd31a",
    duration: 5000,
    apply(game) {
      game.speedMultiplier = 0.55;
    },
    update(game, remaining) {
      powerupEl.textContent = `Power-up: Slow Motion (${(remaining / 1000).toFixed(1)}s)`;
    },
    clear(game) {
      game.speedMultiplier = 1;
    },
  },
  {
    name: "Score Surge",
    color: "#ff6b81",
    duration: 7000,
    apply(game) {
      game.scoreMultiplier = 2;
    },
    update(game, remaining) {
      powerupEl.textContent = `Power-up: Score x2 (${(remaining / 1000).toFixed(1)}s)`;
    },
    clear(game) {
      game.scoreMultiplier = 1;
    },
  },
];

class Plane {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.rotation = 0;
    this.shielded = false;
    this.trail = [];
  }

  flap() {
    this.vy = FLAP;
  }

  update(delta, gameSpeed) {
    this.vy += GRAVITY * delta * 0.6;
    this.y += this.vy * delta;
    this.rotation = Math.atan2(this.vy, gameSpeed * 16) * 0.8;
    this.trail.push({ x: this.x - 12, y: this.y + Math.sin(performance.now() / 80) * 2 });
    if (this.trail.length > 12) {
      this.trail.shift();
    }
  }

  reset(y) {
    this.y = y;
    this.vy = 0;
    this.rotation = 0;
    this.shielded = false;
    this.trail = [];
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // trail particles
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff33";
    ctx.beginPath();
    for (const particle of this.trail) {
      ctx.moveTo(particle.x - this.x, particle.y - this.y);
      ctx.arc(particle.x - this.x, particle.y - this.y, 4, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    // body
    const grd = ctx.createLinearGradient(-20, -10, 30, 10);
    grd.addColorStop(0, "#1475ff");
    grd.addColorStop(0.5, "#4cb9ff");
    grd.addColorStop(1, "#a0ddff");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, PLANE_RADIUS + 12, PLANE_RADIUS - 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // cockpit
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(12, -6, 10, 0, Math.PI * 2);
    ctx.fill();

    // wing
    ctx.fillStyle = "#0f4275";
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(18, 14);
    ctx.lineTo(-6, 18);
    ctx.closePath();
    ctx.fill();

    // shield overlay
    if (this.shielded) {
      ctx.strokeStyle = "rgba(76, 217, 100, 0.8)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, PLANE_RADIUS + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  getBounds() {
    return {
      x: this.x - PLANE_RADIUS,
      y: this.y - PLANE_RADIUS,
      width: PLANE_RADIUS * 2,
      height: PLANE_RADIUS * 2,
    };
  }
}

class Obstacle {
  constructor(type, x, gapY, speed) {
    this.type = type;
    this.x = x;
    this.gapY = gapY;
    this.width = 80;
    this.gapSize = 160;
    this.passed = false;
    this.speed = speed;
    this.waveOffset = Math.random() * Math.PI * 2;
    this.rotation = Math.random() * Math.PI * 0.25;
  }

  update(delta, speedMultiplier) {
    this.x -= this.speed * speedMultiplier * delta;
    if (this.type === "moving") {
      this.gapY += Math.sin(performance.now() / 600 + this.waveOffset) * 0.8;
    }
    if (this.type === "tilting") {
      this.rotation = Math.sin(performance.now() / 750 + this.waveOffset) * 0.2;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = "#2ecc71";
    const topHeight = this.gapY - this.gapSize / 2;
    const bottomY = this.gapY + this.gapSize / 2;
    const pattern = ctx.createLinearGradient(0, 0, 0, canvas.height);
    pattern.addColorStop(0, "#4cd964");
    pattern.addColorStop(1, "#2ecc71");
    ctx.fillStyle = pattern;

    if (this.type === "tilting") {
      ctx.translate(this.x + this.width / 2, this.gapY);
      ctx.rotate(this.rotation);
      ctx.fillRect(-this.width / 2, -canvas.height, this.width, topHeight);
      ctx.fillRect(-this.width / 2, 0, this.width, canvas.height - bottomY);
    } else {
      ctx.fillRect(this.x, 0, this.width, topHeight);
      ctx.fillRect(this.x, bottomY, this.width, canvas.height - bottomY);
    }

    if (this.type === "laser") {
      ctx.strokeStyle = "rgba(255, 82, 82, 0.9)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(this.x + this.width / 2, 0);
      ctx.lineTo(this.x + this.width / 2, canvas.height);
      ctx.stroke();
    }

    ctx.restore();
  }

  collides(plane) {
    const bounds = plane.getBounds();
    if (this.type === "laser") {
      return bounds.x + bounds.width > this.x + this.width / 2 - 4 && bounds.x < this.x + this.width / 2 + 4;
    }
    const topHeight = this.gapY - this.gapSize / 2;
    const bottomY = this.gapY + this.gapSize / 2;
    if (this.type === "tilting") {
      // approximate bounding boxes
      const rotatedWidth = this.width * Math.abs(Math.cos(this.rotation)) + canvas.height * Math.abs(Math.sin(this.rotation));
      return (
        bounds.x < this.x + rotatedWidth &&
        bounds.x + bounds.width > this.x &&
        (bounds.y < topHeight || bounds.y + bounds.height > bottomY)
      );
    }
    if (bounds.x < this.x + this.width && bounds.x + bounds.width > this.x) {
      if (bounds.y < topHeight || bounds.y + bounds.height > bottomY) {
        return true;
      }
    }
    return false;
  }
}

class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.active = true;
  }

  update(delta, speedMultiplier) {
    this.x -= BASE_SPEED * speedMultiplier * delta * 1.2;
    this.y += Math.sin(performance.now() / 300 + this.x / 50) * 0.4;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.type.color;
    ctx.shadowColor = this.type.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 16px 'Segoe UI'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.type.name[0], 0, 1);
    ctx.restore();
  }

  collides(plane) {
    const dx = plane.x - this.x;
    const dy = plane.y - this.y;
    return Math.sqrt(dx * dx + dy * dy) < this.radius + PLANE_RADIUS - 5;
  }
}

class ParallaxLayer {
  constructor(speed, color, size, offset = 0, amplitude = 0) {
    this.speed = speed;
    this.color = color;
    this.size = size;
    this.offset = offset;
    this.amplitude = amplitude;
    this.items = [];
    this.populate();
  }

  populate() {
    for (let i = 0; i < Math.ceil(canvas.width / this.size) + 2; i++) {
      this.items.push({ x: i * this.size + Math.random() * 60, y: Math.random() * canvas.height * 0.6 });
    }
  }

  update(delta, speedMultiplier) {
    const step = this.speed * speedMultiplier * delta;
    for (const item of this.items) {
      item.x -= step;
      item.y += Math.sin(performance.now() / 1000 + item.x / 80) * this.amplitude;
      if (item.x < -this.size) {
        item.x = canvas.width + this.size;
        item.y = Math.random() * canvas.height * 0.6;
      }
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    for (const item of this.items) {
      ctx.beginPath();
      ctx.ellipse(item.x, item.y + this.offset, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

class Game {
  constructor() {
    this.reset();
    this.bindEvents();
    this.bestScore = Number(localStorage.getItem("advanced-flappy-best") || 0);
    bestScoreEl.textContent = `Best: ${this.bestScore}`;
    this.loop = this.loop.bind(this);
  }

  reset() {
    this.state = "idle";
    this.plane = new Plane(120, canvas.height / 2);
    this.obstacles = [];
    this.powerups = [];
    this.score = 0;
    scoreEl.textContent = `Score: ${this.score}`;
    this.timeSinceLastObstacle = 0;
    this.timeSinceLastPowerUp = 0;
    this.speedMultiplier = 1;
    this.scoreMultiplier = 1;
    this.activePowerUp = null;
    powerupEl.textContent = "Power-up: None";
    this.layers = [
      new ParallaxLayer(0.2, "rgba(255,255,255,0.5)", 60, 80, 0.2),
      new ParallaxLayer(0.5, "rgba(255,255,255,0.7)", 48, 120, 0.3),
      new ParallaxLayer(1.2, "rgba(255,255,255,0.9)", 36, 180, 0.4),
    ];
  }

  bindEvents() {
    const flap = () => {
      if (this.state === "playing") {
        this.plane.flap();
      } else if (this.state === "idle") {
        this.start();
        this.plane.flap();
      } else if (this.state === "gameover") {
        this.start();
      }
    };

    window.addEventListener("keydown", (ev) => {
      if (ev.code === "Space" || ev.code === "ArrowUp") {
        ev.preventDefault();
        flap();
      }
      if (ev.code === "KeyP") {
        ev.preventDefault();
        this.pause();
      }
      if (ev.code === "KeyR") {
        ev.preventDefault();
        this.resume();
      }
    });
    window.addEventListener("pointerdown", flap);

    startBtn.addEventListener("click", () => this.start());
    pauseBtn.addEventListener("click", () => this.pause());
    resumeBtn.addEventListener("click", () => this.resume());
  }

  start() {
    this.reset();
    this.state = "playing";
    this.lastTimestamp = performance.now();
    overlay.classList.add("hidden");
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    resumeBtn.disabled = true;
    requestAnimationFrame(this.loop);
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    overlay.textContent = "Paused";
    overlay.classList.remove("hidden");
    pauseBtn.disabled = true;
    resumeBtn.disabled = false;
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    overlay.classList.add("hidden");
    this.lastTimestamp = performance.now();
    pauseBtn.disabled = false;
    resumeBtn.disabled = true;
    requestAnimationFrame(this.loop);
  }

  gameOver() {
    this.state = "gameover";
    overlay.textContent = `Game Over\nScore: ${this.score}`;
    overlay.classList.remove("hidden");
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem("advanced-flappy-best", this.bestScore);
      bestScoreEl.textContent = `Best: ${this.bestScore}`;
    }
  }

  spawnObstacle() {
    const type = ["static", "moving", "tilting", "laser"][Math.floor(Math.random() * 4)];
    const gapY = canvas.height * 0.3 + Math.random() * canvas.height * 0.4;
    const speed = BASE_SPEED + Math.random() * 1.2;
    this.obstacles.push(new Obstacle(type, canvas.width + 80, gapY, speed));
  }

  spawnPowerUp() {
    const type = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
    this.powerups.push(new PowerUp(type, canvas.width + 40, canvas.height * (0.25 + Math.random() * 0.5)));
  }

  update(delta) {
    if (this.state !== "playing") return;

    for (const layer of this.layers) {
      layer.update(delta, this.speedMultiplier);
    }

    this.plane.update(delta, BASE_SPEED * this.speedMultiplier);

    this.timeSinceLastObstacle += delta * 16;
    if (this.timeSinceLastObstacle > 1600 / this.speedMultiplier) {
      this.spawnObstacle();
      this.timeSinceLastObstacle = 0;
    }

    this.timeSinceLastPowerUp += delta * 16;
    if (this.timeSinceLastPowerUp > 5500) {
      this.spawnPowerUp();
      this.timeSinceLastPowerUp = 0;
    }

    for (const obstacle of this.obstacles) {
      obstacle.update(delta, this.speedMultiplier);
      if (!obstacle.passed && obstacle.x + obstacle.width < this.plane.x) {
        obstacle.passed = true;
        this.score += 1 * this.scoreMultiplier;
        scoreEl.textContent = `Score: ${this.score}`;
      }
    }
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -120);

    for (const powerUp of this.powerups) {
      powerUp.update(delta, this.speedMultiplier);
      if (powerUp.collides(this.plane) && powerUp.active) {
        this.activatePowerUp(powerUp.type);
        powerUp.active = false;
      }
    }
    this.powerups = this.powerups.filter((p) => p.active && p.x > -40);

    if (this.plane.y - PLANE_RADIUS < 0 || this.plane.y + PLANE_RADIUS > canvas.height) {
      if (this.plane.shielded) {
        this.plane.shielded = false;
      } else {
        this.gameOver();
      }
    }

    for (const obstacle of this.obstacles) {
      if (obstacle.collides(this.plane)) {
        if (this.plane.shielded) {
          this.plane.shielded = false;
          obstacle.passed = true;
        } else {
          this.gameOver();
        }
        break;
      }
    }

    if (this.activePowerUp) {
      const remaining = this.activePowerUp.expires - performance.now();
      if (remaining <= 0) {
        this.clearPowerUp();
      } else {
        this.activePowerUp.type.update(this, remaining);
      }
    }
  }

  activatePowerUp(type) {
    if (this.activePowerUp) {
      this.clearPowerUp();
    }
    type.apply(this);
    this.activePowerUp = { type, expires: performance.now() + type.duration };
    powerupEl.textContent = `Power-up: ${type.name}`;
  }

  clearPowerUp() {
    if (!this.activePowerUp) return;
    this.activePowerUp.type.clear(this);
    this.activePowerUp = null;
    powerupEl.textContent = "Power-up: None";
  }

  draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#74c0ff");
    gradient.addColorStop(1, "#d0ebff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.layers.forEach((layer) => layer.draw(ctx));

    // draw ground line
    ctx.fillStyle = "#74c69d";
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    for (const obstacle of this.obstacles) {
      obstacle.draw(ctx);
    }

    for (const powerUp of this.powerups) {
      powerUp.draw(ctx);
    }

    this.plane.draw(ctx);

    // display game state instructions
    if (this.state === "idle") {
      overlay.textContent = "Tap Start or press Space to fly";
      overlay.classList.remove("hidden");
    }
  }

  loop(timestamp) {
    if (this.state !== "playing") return;
    const delta = Math.min(1.6, (timestamp - this.lastTimestamp) / 16.666);
    this.lastTimestamp = timestamp;
    this.update(delta);
    this.draw();
    requestAnimationFrame(this.loop);
  }
}

const game = new Game();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game.pause();
  }
});

game.draw();
