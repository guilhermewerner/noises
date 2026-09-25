import type { NoiseColor } from "./buffers";
import type { SoundFactory, Voice } from "./engine";
import type { SoundId } from "../data/sounds";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const chance = (p: number) => Math.random() < p;

/**
 * Runs `fire` repeatedly on the audio clock. `delay` gives the gap until the next
 * event; `fire` may return how long it keeps busy, which is added to the gap.
 */
function every(v: Voice, delay: () => number, fire: (t: number) => number | void, firstDelay = delay()) {
    let next = v.ctx.currentTime + firstDelay;
    v.schedule((from, to) => {
        if (next < from) next = from + 0.01;
        while (next < to) {
            const busy = fire(next) ?? 0;
            next += busy + delay();
        }
    });
}

/** Slowly wanders an AudioParam between min and max. */
function drift(v: Voice, param: AudioParam, min: number, max: number, interval: [number, number], smooth: number) {
    param.value = rand(min, max);
    every(v, () => rand(interval[0], interval[1]), (t) => {
        param.setTargetAtTime(rand(min, max), t, smooth);
    });
}

function filter(v: Voice, type: BiquadFilterType, frequency: number, Q = 0.7) {
    const f = v.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = Q;
    return f;
}

function gain(v: Voice, value: number) {
    const g = v.ctx.createGain();
    g.gain.value = value;
    return g;
}

function panner(v: Voice, pan: number) {
    const p = v.ctx.createStereoPanner();
    p.pan.value = pan;
    return p;
}

/** A continuous, looping noise source. */
function bed(v: Voice, color: NoiseColor, rate = 1) {
    const src = v.ctx.createBufferSource();
    src.buffer = v.noise(color);
    src.loop = true;
    src.playbackRate.value = rate;
    src.loopStart = 0;
    v.keep(src);
    return src;
}

interface Burst {
    color?: NoiseColor;
    type?: BiquadFilterType;
    freq: number;
    Q?: number;
    peak: number;
    attack?: number;
    decay: number;
    pan?: number;
    wet?: number;
}

/** A short enveloped noise burst (drops, clicks, cracks...). */
function burst(v: Voice, t: number, b: Burst) {
    const { ctx } = v;
    const src = ctx.createBufferSource();
    const buffer = v.noise(b.color ?? "white");
    src.buffer = buffer;
    const f = filter(v, b.type ?? "bandpass", b.freq, b.Q ?? 1);
    const g = gain(v, 0);
    const attack = b.attack ?? 0.002;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(b.peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + b.decay);
    const p = panner(v, b.pan ?? 0);
    src.connect(f).connect(g).connect(p).connect(v.out);
    if (b.wet) p.connect(gain(v, b.wet)).connect(v.reverb);
    src.start(t, rand(0, buffer.duration - 1));
    src.stop(t + attack + b.decay + 0.05);
}

interface Tone {
    type?: OscillatorType;
    freq: number;
    to?: number;
    glide?: number;
    peak: number;
    attack?: number;
    decay: number;
    pan?: number;
    wet?: number;
}

/** A short enveloped oscillator with an optional exponential pitch glide. */
function tone(v: Voice, t: number, o: Tone) {
    const { ctx } = v;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    const attack = o.attack ?? 0.004;
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? attack + o.decay));
    const g = gain(v, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + o.decay);
    const p = panner(v, o.pan ?? 0);
    osc.connect(g).connect(p).connect(v.out);
    if (o.wet) p.connect(gain(v, o.wet)).connect(v.reverb);
    osc.start(t);
    osc.stop(t + attack + o.decay + 0.05);
    return osc;
}

/** Soft saturation curve for grit. */
function saturator(v: Voice, amount = 3) {
    const shaper = v.ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    shaper.curve = curve;
    return shaper;
}

const KEYS = "ASDFGHJKLQWERTYUIOPZXCVBNM0123456789;{}<>/=+*#@&";

// ---------------------------------------------------------------------------
// Sounds
// ---------------------------------------------------------------------------

const white: SoundFactory = (v) => {
    bed(v, "white").connect(gain(v, 0.16)).connect(v.out);
};

const pink: SoundFactory = (v) => {
    bed(v, "pink").connect(gain(v, 0.42)).connect(v.out);
};

