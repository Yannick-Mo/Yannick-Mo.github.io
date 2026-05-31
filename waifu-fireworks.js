(function () {
    'use strict';

    var SoundEngine = (function () {
        function SoundEngine() {
            this.ctx = null;
            this.volume = 0.3;
        }

        SoundEngine.prototype._ensureContext = function () {
            if (!this.ctx) {
                var C = window.AudioContext || window.webkitAudioContext;
                if (!C) return null;
                this.ctx = new C();
            }
            return this.ctx;
        };

        SoundEngine.prototype.launch = function () {
            try {
                var ctx = this._ensureContext();
                if (!ctx) return;
                if (ctx.state === 'suspended') { ctx.resume(); }
                this._playLaunch(ctx);
                this._playExplosion(ctx, 0.6);
                this._playCrackle(ctx, 0.8);
            } catch (e) { /* ignore audio errors */ }
        };

        SoundEngine.prototype._playLaunch = function (ctx) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.6);
            gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        };

        SoundEngine.prototype._playExplosion = function (ctx, delay) {
            var sr = ctx.sampleRate;
            var len = Math.floor(sr * 0.3);
            var buffer = ctx.createBuffer(1, len, sr);
            var data = buffer.getChannelData(0);
            for (var i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
            }
            var source = ctx.createBufferSource();
            source.buffer = buffer;
            var gain = ctx.createGain();
            gain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(ctx.currentTime + delay);
        };

        SoundEngine.prototype._playCrackle = function (ctx, delay) {
            for (var i = 0; i < 8; i++) {
                var d = delay + 0.05 * i + Math.random() * 0.1;
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 2000 + Math.random() * 3000;
                var t = ctx.currentTime + d;
                gain.gain.setValueAtTime(this.volume * 0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.05);
            }
        };

        return SoundEngine;
    })();

    var FireworksManager = (function () {
        function FireworksManager() {
            this.instances = [];
            this.defaults = {
                particles: 80,
                explosion: 6,
                intensity: 30,
                flickering: 50,
                traceSpeed: 3,
                lineStyle: 'round',
                hue: { min: 0, max: 360 },
                delay: { min: 30, max: 60 },
                mouse: { click: false, move: false, max: 1 },
            };
        }

        FireworksManager.prototype.start = function () {
            var FW = typeof Fireworks !== 'undefined' && Fireworks.Fireworks;
            if (!FW) return;
            if (this.instances.length >= 3) return;
            var container = document.createElement('div');
            container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:19999;';
            document.body.appendChild(container);

            var opts = {};
            for (var k in this.defaults) {
                if (this.defaults.hasOwnProperty(k)) {
                    opts[k] = this.defaults[k];
                }
            }
            opts.rocketsPoint = { min: 20, max: 80 };
            opts.hue = {
                min: Math.floor(Math.random() * 360),
                max: 360,
            };
            opts.boundaries = {
                x: 0,
                y: 0,
                width: window.innerWidth,
                height: window.innerHeight,
            };

            var fw = new FW(container, opts);
            fw.launch(3);
            var entry = { container: container, fw: fw };
            this.instances.push(entry);

            var self = this;
            setTimeout(function () { self._stop(entry); }, 4000);
        };

        FireworksManager.prototype._stop = function (entry) {
            var idx = this.instances.indexOf(entry);
            if (idx === -1) return;
            try { entry.fw.stop(); } catch (e) {}
            if (entry.container.parentNode) {
                entry.container.parentNode.removeChild(entry.container);
            }
            this.instances.splice(idx, 1);
        };

        FireworksManager.prototype.cleanup = function () {
            for (var i = this.instances.length - 1; i >= 0; i--) {
                this._stop(this.instances[i]);
            }
        };

        return FireworksManager;
    })();

    window.WaifuFireworks = {
        soundEngine: new SoundEngine(),
        fireworksManager: new FireworksManager(),
    };
})();
