(function () {
  "use strict";

  // ============================================================
  // Math Utilities
  // ============================================================
  var PI_2 = Math.PI * 2;
  var PI_HALF = Math.PI * 0.5;

  function pointDist(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pointAngle(x1, y1, x2, y2) {
    return PI_HALF + Math.atan2(y2 - y1, x2 - x1);
  }

  function random(min, max) { return Math.random() * (max - min) + min; }

  // ============================================================
  // Ticker (rAF-based frame scheduler)
  // ============================================================
  var tickerListeners = [];
  var tickerStarted = false;
  var tickerLastTs = 0;

  function tickerAddListener(cb) {
    tickerListeners.push(cb);
    if (!tickerStarted) {
      tickerStarted = true;
      requestAnimationFrame(tickerFrame);
    }
  }

  function tickerRemoveAll() {
    tickerListeners = [];
    tickerStarted = false;
  }

  function tickerFrame(ts) {
    if (!tickerStarted) return;
    var dt = Math.min(ts - tickerLastTs, 68);
    tickerLastTs = ts;
    var lag = dt / 16.6667;
    for (var i = 0; i < tickerListeners.length; i++) {
      tickerListeners[i](dt, lag);
    }
    requestAnimationFrame(tickerFrame);
  }

  // ============================================================
  // Stage (canvas wrapper)
  // ============================================================
  function Stage(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.touchAction = "none";
    this.width = 0;
    this.height = 0;
    this._listeners = {};
  }

  Stage.prototype.resize = function (w, h) {
    this.width = w;
    this.height = h;
    var nw = w * this.dpr;
    var nh = h * this.dpr;
    this.canvas.width = nw;
    this.canvas.height = nh;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
  };

  Stage.prototype.addEventListener = function (ev, handler) {
    if (ev === "ticker") { tickerAddListener(handler); return; }
    if (!this._listeners[ev]) this._listeners[ev] = [];
    this._listeners[ev].push(handler);
  };

  Stage.prototype.dispatchEvent = function (ev, val) {
    var list = this._listeners[ev];
    if (list) {
      for (var i = 0; i < list.length; i++) list[i](val);
    }
  };

  // ============================================================
  // Colors
  // ============================================================
  var COLORS = {
    Red: "#ff0043", Green: "#14fc56", Blue: "#1e7fff",
    Purple: "#e60aff", Gold: "#ffbf36", White: "#ffffff",
  };
  var COLOR_NAMES = Object.keys(COLORS);
  var COLOR_CODES = COLOR_NAMES.map(function (k) { return COLORS[k]; });
  var INVISIBLE = "_INVISIBLE_";
  var COLOR_CODES_W_INVIS = COLOR_CODES.concat([INVISIBLE]);

  function randomColorSimple() {
    return COLOR_CODES[(Math.random() * COLOR_CODES.length) | 0];
  }

  var lastColor;

  function randomColor(opts) {
    opts = opts || {};
    var c = randomColorSimple();
    if (opts.limitWhite && c === COLORS.White && Math.random() < 0.6) c = randomColorSimple();
    if (opts.notSame) while (c === lastColor) c = randomColorSimple();
    if (opts.notColor) while (c === opts.notColor) c = randomColorSimple();
    lastColor = c;
    return c;
  }

  function whiteOrGold() { return Math.random() < 0.5 ? COLORS.Gold : COLORS.White; }

  function makePistilColor(sc) {
    return sc === COLORS.White || sc === COLORS.Gold
      ? randomColor({ notColor: sc })
      : whiteOrGold();
  }

  // ============================================================
  // Object pools
  // ============================================================
  function createParticleCollection() {
    var c = {};
    for (var ci = 0; ci < COLOR_CODES_W_INVIS.length; ci++) {
      c[COLOR_CODES_W_INVIS[ci]] = [];
    }
    return c;
  }

  // BurstFlash
  var burstFlashPool = [];
  var burstFlashActive = [];

  function BurstFlash_add(x, y, radius) {
    var inst = burstFlashPool.pop() || {};
    inst.x = x; inst.y = y; inst.radius = radius;
    burstFlashActive.push(inst);
  }

  function BurstFlash_clear() {
    while (burstFlashActive.length) {
      burstFlashPool.push(burstFlashActive.pop());
    }
  }

  // Star
  var starPool = [];
  var starActive = createParticleCollection();
  var starDrawWidth = 3;
  var starAirDrag = 0.98;
  var starAirDragHeavy = 0.992;
  var starCurrentFrame = 0;

  function starAdd(x, y, color, angle, speed, life, offX, offY) {
    var inst = starPool.pop() || {};
    inst.visible = true;
    inst.heavy = false;
    inst.x = x; inst.y = y;
    inst.prevX = x; inst.prevY = y;
    inst.color = color;
    inst.speedX = Math.sin(angle) * speed + (offX || 0);
    inst.speedY = Math.cos(angle) * speed + (offY || 0);
    inst.life = life;
    inst.fullLife = life;
    inst.spinAngle = Math.random() * PI_2;
    inst.spinSpeed = 0.8;
    inst.spinRadius = 0;
    inst.sparkFreq = 0;
    inst.sparkSpeed = 1;
    inst.sparkTimer = 0;
    inst.sparkColor = color;
    inst.sparkLife = 750;
    inst.sparkLifeVariation = 0.25;
    inst.strobe = false;
    inst.updateFrame = 0;
    inst.onDeath = null;
    inst.secondColor = null;
    inst.transitionTime = 0;
    inst.colorChanged = false;
    starActive[color].push(inst);
    return inst;
  }

  function starReturn(inst) {
    if (inst.onDeath) inst.onDeath(inst);
    inst.onDeath = null;
    inst.secondColor = null;
    inst.transitionTime = 0;
    inst.colorChanged = false;
    starPool.push(inst);
  }

  function starClearAll() {
    for (var ci = 0; ci < COLOR_CODES_W_INVIS.length; ci++) {
      var clr = COLOR_CODES_W_INVIS[ci];
      var arr = starActive[clr];
      for (var si = 0; si < arr.length; si++) starPool.push(arr[si]);
      starActive[clr] = [];
    }
  }

  // Spark
  var sparkPool = [];
  var sparkActive = createParticleCollection();
  var sparkDrawWidth = 1;
  var sparkAirDrag = 0.92;

  function sparkAdd(x, y, color, angle, speed, life) {
    var inst = sparkPool.pop() || {};
    inst.x = x; inst.y = y;
    inst.prevX = x; inst.prevY = y;
    inst.color = color;
    inst.speedX = Math.sin(angle) * speed;
    inst.speedY = Math.cos(angle) * speed;
    inst.life = life;
    inst.fullLife = life;
    sparkActive[color].push(inst);
    return inst;
  }

  function sparkClearAll() {
    for (var ci = 0; ci < COLOR_CODES_W_INVIS.length; ci++) {
      var clr = COLOR_CODES_W_INVIS[ci];
      var arr = sparkActive[clr];
      for (var si = 0; si < arr.length; si++) sparkPool.push(arr[si]);
      sparkActive[clr] = [];
    }
  }

  // ============================================================
  // Sound Manager (Web Audio)
  // ============================================================
  var audioCtx = null;
  var soundsEnabled = true;

  // Preloaded sound buffers (same approach as hh.js)
  var soundBuffers = {};

  function ensureAudioCtx() {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  var soundBaseURL = "/audio/fireworks/";
  var soundConfig = {
    lift:  { volume: 1, rateMin: 0.85, rateMax: 0.95, files: ["lift1.mp3","lift2.mp3","lift3.mp3"] },
    burst: { volume: 1, rateMin: 0.8,  rateMax: 0.9,  files: ["burst1.mp3","burst2.mp3"] },
    burstSmall: { volume: 0.25, rateMin: 0.8, rateMax: 1, files: ["burst-sm-1.mp3","burst-sm-2.mp3"] },
    crackle: { volume: 0.2, rateMin: 1, rateMax: 1, files: ["crackle1.mp3"] },
    crackleSmall: { volume: 0.3, rateMin: 1, rateMax: 1, files: ["crackle-sm-1.mp3"] }
  };

  function preloadSounds() {
    if (!audioCtx) return;
    Object.keys(soundConfig).forEach(function(type) {
      var cfg = soundConfig[type];
      cfg.files.forEach(function(file) {
        var url = soundBaseURL + file;
        fetch(url)
          .then(function(r) { if (!r.ok) throw Error("fetch fail"); return r.arrayBuffer(); })
          .then(function(buf) { return new Promise(function(res) { audioCtx.decodeAudioData(buf, res); }); })
          .then(function(decoded) {
            if (!soundBuffers[type]) soundBuffers[type] = [];
            soundBuffers[type].push(decoded);
          })
          .catch(function() {});
      });
    });
  }

  function playSound(type, scale) {
    if (!soundsEnabled || !audioCtx) return;
    try {
      ensureAudioCtx();
      var buffers = soundBuffers[type];
      if (!buffers || buffers.length === 0) return;
      var cfg = soundConfig[type];
      var vol = cfg.volume * (scale || 1);
      var buf = buffers[(Math.random() * buffers.length) | 0];
      var rate = cfg.rateMin + Math.random() * (cfg.rateMax - cfg.rateMin);
      var source = audioCtx.createBufferSource();
      var gain = audioCtx.createGain();
      source.buffer = buf;
      source.playbackRate.value = rate * (2 - (scale || 1));
      gain.gain.value = vol;
      source.connect(gain);
      gain.connect(audioCtx.destination);
      source.start(0);
    } catch (e) {}
  }

  // ============================================================
  // Shell Types
  // ============================================================
  function crysanthemumShell(size) {
    size = size || 1;
    var glitter = Math.random() < 0.25;
    var singleColor = Math.random() < 0.72;
    var color = singleColor
      ? randomColor({ limitWhite: true })
      : [randomColor(), randomColor({ notSame: true })];
    var pistil = singleColor && Math.random() < 0.42;
    var pistilColor = pistil && makePistilColor(color);
    var secondColor =
      singleColor && (Math.random() < 0.2 || color === COLORS.White)
        ? pistilColor || randomColor({ notColor: color, limitWhite: true })
        : null;
    var streamers = !pistil && color !== COLORS.White && Math.random() < 0.42;
    return {
      shellSize: size,
      spreadSize: 300 + size * 100,
      starLife: 900 + size * 200,
      starDensity: glitter ? 1.1 : 1.25,
      color: color,
      secondColor: secondColor,
      glitter: glitter ? "light" : "",
      glitterColor: whiteOrGold(),
      pistil: pistil,
      pistilColor: pistilColor,
      streamers: streamers,
    };
  }

  function ghostShell(size) {
    var s = crysanthemumShell(size);
    s.starLife *= 1.5;
    var ghostColor = randomColor({ notColor: COLORS.White });
    s.streamers = true;
    s.color = INVISIBLE;
    s.secondColor = ghostColor;
    s.glitter = "";
    return s;
  }

  function strobeShell(size) {
    size = size || 1;
    var color = randomColor({ limitWhite: true });
    return {
      shellSize: size,
      spreadSize: 280 + size * 92,
      starLife: 1100 + size * 200,
      starLifeVariation: 0.4,
      starDensity: 1.1,
      color: color,
      glitter: "light",
      glitterColor: COLORS.White,
      strobe: true,
      strobeColor: Math.random() < 0.5 ? COLORS.White : null,
      pistil: Math.random() < 0.5,
      pistilColor: makePistilColor(color),
    };
  }

  function palmShell(size) {
    size = size || 1;
    var color = randomColor();
    var thick = Math.random() < 0.5;
    return {
      shellSize: size,
      color: color,
      spreadSize: 250 + size * 75,
      starDensity: thick ? 0.15 : 0.4,
      starLife: 1800 + size * 200,
      glitter: thick ? "thick" : "heavy",
    };
  }

  function ringShell(size) {
    size = size || 1;
    var color = randomColor();
    var pistil = Math.random() < 0.75;
    return {
      shellSize: size,
      ring: true,
      color: color,
      spreadSize: 300 + size * 100,
      starLife: 900 + size * 200,
      starCount: 2.2 * PI_2 * (size + 1),
      pistil: pistil,
      pistilColor: makePistilColor(color),
      glitter: !pistil ? "light" : "",
      glitterColor: color === COLORS.Gold ? COLORS.Gold : COLORS.White,
      streamers: Math.random() < 0.3,
    };
  }

  function crossetteShell(size) {
    size = size || 1;
    var color = randomColor({ limitWhite: true });
    return {
      shellSize: size,
      spreadSize: 300 + size * 100,
      starLife: 750 + size * 160,
      starLifeVariation: 0.4,
      starDensity: 0.85,
      color: color,
      crossette: true,
      pistil: Math.random() < 0.5,
      pistilColor: makePistilColor(color),
    };
  }

  function floralShell(size) {
    size = size || 1;
    return {
      shellSize: size,
      spreadSize: 300 + size * 120,
      starDensity: 0.12,
      starLife: 500 + size * 50,
      starLifeVariation: 0.5,
      color:
        Math.random() < 0.65
          ? "random"
          : Math.random() < 0.15
            ? randomColor()
            : [randomColor(), randomColor({ notSame: true })],
      floral: true,
    };
  }

  function fallingLeavesShell(size) {
    size = size || 1;
    return {
      shellSize: size,
      color: INVISIBLE,
      spreadSize: 300 + size * 120,
      starDensity: 0.12,
      starLife: 500 + size * 50,
      starLifeVariation: 0.5,
      glitter: "medium",
      glitterColor: COLORS.Gold,
      fallingLeaves: true,
    };
  }

  function willowShell(size) {
    size = size || 1;
    return {
      shellSize: size,
      spreadSize: 300 + size * 100,
      starDensity: 0.6,
      starLife: 3000 + size * 300,
      glitter: "willow",
      glitterColor: COLORS.Gold,
      color: INVISIBLE,
    };
  }

  function crackleShell(size) {
    size = size || 1;
    var color = Math.random() < 0.75 ? COLORS.Gold : randomColor();
    return {
      shellSize: size,
      spreadSize: 380 + size * 75,
      starDensity: 1,
      starLife: 600 + size * 100,
      starLifeVariation: 0.32,
      glitter: "light",
      glitterColor: COLORS.Gold,
      color: color,
      crackle: true,
      pistil: Math.random() < 0.65,
      pistilColor: makePistilColor(color),
    };
  }

  function horsetailShell(size) {
    size = size || 1;
    var color = randomColor();
    return {
      shellSize: size,
      horsetail: true,
      color: color,
      spreadSize: 250 + size * 38,
      starDensity: 0.9,
      starLife: 2500 + size * 300,
      glitter: "medium",
      glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
      strobe: color === COLORS.White,
    };
  }

  var shellTypes = {
    Random: null,
    Crackle: crackleShell,
    Crossette: crossetteShell,
    Crysanthemum: crysanthemumShell,
    "Falling Leaves": fallingLeavesShell,
    Floral: floralShell,
    Ghost: ghostShell,
    "Horse Tail": horsetailShell,
    Palm: palmShell,
    Ring: ringShell,
    Strobe: strobeShell,
    Willow: willowShell,
  };
  var shellNames = [];
  for (var sk in shellTypes) {
    if (sk !== "Random") shellNames.push(sk);
  }

  function randomShellName() {
    return Math.random() < 0.5
      ? "Crysanthemum"
      : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
  }

  function randomShellType() {
    return shellTypes[randomShellName()];
  }

  // ============================================================
  // Shell Class
  // ============================================================
  var currentShellType = "Random";
  var currentShellSize = 4;

  function Shell(options) {
    for (var k in options) this[k] = options[k];
    this.starLifeVariation = options.starLifeVariation || 0.125;
    this.color = options.color || randomColor();
    this.glitterColor = options.glitterColor || this.color;
    if (!this.starCount) {
      var density = options.starDensity || 1;
      var scaled = this.spreadSize / 54;
      this.starCount = Math.max(6, scaled * scaled * density);
    }
  }

  Shell.prototype.launch = function (posX, posY) {
    var w = stageWidth, h = stageHeight;
    var pad = 60;
    var launchX = posX * (w - pad * 2) + pad;
    var launchY = h;
    var burstY = posY * (h - 100);
    var dist = launchY - burstY;
    var vel = Math.pow(dist * 0.04, 0.64);
    var color =
      typeof this.color === "string" && this.color !== "random"
        ? this.color
        : COLORS.White;
    var comet = starAdd(
      launchX,
      launchY,
      color,
      Math.PI,
      vel * (this.horsetail ? 1.2 : 1),
      vel * (this.horsetail ? 100 : 400)
    );
    comet.heavy = true;
    comet.spinRadius = random(0.32, 0.85);
    comet.sparkFreq = 8;
    comet.sparkLife = 320;
    comet.sparkLifeVariation = 3;
    if (this.glitter === "willow" || this.fallingLeaves) {
      comet.sparkFreq = 20;
      comet.sparkSpeed = 0.5;
      comet.sparkLife = 500;
    }
    if (this.color === INVISIBLE) comet.sparkColor = COLORS.Gold;
    if (Math.random() > 0.4 && !this.horsetail) {
      comet.secondColor = INVISIBLE;
      comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500;
    }
    var self = this;
    comet.onDeath = function () { self.burst(comet.x, comet.y); };
    playSound("lift");
  };

  Shell.prototype.burst = function (x, y) {
    var speed = this.spreadSize / 96;
    var sparkFreq, sparkSpeed, sparkLife, sparkLifeVar = 0.25;
    var color, onDeath;
    var playedDeath = false;

    if (this.crossette) {
      onDeath = function (star) {
        if (!playedDeath) { playSound("crackleSmall"); playedDeath = true; }
        crossetteEffect(star);
      };
    }
    if (this.crackle) {
      onDeath = function (star) {
        if (!playedDeath) { playSound("crackle"); playedDeath = true; }
        crackleEffect(star);
      };
    }
    if (this.floral) onDeath = floralEffect;
    if (this.fallingLeaves) onDeath = fallingLeavesEffect;

    if (this.glitter === "light") {
      sparkFreq = 400; sparkSpeed = 0.3; sparkLife = 300; sparkLifeVar = 2;
    } else if (this.glitter === "medium") {
      sparkFreq = 200; sparkSpeed = 0.44; sparkLife = 700; sparkLifeVar = 2;
    } else if (this.glitter === "heavy") {
      sparkFreq = 80; sparkSpeed = 0.8; sparkLife = 1400; sparkLifeVar = 2;
    } else if (this.glitter === "thick") {
      sparkFreq = 16; sparkSpeed = 1.5; sparkLife = 1400; sparkLifeVar = 3;
    } else if (this.glitter === "streamer") {
      sparkFreq = 32; sparkSpeed = 1.05; sparkLife = 620; sparkLifeVar = 2;
    } else if (this.glitter === "willow") {
      sparkFreq = 120; sparkSpeed = 0.34; sparkLife = 1400; sparkLifeVar = 3.8;
    }

    var self = this;

    function makeStar(angle, speedMult) {
      var s = starAdd(
        x, y,
        color || randomColor(),
        angle,
        speedMult * speed,
        self.starLife + Math.random() * self.starLife * self.starLifeVariation
      );
      if (self.secondColor) {
        s.transitionTime = self.starLife * (Math.random() * 0.05 + 0.32);
        s.secondColor = self.secondColor;
      }
      if (self.strobe) {
        s.transitionTime = self.starLife * (Math.random() * 0.08 + 0.46);
        s.strobe = true;
        s.strobeFreq = Math.random() * 20 + 40;
        if (self.strobeColor) s.secondColor = self.strobeColor;
      }
      s.onDeath = onDeath;
      if (self.glitter) {
        s.sparkFreq = sparkFreq;
        s.sparkSpeed = sparkSpeed;
        s.sparkLife = sparkLife;
        s.sparkLifeVariation = sparkLifeVar;
        s.sparkColor = self.glitterColor;
        s.sparkTimer = Math.random() * s.sparkFreq;
      }
    }

    if (typeof this.color === "string") {
      color = this.color === "random" ? null : this.color;
      if (this.ring) {
        var ringStart = Math.random() * Math.PI;
        var ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15;
        var count = this.starCount;
        var angleDelta = PI_2 / count;
        for (var a = 0; a < PI_2; a += angleDelta) {
          var initX = Math.sin(a) * speed * ringSquash;
          var initY = Math.cos(a) * speed;
          var ns = pointDist(0, 0, initX, initY);
          var na = pointAngle(0, 0, initX, initY) + ringStart;
          var star = starAdd(
            x, y,
            color || randomColor(),
            na, ns,
            self.starLife + Math.random() * self.starLife * self.starLifeVariation
          );
          if (self.glitter) {
            star.sparkFreq = sparkFreq; star.sparkSpeed = sparkSpeed;
            star.sparkLife = sparkLife; star.sparkLifeVariation = sparkLifeVar;
            star.sparkColor = self.glitterColor;
            star.sparkTimer = Math.random() * star.sparkFreq;
          }
        }
      } else {
        createBurst(this.starCount, makeStar);
      }
    } else if (Array.isArray(this.color)) {
      var half = Math.floor(this.starCount / 2);
      color = this.color[0];
      createBurst(half, makeStar);
      color = this.color[1];
      createBurst(half, makeStar);
    }

    if (this.pistil) {
      var inner = new Shell({
        spreadSize: this.spreadSize * 0.5,
        starLife: this.starLife * 0.6,
        starLifeVariation: this.starLifeVariation,
        starDensity: 1.4,
        color: this.pistilColor,
        glitter: "light",
        glitterColor:
          this.pistilColor === COLORS.Gold ? COLORS.Gold : COLORS.White,
      });
      inner.burst(x, y);
    }

    if (this.streamers) {
      var str = new Shell({
        spreadSize: this.spreadSize * 0.9,
        starLife: this.starLife * 0.8,
        starLifeVariation: this.starLifeVariation,
        starCount: Math.max(6, Math.floor(this.spreadSize / 45)),
        color: COLORS.White,
        glitter: "streamer",
      });
      str.burst(x, y);
    }

    BurstFlash_add(x, y, this.spreadSize / 4);
    playSound("burst");
  };

  // ============================================================
  // Burst Helpers
  // ============================================================
  function createBurst(count, factory, startAngle, arcLen) {
    startAngle = startAngle || 0;
    arcLen = arcLen || PI_2;
    var R = 0.5 * Math.sqrt(count / Math.PI);
    var C = 2 * R * Math.PI;
    var CH = C / 2;
    for (var i = 0; i <= CH; i++) {
      var ringAngle = (i / CH) * PI_HALF;
      var ringSize = Math.cos(ringAngle);
      var partsPerFullRing = C * ringSize;
      var partsPerArc = partsPerFullRing * (arcLen / PI_2);
      var angleInc = PI_2 / Math.max(1, partsPerFullRing);
      var angleOff = Math.random() * angleInc + startAngle;
      var maxRand = angleInc * 0.33;
      for (var j = 0; j < partsPerArc; j++) {
        factory(angleInc * j + angleOff + Math.random() * maxRand, ringSize);
      }
    }
  }

  function createParticleArc(start, len, count, rand, factory) {
    var delta = len / count;
    var end = start + len - delta * 0.5;
    for (var a = start; a < end; a += delta) {
      factory(a + Math.random() * delta * rand);
    }
  }

  function crossetteEffect(star) {
    var startAngle = Math.random() * PI_HALF;
    createParticleArc(startAngle, PI_2, 4, 0.5, function (angle) {
      starAdd(star.x, star.y, star.color, angle, Math.random() * 0.6 + 0.75, 600);
    });
  }

  function crackleEffect(star) {
    createParticleArc(0, PI_2, 16, 1.8, function (angle) {
      sparkAdd(
        star.x, star.y, COLORS.Gold, angle,
        Math.pow(Math.random(), 0.45) * 2.4,
        300 + Math.random() * 200
      );
    });
  }

  function floralEffect(star) {
    createBurst(12, function (angle, speedMult) {
      starAdd(star.x, star.y, star.color, angle, speedMult * 2.4, 1000 + Math.random() * 300);
    });
    BurstFlash_add(star.x, star.y, 46);
  }

  function fallingLeavesEffect(star) {
    createBurst(7, function (angle, speedMult) {
      var ns = starAdd(star.x, star.y, INVISIBLE, angle, speedMult * 2.4, 2400 + Math.random() * 600);
      ns.sparkColor = COLORS.Gold;
      ns.sparkFreq = 144;
      ns.sparkSpeed = 0.28;
      ns.sparkLife = 750;
      ns.sparkLifeVariation = 3.2;
    });
    BurstFlash_add(star.x, star.y, 46);
  }

  // ============================================================
  // Main Controller
  // ============================================================
  var trailsStage, mainStage;
  var stageWidth, stageHeight;
  var paused = false;
  var autoLaunchTime = 0;
  var skyR = 0, skyG = 0, skyB = 0;
  var targetSkyR = 0, targetSkyG = 0, targetSkyB = 0;
  var skyLighting = 2;
  var longExposure = false;

  var overlayEl, containerEl, trailsCanvas, mainCanvas, closeBtn, controlsEl, menuEl;
  var menuVisible = false;
  var autoLaunchEnabled = true;
  var passthroughEnabled = false;
  var semiPassthroughEnabled = false;
  var bgAlpha = 0.45;
  var curtainAlpha = 0;

  function getShellType() {
    if (currentShellType === "Random") return randomShellType();
    return shellTypes[currentShellType];
  }

  function launchShellAt(x, y) {
    var factory = getShellType();
    var shell = new Shell(factory(currentShellSize));
    shell.launch(x, y);
  }

  function autoLaunchShell() {
    var factory = getShellType();
    var size = currentShellSize;
    var variance = Math.min(2.5, size) * Math.random();
    var height = variance === 0 ? Math.random() : 1 - (variance / Math.min(2.5, size));
    var off = Math.random() * (1 - height * 0.65) * 0.5;
    var x = Math.random() < 0.5 ? 0.5 - off : 0.5 + off;
    var edge = 0.18;
    x = (1 - edge * 2) * x + edge;
    var shell = new Shell(factory(size - variance));
    shell.launch(x, height * 0.75);
    return 900 + Math.random() * 600 + shell.starLife;
  }

  // ============================================================
  // Update / Render
  // ============================================================
  function update(frameTime, lag) {
    if (paused) return;
    var timeStep = frameTime;
    var speed = lag;
    starCurrentFrame++;

    if (autoLaunchEnabled) {
      autoLaunchTime -= timeStep;
      if (autoLaunchTime <= 0) {
        autoLaunchTime = autoLaunchShell() * 1.25;
      }
    }

    var starDrag = 1 - (1 - starAirDrag) * speed;
    var starDragHeavy = 1 - (1 - starAirDragHeavy) * speed;
    var spDrag = 1 - (1 - sparkAirDrag) * speed;
    var gAcc = (timeStep / 1000) * 0.9;

    for (var ci = 0; ci < COLOR_CODES_W_INVIS.length; ci++) {
      var clr = COLOR_CODES_W_INVIS[ci];
      var stars = starActive[clr];
      for (var i = stars.length - 1; i >= 0; i--) {
        var s = stars[i];
        if (s.updateFrame === starCurrentFrame) continue;
        s.updateFrame = starCurrentFrame;
        s.life -= timeStep;
        if (s.life <= 0) { stars.splice(i, 1); starReturn(s); continue; }

        s.prevX = s.x; s.prevY = s.y;
        s.x += s.speedX * speed;
        s.y += s.speedY * speed;
        s.speedX *= s.heavy ? starDragHeavy : starDrag;
        s.speedY *= s.heavy ? starDragHeavy : starDrag;
        s.speedY += gAcc;

        if (s.spinRadius) {
          s.spinAngle += s.spinSpeed * speed;
          s.x += Math.sin(s.spinAngle) * s.spinRadius * speed;
          s.y += Math.cos(s.spinAngle) * s.spinRadius * speed;
        }

        if (s.sparkFreq) {
          s.sparkTimer -= timeStep;
          while (s.sparkTimer < 0) {
            s.sparkTimer += s.sparkFreq * 0.75 + s.sparkFreq * Math.pow(1 - s.life / s.fullLife, 0.5) * 4;
            sparkAdd(
              s.x, s.y, s.sparkColor,
              Math.random() * PI_2,
              Math.random() * s.sparkSpeed,
              s.sparkLife * 0.8 + Math.random() * s.sparkLifeVariation * s.sparkLife
            );
          }
        }

        if (s.life < s.transitionTime) {
          if (s.secondColor && !s.colorChanged) {
            s.colorChanged = true;
            s.color = s.secondColor;
            stars.splice(i, 1);
            starActive[s.secondColor].push(s);
            if (s.secondColor === INVISIBLE) s.sparkFreq = 0;
          }
          if (s.strobe) {
            s.visible = Math.floor(s.life / s.strobeFreq) % 3 === 0;
          }
        }
      }

      var sparks = sparkActive[clr];
      for (var j = sparks.length - 1; j >= 0; j--) {
        var sp = sparks[j];
        sp.life -= timeStep;
        if (sp.life <= 0) { sparks.splice(j, 1); sparkPool.push(sp); continue; }
        sp.prevX = sp.x; sp.prevY = sp.y;
        sp.x += sp.speedX * speed;
        sp.y += sp.speedY * speed;
        sp.speedX *= spDrag;
        sp.speedY *= spDrag;
        sp.speedY += gAcc;
      }
    }

    render(speed);
  }

  function render(speed) {
    var w = stageWidth, h = stageHeight;
    var tCtx = trailsStage.ctx;
    var mCtx = mainStage.ctx;
    var dpr = trailsStage.dpr;

    if (skyLighting > 0) {
      var totalStars = 0;
      targetSkyR = 0; targetSkyG = 0; targetSkyB = 0;
      for (var ci = 0; ci < COLOR_CODES.length; ci++) {
        var count = starActive[COLOR_CODES[ci]].length;
        totalStars += count;
        targetSkyR += 255 * count;
        targetSkyG += 255 * count;
        targetSkyB += 255 * count;
      }
      var intensity = Math.pow(Math.min(1, totalStars / 500), 0.3);
      var maxComp = Math.max(1, targetSkyR, targetSkyG, targetSkyB);
      targetSkyR = targetSkyR / maxComp * skyLighting * 15 * intensity;
      targetSkyG = targetSkyG / maxComp * skyLighting * 15 * intensity;
      targetSkyB = targetSkyB / maxComp * skyLighting * 15 * intensity;
      skyR += (targetSkyR - skyR) / 10 * speed;
      skyG += (targetSkyG - skyG) / 10 * speed;
      skyB += (targetSkyB - skyB) / 10 * speed;
      containerEl.style.backgroundColor =
        "rgba(" + (skyR | 0) + "," + (skyG | 0) + "," + (skyB | 0) + "," + bgAlpha + ")";
    }

    tCtx.scale(dpr, dpr);
    mCtx.scale(dpr, dpr);

    tCtx.globalCompositeOperation = "source-over";
    tCtx.fillStyle = "rgba(0,0,0," + (longExposure ? 0.0025 : 0.175 * speed) + ")";
    tCtx.fillRect(0, 0, w, h);
    mCtx.clearRect(0, 0, w, h);

    while (burstFlashActive.length) {
      var bf = burstFlashActive.pop();
      var grad = tCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
      grad.addColorStop(0.024, "rgba(255,255,255,1)");
      grad.addColorStop(0.125, "rgba(255,160,20,0.2)");
      grad.addColorStop(0.32, "rgba(255,140,20,0.11)");
      grad.addColorStop(1, "rgba(255,120,20,0)");
      tCtx.fillStyle = grad;
      tCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);
      burstFlashPool.push(bf);
    }

    tCtx.globalCompositeOperation = "lighten";
    tCtx.lineWidth = starDrawWidth;
    tCtx.lineCap = "round";
    mCtx.strokeStyle = "#fff";
    mCtx.lineWidth = 1;
    mCtx.beginPath();

    for (var ci = 0; ci < COLOR_CODES.length; ci++) {
      var clr = COLOR_CODES[ci];
      var stars = starActive[clr];
      tCtx.strokeStyle = clr;
      tCtx.beginPath();
      for (var si = 0; si < stars.length; si++) {
        var s = stars[si];
        if (s.visible === false) continue;
        tCtx.moveTo(s.x, s.y);
        tCtx.lineTo(s.prevX, s.prevY);
        mCtx.moveTo(s.x, s.y);
        mCtx.lineTo(s.x - s.speedX * 1.6, s.y - s.speedY * 1.6);
      }
      tCtx.stroke();
    }
    mCtx.stroke();

    tCtx.lineWidth = sparkDrawWidth;
    tCtx.lineCap = "butt";
    for (var ci = 0; ci < COLOR_CODES.length; ci++) {
      var clr = COLOR_CODES[ci];
      var sparks = sparkActive[clr];
      tCtx.strokeStyle = clr;
      tCtx.beginPath();
      for (var si = 0; si < sparks.length; si++) {
        tCtx.moveTo(sparks[si].x, sparks[si].y);
        tCtx.lineTo(sparks[si].prevX, sparks[si].prevY);
      }
      tCtx.stroke();
    }

    tCtx.setTransform(1, 0, 0, 1, 0, 0);
    mCtx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ============================================================
  // Pointer Handlers
  // ============================================================
  function handlePointerStart(ev) {
    if (semiPassthroughEnabled) {
      var t = ev.target;
      if (t && (t.closest('.fw-close-btn') || t.closest('.fw-controls') || t.closest('.fw-menu'))) return;
      var x = ev.clientX / window.innerWidth;
      var y = ev.clientY / window.innerHeight;
      launchShellAt(x, y);
      return;
    }
    if (ev.target !== trailsCanvas && ev.target !== mainCanvas) return;
    var rect = trailsCanvas.getBoundingClientRect();
    var x = (ev.clientX - rect.left) / rect.width;
    var y = (ev.clientY - rect.top) / rect.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      launchShellAt(x, y);
    }
  }

  // ============================================================
  // Public API
  // ============================================================
  window.FireworksMode = {
    start: function () {
      if (window._fwRunning) return;
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === "suspended") audioCtx.resume();
      preloadSounds();

      overlayEl = document.createElement("div");
      overlayEl.id = "fireworks-overlay";
      overlayEl.className = "active";

      containerEl = document.createElement("div");
      containerEl.className = "canvas-container";

      trailsCanvas = document.createElement("canvas");
      trailsCanvas.id = "fw-trails";
      mainCanvas = document.createElement("canvas");
      mainCanvas.id = "fw-main";

      containerEl.appendChild(trailsCanvas);
      containerEl.appendChild(mainCanvas);
      overlayEl.appendChild(containerEl);

      closeBtn = document.createElement("button");
      closeBtn.className = "fw-close-btn";
      closeBtn.innerHTML = "&#10005;";
      overlayEl.appendChild(closeBtn);

      controlsEl = document.createElement("div");
      controlsEl.className = "fw-controls";

      var pauseBtn = document.createElement("button");
      pauseBtn.innerHTML = "&#10074;&#10074;";
      pauseBtn.title = "Pause";
      pauseBtn.onclick = function () {
        paused = !paused;
        pauseBtn.innerHTML = paused ? "&#9654;" : "&#10074;&#10074;";
        pauseBtn.title = paused ? "Resume" : "Pause";
      };

      var soundBtn = document.createElement("button");
      soundBtn.innerHTML = "&#128266;";
      soundBtn.title = "Mute";
      soundBtn.classList.add("active");
      soundBtn.onclick = function () {
        soundsEnabled = !soundsEnabled;
        soundBtn.innerHTML = soundsEnabled ? "&#128266;" : "&#128263;";
        soundBtn.title = soundsEnabled ? "Mute" : "Unmute";
        soundBtn.classList.toggle("active", soundsEnabled);
      };

      var settingsBtn = document.createElement("button");
      settingsBtn.innerHTML = "&#9881;";
      settingsBtn.title = "Settings";
      settingsBtn.onclick = function () { toggleSettings(); };

      controlsEl.appendChild(pauseBtn);
      controlsEl.appendChild(soundBtn);
      controlsEl.appendChild(settingsBtn);
      overlayEl.appendChild(controlsEl);

      menuEl = document.createElement("div");
      menuEl.className = "fw-menu";
      menuEl.innerHTML = buildSettingsHTML();
      overlayEl.appendChild(menuEl);

      document.documentElement.appendChild(overlayEl);
      document.body.style.overflow = "hidden";

      trailsStage = new Stage(trailsCanvas);
      mainStage = new Stage(mainCanvas);
      resizeStages();

      // Clean up any stale listeners (prevents duplicates on re-start)
      tickerRemoveAll();
      document.removeEventListener("mousedown", handlePointerStart);
      document.removeEventListener("touchstart", handlePointerStart);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resizeStages);

      trailsStage.addEventListener("ticker", update);

      document.addEventListener("mousedown", handlePointerStart);
      document.addEventListener("touchstart", handlePointerStart, { passive: false });
      document.addEventListener("keydown", handleKeyDown);
      closeBtn.addEventListener("click", this.stop);
      window.addEventListener("resize", resizeStages);

      paused = false;
      autoLaunchTime = 100;
      skyR = 0; skyG = 0; skyB = 0;
      targetSkyR = 0; targetSkyG = 0; targetSkyB = 0;
      starClearAll();
      sparkClearAll();
      BurstFlash_clear();
      window._fwRunning = true;
      if (window._fwSemiPassthrough) {
        semiPassthroughEnabled = true;
      } else if (window._fwPassthrough) {
        passthroughEnabled = true;
      }
      if ((semiPassthroughEnabled || passthroughEnabled) && overlayEl) {
        overlayEl.classList.add("passthrough");
      }
      var modeSel = document.getElementById('fw-passthrough');
      if (modeSel) {
        modeSel.value = semiPassthroughEnabled ? 2 : (passthroughEnabled ? 1 : 0);
      }
      if (window._fwBgAlpha !== undefined) {
        bgAlpha = window._fwBgAlpha;
      }
      if (trailsCanvas) {
        trailsCanvas.style.opacity = bgAlpha;
      }
      var opacitySlider = document.getElementById('fw-opacity');
      if (opacitySlider) {
        opacitySlider.value = Math.round(bgAlpha * 100);
      }
      if (window._fwCurtainAlpha !== undefined) {
        curtainAlpha = window._fwCurtainAlpha;
      }
      if (overlayEl) {
        overlayEl.style.background = 'rgba(0,0,0,' + curtainAlpha + ')';
      }
      var curtainSlider = document.getElementById('fw-curtain');
      if (curtainSlider) {
        curtainSlider.value = Math.round(curtainAlpha * 100);
      }
    },

    stop: function () {
      paused = true;
      tickerRemoveAll();
      starClearAll();
      sparkClearAll();
      BurstFlash_clear();
      burstFlashPool.length = 0;

      document.removeEventListener("mousedown", handlePointerStart);
      document.removeEventListener("touchstart", handlePointerStart);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", resizeStages);

      if (audioCtx && audioCtx.state !== "closed") {
        try { audioCtx.suspend(); } catch (e) {}
      }

      if (overlayEl && overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
      }
      document.body.style.overflow = "";
      trailsStage = null;
      mainStage = null;
      overlayEl = null;
      window._fwRunning = false;
    },
  };

  function handleKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); stopFireworks(); }
    if (e.key === "p" || e.key === "P") { paused = !paused; }
  }

  function stopFireworks() {
    if (window.FireworksMode) window.FireworksMode.stop();
  }

  function resizeStages() {
    if (!trailsStage || !mainStage) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    trailsStage.resize(w, h);
    mainStage.resize(w, h);
    stageWidth = w;
    stageHeight = h;
  }

  function toggleSettings() {
    menuVisible = !menuVisible;
    if (menuEl) menuEl.classList.toggle("active", menuVisible);
  }

  function buildSettingsHTML() {
    var shellOpts = [
      "Random", "Crackle", "Crossette", "Crysanthemum",
      "Falling Leaves", "Floral", "Ghost", "Horse Tail",
      "Palm", "Ring", "Strobe", "Willow",
    ];
    var sizeOpts = ['3"', '4"', '6"', '8"', '12"', '16"'];
    var html = '<div style="position:relative;text-align:center;"><h3 style="margin:0;">&#35774;&#32622;</h3><button class="fw-menu-close" data-close-settings>&#10005;</button></div>';
    html += '<div class="fw-menu-row"><label>&#28895;&#33457;&#31867;&#22411;</label><select id="fw-shell-type">';
    for (var i = 0; i < shellOpts.length; i++) {
      html += '<option value="' + i + '"' + (shellOpts[i] === currentShellType ? " selected" : "") + ">" + shellOpts[i] + "</option>";
    }
    html += "</select></div>";
    html += '<div class="fw-menu-row"><label>&#28895;&#33457;&#22823;&#23567;</label><select id="fw-shell-size">';
    for (var i = 0; i < sizeOpts.length; i++) {
      html += '<option value="' + (i + 1) + '"' + (i + 1 === currentShellSize ? " selected" : "") + ">" + sizeOpts[i] + "</option>";
    }
    html += "</select></div>";
    html += '<div class="fw-menu-row"><label>&#33258;&#21160;&#29123;&#25918;</label><input type="checkbox" id="fw-auto-launch" checked></div>';
    html += '<div class="fw-menu-row"><label>穿透模式</label><select id="fw-passthrough">' +
      '<option value="0">关闭</option>' +
      '<option value="1">穿透</option>' +
      '<option value="2">半穿透</option>' +
      '</select></div>';
    html += '<div class="fw-menu-row"><label>&#20445;&#30041;&#20809;&#36712;</label><input type="checkbox" id="fw-long-exposure"></div>';
    html += '<div class="fw-menu-row"><label>&#30011;&#24067;&#26263;&#24230;</label><input type="range" id="fw-opacity" min="1" max="100" value="' + Math.round(bgAlpha * 100) + '"></div>';
    html += '<div class="fw-menu-row"><label>&#24149;&#24067;&#36879;&#26126;&#24230;</label><input type="range" id="fw-curtain" min="0" max="100" value="' + Math.round(curtainAlpha * 100) + '"></div>';
    return html;
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest('[data-close-settings]')) {
      toggleSettings();
    }
  });

  document.addEventListener("change", function (e) {
    var shellOpts = [
      "Random", "Crackle", "Crossette", "Crysanthemum",
      "Falling Leaves", "Floral", "Ghost", "Horse Tail",
      "Palm", "Ring", "Strobe", "Willow",
    ];
    if (e.target.id === "fw-shell-type") {
      currentShellType = shellOpts[parseInt(e.target.value)];
    }
    if (e.target.id === "fw-shell-size") {
      currentShellSize = parseInt(e.target.value);
    }
    if (e.target.id === "fw-auto-launch") {
      autoLaunchEnabled = e.target.checked;
    }
    if (e.target.id === "fw-long-exposure") {
      longExposure = e.target.checked;
    }
    if (e.target.id === "fw-passthrough") {
      var val = parseInt(e.target.value);
      passthroughEnabled = val === 1;
      semiPassthroughEnabled = val === 2;
      window._fwPassthrough = passthroughEnabled;
      window._fwSemiPassthrough = semiPassthroughEnabled;
      if (overlayEl) {
        overlayEl.classList.toggle("passthrough", val !== 0);
      }
    }
    if (e.target.id === "fw-opacity") {
      applyOpacity(parseInt(e.target.value));
    }
    if (e.target.id === "fw-curtain") {
      applyCurtain(parseInt(e.target.value));
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target.id === "fw-opacity") {
      applyOpacity(parseInt(e.target.value));
    }
    if (e.target.id === "fw-curtain") {
      applyCurtain(parseInt(e.target.value));
    }
  });

  function applyOpacity(val) {
    bgAlpha = val / 100;
    window._fwBgAlpha = bgAlpha;
    if (trailsCanvas) trailsCanvas.style.opacity = bgAlpha;
  }

  function applyCurtain(val) {
    curtainAlpha = val / 100;
    window._fwCurtainAlpha = curtainAlpha;
    if (overlayEl) overlayEl.style.background = 'rgba(0,0,0,' + curtainAlpha + ')';
  }
})();