const brown: SoundFactory = (v) => {
    bed(v, "brown").connect(gain(v, 0.55)).connect(v.out);
};

const rain: SoundFactory = (v) => {
    bed(v, "pink").connect(filter(v, "highpass", 450)).connect(filter(v, "lowpass", 9000)).connect(gain(v, 0.32)).connect(v.out);

    const hiss = gain(v, 0.05);
    bed(v, "white", 0.9).connect(filter(v, "bandpass", 3200, 0.4)).connect(hiss).connect(v.out);
    drift(v, hiss.gain, 0.03, 0.07, [0.6, 1.4], 0.5);

    // Individual drops hitting leaves, roof, puddles.
    every(v, () => -Math.log(1 - Math.random()) / 38, (t) => {
        burst(v, t, {
            freq: rand(1400, 7000),
            Q: rand(1.5, 7),
            peak: rand(0.03, 0.2),
            decay: rand(0.012, 0.05),
            pan: rand(-0.9, 0.9),
        });
    });

    // Occasional "plink" into a puddle.
    every(v, () => rand(0.15, 0.6), (t) => {
        const f = rand(900, 2200);
        tone(v, t, { freq: f, to: f * rand(1.4, 2), peak: rand(0.01, 0.035), decay: rand(0.03, 0.07), pan: rand(-0.8, 0.8) });
    });
};

const thunder: SoundFactory = (v) => {
    every(
        v,
        () => rand(7, 20),
        (t) => {
            const intensity = rand(0.45, 1);
            // Light travels faster than sound.
            const distance = rand(0.15, 1.6);
            v.emitAt(t, { type: "lightning", intensity });
            const s = t + distance;
            const { ctx } = v;

            if (distance < 0.7) {
                burst(v, s, { type: "highpass", freq: 1200, peak: 0.55 * intensity, decay: 0.35, wet: 0.6 });
                burst(v, s + 0.04, { type: "lowpass", freq: 3000, peak: 0.4 * intensity, decay: 0.6, wet: 0.5 });
            }

            const src = ctx.createBufferSource();
            src.buffer = v.noise("brown");
            const lp = filter(v, "lowpass", 1400, 0.9);
            lp.frequency.setValueAtTime(1400 - distance * 500, s);
            lp.frequency.exponentialRampToValueAtTime(110, s + 4);
            const g = gain(v, 0);
            const length = rand(4, 7.5);
            g.gain.setValueAtTime(0, s);
            g.gain.linearRampToValueAtTime(1.1 * intensity, s + 0.12 + distance * 0.1);
            // Rolling rumble: a few random swells on the way down.
            let at = s + 0.3;
            let level = intensity;
            while (at < s + length - 1) {
                level *= rand(0.55, 0.95);
                g.gain.linearRampToValueAtTime(level * rand(0.7, 1.3), at);
                at += rand(0.3, 0.9);
            }
            g.gain.linearRampToValueAtTime(0.0001, s + length);
            src.connect(lp).connect(saturator(v, 1.6)).connect(g);
            g.connect(v.out);
            g.connect(gain(v, 0.7)).connect(v.reverb);
            src.start(s, rand(0, 3));
            src.stop(s + length + 0.1);
            return distance + length * 0.5;
        },
        rand(1.5, 3.5),
    );
};

const wind: SoundFactory = (v) => {
    for (const pan of [-0.6, 0.6]) {
        const bp = filter(v, "bandpass", 500, 1.4);
        const g = gain(v, 0.4);
        bed(v, "pink").connect(bp).connect(g).connect(panner(v, pan)).connect(v.out);
        drift(v, bp.frequency, 220, 950, [0.8, 2], 1.2);
        drift(v, g.gain, 0.2, 1.1, [1, 2.5], 1.1);
    }

    // Whistling through the cracks.
    const whistle = filter(v, "bandpass", 1600, 14);
    const wg = gain(v, 0);
    bed(v, "white").connect(whistle).connect(wg).connect(v.out);
    drift(v, whistle.frequency, 900, 2400, [1.2, 3], 1.5);
    drift(v, wg.gain, 0, 0.35, [1.5, 4], 1.4);
};

const ocean: SoundFactory = (v) => {
    const lp = filter(v, "lowpass", 500);
    const swell = gain(v, 0.25);
    bed(v, "brown").connect(lp).connect(swell).connect(v.out);

    const foamFilter = filter(v, "bandpass", 2500, 0.5);
    const foam = gain(v, 0.02);
    bed(v, "pink").connect(foamFilter).connect(foam).connect(v.out);

    every(
        v,
        () => rand(6, 11),
        (t) => {
            const size = rand(0.6, 1);
            swell.gain.setTargetAtTime(0.95 * size, t, 1.1);
            lp.frequency.setTargetAtTime(1500 * size, t, 1.1);
            // The crash, then the wash retreating.
            foam.gain.setTargetAtTime(0.26 * size, t + 2, 0.5);
            foamFilter.frequency.setTargetAtTime(4200, t + 2, 0.8);
            swell.gain.setTargetAtTime(0.22, t + 2.8, 1.6);
            lp.frequency.setTargetAtTime(420, t + 2.8, 1.8);
            foam.gain.setTargetAtTime(0.015, t + 3.4, 1.4);
            foamFilter.frequency.setTargetAtTime(2200, t + 3.4, 1.5);
            v.emitAt(t + 2, { type: "wave" });
        },
        0.3,
    );
};

const stream: SoundFactory = (v) => {
    bed(v, "white").connect(filter(v, "bandpass", 2600, 0.6)).connect(gain(v, 0.07)).connect(v.out);
    const gurgle = filter(v, "bandpass", 700, 0.9);
    const gg = gain(v, 0.2);
    bed(v, "pink").connect(gurgle).connect(gg).connect(v.out);
    drift(v, gurgle.frequency, 450, 1100, [0.2, 0.6], 0.15);
    drift(v, gg.gain, 0.12, 0.28, [0.2, 0.5], 0.1);

    // Bubbles: sines with a rising chirp.
    every(v, () => -Math.log(1 - Math.random()) / 22, (t) => {
        const f = rand(450, 1700);
        tone(v, t, {
            freq: f,
            to: f * rand(1.3, 2.4),
            peak: rand(0.015, 0.07),
            attack: 0.003,
            decay: rand(0.025, 0.08),
            pan: rand(-0.8, 0.8),
        });
        if (chance(0.03)) v.emitAt(t, { type: "pop" });
    });
};

const fire: SoundFactory = (v) => {
    const rumble = gain(v, 0.45);
    bed(v, "brown").connect(filter(v, "lowpass", 320)).connect(rumble).connect(v.out);
    drift(v, rumble.gain, 0.3, 0.6, [0.15, 0.5], 0.12);

    const hiss = gain(v, 0.015);
    bed(v, "white").connect(filter(v, "highpass", 4000)).connect(hiss).connect(v.out);
    drift(v, hiss.gain, 0.004, 0.03, [0.2, 0.6], 0.15);

    // Crackles come in little clusters.
    every(v, () => (chance(0.35) ? rand(0.01, 0.05) : rand(0.08, 0.5)), (t) => {
        const big = chance(0.08);
        burst(v, t, {
            type: big ? "bandpass" : "highpass",
            freq: big ? rand(600, 1500) : rand(1500, 6000),
            Q: big ? 1.2 : 0.7,
            peak: big ? rand(0.4, 0.7) : rand(0.08, 0.4),
            attack: 0.0008,
            decay: big ? rand(0.03, 0.08) : rand(0.004, 0.02),
            pan: rand(-0.5, 0.5),
        });
        if (big) v.emitAt(t, { type: "pop" });
    });
};

const crickets: SoundFactory = (v) => {
    for (let i = 0; i < 5; i++) {
        const osc = v.ctx.createOscillator();
        osc.frequency.value = rand(3900, 5200);
        const g = gain(v, 0);
        const p = panner(v, rand(-0.9, 0.9));
        osc.connect(g).connect(p).connect(v.out);
        p.connect(gain(v, 0.2)).connect(v.reverb);
        v.keep(osc);

        const amp = rand(0.04, 0.11);
        const period = rand(0.55, 1.1);
        const pulses = Math.floor(rand(2, 5));
        every(
            v,
            () => period * rand(0.92, 1.08) + (chance(0.08) ? rand(2, 6) : 0),
            (t) => {
                for (let k = 0; k < pulses; k++) {
                    const at = t + k * 0.045;
                    g.gain.setValueAtTime(0, at);
                    g.gain.linearRampToValueAtTime(amp, at + 0.008);
                    g.gain.linearRampToValueAtTime(0, at + 0.03);
                }
            },
            rand(0, 1),
        );
    }
};

const birds: SoundFactory = (v) => {
    every(v, () => rand(0.7, 3.2), (t) => {
        const pan = rand(-0.9, 0.9);
        const loud = rand(0.03, 0.09);
        const wet = 0.35;
        const kind = pick(["tweet", "whistle", "trill", "dove"] as const);
        v.emitAt(t, { type: "bird" });

        if (kind === "tweet") {
            const n = Math.floor(rand(2, 6));
            const base = rand(2500, 4200);
            for (let i = 0; i < n; i++) {
                tone(v, t + i * rand(0.09, 0.14), { freq: base, to: base * rand(1.2, 1.6), glide: 0.07, peak: loud, decay: 0.07, pan, wet });
            }
            return n * 0.12;
        }
        if (kind === "whistle") {
            const base = rand(1700, 2400);
            tone(v, t, { freq: base, to: base * 1.7, glide: 0.3, peak: loud, attack: 0.03, decay: 0.3, pan, wet });
            tone(v, t + 0.36, { freq: base * 1.6, to: base * 1.2, glide: 0.2, peak: loud * 0.8, attack: 0.01, decay: 0.2, pan, wet });
            return 0.6;
        }
        if (kind === "trill") {
            const n = Math.floor(rand(8, 16));
            const a = rand(3800, 4800);
            for (let i = 0; i < n; i++) {
                const f = i % 2 ? a : a * 1.15;
                tone(v, t + i * 0.038, { freq: f, to: f * 0.9, peak: loud * 0.7, attack: 0.003, decay: 0.028, pan, wet });
            }
            return n * 0.04;
        }
        // Dove: low "hoo-hooo".
        const base = rand(480, 560);
        for (const [dt, len] of [[0, 0.25], [0.35, 0.5]] as const) {
            tone(v, t + dt, { type: "triangle", freq: base * 1.1, to: base, peak: loud * 0.9, attack: 0.06, decay: len, pan, wet: 0.5 });
        }
        return 1;
    });
};

const dog: SoundFactory = (v) => {
    const bark = (t: number, f: number, loud: number, pan: number) => {
        const { ctx } = v;
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f * 0.8, t);
        osc.frequency.linearRampToValueAtTime(f * 1.3, t + 0.03);
        osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.17);

        const formant = filter(v, "bandpass", f * 2.6, 1.3);
        const body = filter(v, "lowpass", 2400, 1);
        const g = gain(v, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(loud, t + 0.012);
        g.gain.setValueAtTime(loud * 0.85, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        const p = panner(v, pan);

        osc.connect(saturator(v, 4)).connect(formant).connect(g);
        osc.connect(body).connect(gain(v, 0.35)).connect(g);
        g.connect(p).connect(v.out);
        p.connect(gain(v, 0.45)).connect(v.reverb);
        osc.start(t);
        osc.stop(t + 0.25);

        burst(v, t, { freq: f * 3, Q: 1, peak: loud * 0.5, attack: 0.005, decay: 0.12, pan });
        v.emitAt(t, { type: "bark" });
    };

    every(
        v,
        () => rand(3.5, 10),
        (t) => {
            // Each group is a different dog: small ones yap high, big ones woof low.
            const f = rand(230, 620);
            const loud = rand(0.35, 0.8);
            const pan = rand(-0.8, 0.8);
            const n = Math.floor(rand(1, 5));
            let at = t;
            for (let i = 0; i < n; i++) {
                bark(at, f * rand(0.95, 1.05), loud * rand(0.8, 1), pan);
                at += rand(0.22, 0.4);
            }
            return at - t;
        },
        rand(0.5, 2),
    );
};

const cat: SoundFactory = (v) => {
    // Purring = low noise amplitude-modulated around 25 Hz, following the breath.
    const lp = filter(v, "lowpass", 380, 2.5);
    const am = gain(v, 0.5);
    const breath = gain(v, 0.5);
    bed(v, "brown").connect(lp).connect(am).connect(breath).connect(v.out);

    const lfo = v.keep(v.ctx.createOscillator());
    lfo.type = "triangle";
    lfo.frequency.value = 25;
    lfo.connect(gain(v, 0.5)).connect(am.gain);

    every(v, () => rand(2.4, 3.2), (t) => {
        // Inhale: softer, slightly lower. Exhale: fuller.
        breath.gain.setTargetAtTime(0.35, t, 0.15);
        lfo.frequency.setTargetAtTime(22, t, 0.1);
        lp.frequency.setTargetAtTime(320, t, 0.2);
        breath.gain.setTargetAtTime(0.85, t + 1.1, 0.15);
        lfo.frequency.setTargetAtTime(27, t + 1.1, 0.1);
        lp.frequency.setTargetAtTime(460, t + 1.1, 0.2);
        v.emitAt(t + 1.1, { type: "purr" });
    });
};

const tools: SoundFactory = (v) => {
    const hit = (t: number, loud: number, pan: number) => {
        tone(v, t, { freq: 190, to: 55, peak: 0.5 * loud, decay: 0.14, pan });
        burst(v, t, { type: "highpass", freq: 2200, peak: 0.45 * loud, attack: 0.001, decay: 0.03, pan });
        const ring = rand(900, 1500);
        for (const ratio of [1, 2.76, 5.4]) {
            tone(v, t, { freq: ring * ratio, peak: (0.07 * loud) / ratio, decay: rand(0.3, 0.7), pan, wet: 0.4 });
        }
        v.emitAt(t, { type: "hit", intensity: loud });
    };

    const saw = (t: number) => {
        const strokes = Math.floor(rand(4, 9));
        const src = v.ctx.createBufferSource();
        src.buffer = v.noise("white");
        const bp = filter(v, "bandpass", 2500, 2);
        const g = gain(v, 0);
        const pan = rand(-0.5, 0.5);
        src.connect(bp).connect(g).connect(panner(v, pan)).connect(v.out);
        for (let i = 0; i < strokes; i++) {
            const at = t + i * 0.42;
            bp.frequency.setValueAtTime(1800, at);
            bp.frequency.linearRampToValueAtTime(3400, at + 0.2);
            bp.frequency.linearRampToValueAtTime(2200, at + 0.42);
            g.gain.setValueAtTime(0.02, at);
            g.gain.linearRampToValueAtTime(0.3, at + 0.1);
            g.gain.linearRampToValueAtTime(0.06, at + 0.21);
            g.gain.linearRampToValueAtTime(0.22, at + 0.3);
            g.gain.linearRampToValueAtTime(0.02, at + 0.42);
        }
        src.start(t, rand(0, 4));
        src.stop(t + strokes * 0.42 + 0.05);
        return strokes * 0.42;
    };

    const grinder = (t: number) => {
        const length = rand(1.5, 3.5);
        const { ctx } = v;
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(60, t);
        osc.frequency.exponentialRampToValueAtTime(190, t + 0.4);
        osc.frequency.setValueAtTime(190, t + length);
        osc.frequency.exponentialRampToValueAtTime(40, t + length + 0.8);
        const og = gain(v, 0.12);
        osc.connect(filter(v, "lowpass", 1800)).connect(og);

        const src = ctx.createBufferSource();
        src.buffer = v.noise("white");
        const ng = gain(v, 0);
        // The metal-on-disc screech, wobbling as pressure changes.
        const bp = filter(v, "bandpass", 3800, 3);
        src.connect(bp).connect(ng);
        ng.gain.setValueAtTime(0, t + 0.3);
        for (let at = t + 0.4; at < t + length; at += rand(0.15, 0.35)) ng.gain.linearRampToValueAtTime(rand(0.12, 0.35), at);
        ng.gain.linearRampToValueAtTime(0, t + length + 0.1);

        const env = gain(v, 0);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(1, t + 0.2);
        env.gain.setValueAtTime(1, t + length);
        env.gain.linearRampToValueAtTime(0, t + length + 0.8);
        const p = panner(v, rand(-0.6, 0.6));
        og.connect(env);
        ng.connect(env);
        env.connect(p).connect(v.out);
        p.connect(gain(v, 0.2)).connect(v.reverb);
        osc.start(t);
        osc.stop(t + length + 0.9);
        src.start(t, rand(0, 4));
        src.stop(t + length + 0.2);
        v.emitAt(t + 0.3, { type: "grind", duration: length - 0.2 });
        return length + 0.8;
    };

    const drill = (t: number) => {
        const length = rand(1, 2.5);
        const osc = v.ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(70, t);
        osc.frequency.exponentialRampToValueAtTime(rand(260, 340), t + 0.5);
        osc.frequency.setValueAtTime(osc.frequency.value, t + length);
        osc.frequency.exponentialRampToValueAtTime(50, t + length + 0.5);
        const g = gain(v, 0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.1);
        g.gain.setValueAtTime(0.09, t + length);
        g.gain.linearRampToValueAtTime(0, t + length + 0.5);
        osc.connect(filter(v, "lowpass", 1400, 2)).connect(g).connect(panner(v, rand(-0.5, 0.5))).connect(v.out);
        osc.start(t);
        osc.stop(t + length + 0.6);
        return length + 0.5;
    };

    every(
        v,
        () => rand(0.8, 3),
        (t) => {
            const roll = Math.random();
            if (roll < 0.42) {
                const n = Math.floor(rand(2, 7));
                const pan = rand(-0.6, 0.6);
                const gap = rand(0.32, 0.55);
                for (let i = 0; i < n; i++) hit(t + i * gap, rand(0.7, 1), pan);
                return n * gap;
            }
            if (roll < 0.65) return saw(t);
            if (roll < 0.87) return grinder(t);
            return drill(t);
        },
        0.4,
    );
};

const cafe: SoundFactory = (v) => {
    bed(v, "brown").connect(filter(v, "lowpass", 500)).connect(gain(v, 0.15)).connect(v.out);

    // Crowd murmur: several "voices" of formant-filtered noise with syllable-like gating.
    for (let i = 0; i < 6; i++) {
        const bp = filter(v, "bandpass", rand(350, 1100), rand(2, 4));
        const g = gain(v, 0);
        const p = panner(v, rand(-0.8, 0.8));
        bed(v, "pink").connect(bp).connect(g).connect(p).connect(v.out);
        p.connect(gain(v, 0.3)).connect(v.reverb);
        const loud = rand(0.12, 0.3);
        every(v, () => rand(0.07, 0.22) + (chance(0.06) ? rand(1, 3) : 0), (t) => {
            g.gain.setTargetAtTime(chance(0.25) ? 0.01 : rand(0.3, 1) * loud, t, 0.035);
            bp.frequency.setTargetAtTime(rand(300, 1200), t, 0.05);
        });
    }

    const clink = (t: number, loud: number, pan: number) => {
        const f = rand(2400, 4200);
        for (const ratio of [1, 1.48, 2.32]) {
            tone(v, t, { freq: f * ratio, peak: loud / ratio, attack: 0.001, decay: rand(0.2, 0.5), pan, wet: 0.35 });
        }
    };

    every(v, () => rand(1.5, 6), (t) => {
        const pan = rand(-0.8, 0.8);
        if (chance(0.3)) {
            // Stirring a spoon in the cup.
            const n = Math.floor(rand(5, 10));
            for (let i = 0; i < n; i++) clink(t + i * rand(0.13, 0.18), 0.012, pan);
            v.emitAt(t, { type: "clink" });
            return n * 0.16;
        }
        clink(t, rand(0.02, 0.05), pan);
        v.emitAt(t, { type: "clink" });
    });

    // The espresso machine, every so often.
    every(
        v,
        () => rand(18, 40),
        (t) => {
            burst(v, t, { freq: 4800, Q: 1.2, peak: 0.08, attack: 0.6, decay: rand(2, 3.5), pan: rand(-0.5, 0.5), wet: 0.3 });
            return 4;
        },
        rand(6, 14),
    );
};

const keyboard: SoundFactory = (v) => {
    const key = (t: number, space: boolean, pan: number) => {
        const loud = rand(0.7, 1);
        burst(v, t, { freq: rand(2400, 4500), Q: 1.6, peak: 0.28 * loud, attack: 0.001, decay: 0.012, pan });
        tone(v, t + 0.004, { type: "triangle", freq: space ? rand(110, 140) : rand(170, 260), to: space ? 90 : 140, peak: (space ? 0.3 : 0.2) * loud, attack: 0.002, decay: 0.04, pan });
        burst(v, t + rand(0.06, 0.09), { freq: rand(1800, 3000), Q: 1.4, peak: 0.08 * loud, attack: 0.001, decay: 0.01, pan });
        if (!space) v.emitAt(t, { type: "key", char: pick([...KEYS]) });
    };

    every(
        v,
        () => rand(0.6, 3.5),
        (t) => {
            const pan = rand(-0.3, 0.3);
            const words = Math.floor(rand(2, 10));
            const speed = rand(0.07, 0.13);
            let at = t;
            for (let w = 0; w < words; w++) {
                const letters = Math.floor(rand(2, 9));
                for (let l = 0; l < letters; l++) {
                    key(at, false, pan + rand(-0.1, 0.1));
                    at += speed * rand(0.6, 1.6);
                }
                key(at, true, pan);
                at += speed * rand(1, 2.5);
            }
            // Smash enter (and maybe backspace a few times).
            if (chance(0.3)) for (let i = 0; i < 4; i++) key((at += 0.09), false, pan);
            return at - t;
        },
        0.3,
    );
};

const fan: SoundFactory = (v) => {
    const main = gain(v, 0.4);
    bed(v, "brown").connect(filter(v, "lowpass", 650)).connect(main).connect(v.out);
    bed(v, "pink").connect(filter(v, "bandpass", 1300, 0.5)).connect(gain(v, 0.07)).connect(v.out);

    // Blade flutter.
    const lfo = v.keep(v.ctx.createOscillator());
    lfo.frequency.value = 13;
    lfo.connect(gain(v, 0.06)).connect(main.gain);

    for (const [f, g] of [[120, 0.012], [240, 0.006]] as const) {
        const hum = v.keep(v.ctx.createOscillator());
        hum.frequency.value = f;
        hum.connect(gain(v, g)).connect(v.out);
    }
};

const train: SoundFactory = (v) => {
    const rumble = gain(v, 0.5);
    bed(v, "brown").connect(filter(v, "lowpass", 260)).connect(rumble).connect(v.out);
    drift(v, rumble.gain, 0.4, 0.6, [0.5, 1.5], 0.4);
    const rattle = filter(v, "bandpass", 450, 0.8);
    const rg = gain(v, 0.12);
    bed(v, "pink").connect(rattle).connect(rg).connect(v.out);
    drift(v, rattle.frequency, 300, 700, [0.4, 1], 0.3);

    const clack = (t: number, pan: number) => {
        tone(v, t, { freq: 95, to: 45, peak: 0.4, decay: 0.09, pan });
        burst(v, t, { freq: rand(1200, 1800), Q: 2, peak: 0.18, attack: 0.001, decay: 0.035, pan });
    };

    // The classic da-dum... da-dum.
    every(v, () => rand(1.02, 1.1), (t) => {
        clack(t, -0.3);
        clack(t + 0.13, 0.3);
    });

    every(
        v,
        () => rand(25, 50),
        (t) => {
            const length = rand(1, 1.8);
            const lp = filter(v, "lowpass", 1600);
            const g = gain(v, 0);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.14, t + 0.15);
            g.gain.setValueAtTime(0.14, t + length);
            g.gain.linearRampToValueAtTime(0, t + length + 0.4);
            lp.connect(g);
            g.connect(v.out);
            g.connect(gain(v, 0.9)).connect(v.reverb);
            for (const f of [277, 349, 415]) {
                const osc = v.ctx.createOscillator();
                osc.type = "sawtooth";
                osc.frequency.value = f;
                osc.connect(lp);
                osc.start(t);
                osc.stop(t + length + 0.5);
            }
            v.emitAt(t, { type: "horn" });
            return length;
        },
        rand(6, 12),
    );
};

export const SOUND_FACTORIES: Record<SoundId, SoundFactory> = {
    rain,
    thunder,
    wind,
    ocean,
    stream,
    fire,
    crickets,
    birds,
    dog,
    cat,
    tools,
    cafe,
    keyboard,
    fan,
    train,
    white,
    pink,
    brown,
};

/** Loudness trims so every sound sits at a similar level at the same slider position. */
export const SOUND_TRIM: Partial<Record<SoundId, number>> = {
    rain: 1.5,
    stream: 1.5,
    crickets: 1.6,
    birds: 2.8,
    dog: 0.6,
    cat: 0.7,
    tools: 1.4,
    cafe: 1.4,
    keyboard: 1.2,
};
