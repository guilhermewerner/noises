import { bus, type FxEvent } from "./bus";
import { makeImpulse, makeNoiseBuffer, type NoiseColor } from "./buffers";
import { SOUND_FACTORIES, SOUND_TRIM } from "./sounds";
import type { SoundId } from "../data/sounds";

/** How far ahead (seconds) event-based sounds are scheduled. Covers background-tab timer throttling. */
const LOOKAHEAD = 1.2;
const TICK_MS = 100;

type ScheduleFn = (from: number, to: number) => void;

/** Everything a sound factory needs to build its graph. */
export interface Voice {
    ctx: AudioContext;
    /** Dry output of the sound. */
    out: AudioNode;
    /** Send into the shared reverb. */
    reverb: AudioNode;
    noise(color: NoiseColor): AudioBuffer;
    /** Registers a callback that fills the [from, to) time window with events. */
    schedule(fn: ScheduleFn): void;
    /** Starts a continuous node now and stops it when the sound is removed. */
    keep<T extends AudioScheduledSourceNode>(node: T): T;
    /** Fires a visual event when the audio clock reaches `time`. */
    emitAt(time: number, event: FxEvent): void;
}

export type SoundFactory = (voice: Voice) => void;

interface Channel {
    /** Dry and reverb-send faders, always automated together. */
    faders: GainNode[];
    schedulers: ScheduleFn[];
    sources: AudioScheduledSourceNode[];
    timers: Set<number>;
    scheduledUntil: number;
}

function rampTo(param: AudioParam, value: number, now: number, seconds: number) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
}

class AudioEngine {
    ctx: AudioContext | null = null;
    analyser: AnalyserNode | null = null;
    private master: GainNode | null = null;
    private reverbIn: GainNode | null = null;
    private buffers = new Map<NoiseColor, AudioBuffer>();
    private channels = new Map<SoundId, Channel>();

    /** Creates the audio graph. Must be called from a user gesture the first time. */
    ensure(): AudioContext {
        if (this.ctx) return this.ctx;

        const ctx = new AudioContext({ latencyHint: "playback" });
        const master = ctx.createGain();
        master.gain.value = 0;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.25;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;

        const reverbIn = ctx.createGain();
        const convolver = ctx.createConvolver();
        convolver.buffer = makeImpulse(ctx);
        const reverbOut = ctx.createGain();
        reverbOut.gain.value = 0.5;
        reverbIn.connect(convolver).connect(reverbOut).connect(master);

        master.connect(compressor).connect(analyser).connect(ctx.destination);

        this.ctx = ctx;
        this.master = master;
        this.analyser = analyser;
        this.reverbIn = reverbIn;
        window.setInterval(() => this.runSchedulers(), TICK_MS);
        return ctx;
    }

    get running() {
        return this.ctx?.state === "running";
    }

    async play(masterVolume: number) {
        const ctx = this.ensure();
        if (ctx.state !== "running") await ctx.resume();
        this.setMaster(masterVolume, 0.6);
    }

    /** Fades out, then suspends the context so nothing keeps scheduling. */
    async pause(fadeSeconds = 0.35) {
        const ctx = this.ctx;
        const master = this.master;
        if (!ctx || !master || ctx.state !== "running") return;
        rampTo(master.gain, 0, ctx.currentTime, fadeSeconds);
        await new Promise((resolve) => setTimeout(resolve, fadeSeconds * 1000 + 50));
        if (ctx.state === "running" && master.gain.value < 0.001) await ctx.suspend();
    }

    setMaster(volume: number, seconds = 0.08) {
        if (!this.ctx || !this.master) return;
        rampTo(this.master.gain, volume * volume, this.ctx.currentTime, seconds);
    }

    setVolume(id: SoundId, volume: number) {
        const ctx = this.ctx;
        if (!ctx) return;
        let channel = this.channels.get(id);

        if (volume <= 0) {
            if (channel) this.destroy(id, channel);
            return;
        }

        if (!channel) channel = this.create(id);
        // Squared for a more natural-feeling slider.
        const gain = volume * volume * (SOUND_TRIM[id] ?? 1);
        for (const fader of channel.faders) rampTo(fader.gain, gain, ctx.currentTime, 0.25);
    }

    /** Current RMS output level. */
    level(buffer: Float32Array<ArrayBuffer>): number {
        if (!this.analyser || !this.running) return 0;
        this.analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        return Math.sqrt(sum / buffer.length);
    }

    private noise(color: NoiseColor) {
        let buffer = this.buffers.get(color);
        if (!buffer) {
            buffer = makeNoiseBuffer(this.ctx!, color);
            this.buffers.set(color, buffer);
        }
        return buffer;
    }

    private create(id: SoundId): Channel {
        const ctx = this.ctx!;
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        dry.gain.value = 0;
        wet.gain.value = 0;
        dry.connect(this.master!);
        wet.connect(this.reverbIn!);

        const channel: Channel = {
            faders: [dry, wet],
            schedulers: [],
            sources: [],
            timers: new Set(),
            scheduledUntil: ctx.currentTime + 0.05,
        };

        const voice: Voice = {
            ctx,
            out: dry,
            reverb: wet,
            noise: (color) => this.noise(color),
            schedule: (fn) => channel.schedulers.push(fn),
            keep: (node) => {
                node.start();
                channel.sources.push(node);
                return node;
            },
            emitAt: (time, event) => {
                const delay = Math.max(0, (time - ctx.currentTime) * 1000);
                const timer = window.setTimeout(() => {
                    channel.timers.delete(timer);
                    bus.emit(event);
                }, delay);
                channel.timers.add(timer);
            },
        };

        SOUND_FACTORIES[id](voice);
        this.channels.set(id, channel);
        this.fill(channel);
        return channel;
    }

    private destroy(id: SoundId, channel: Channel) {
        const ctx = this.ctx!;
        this.channels.delete(id);
        for (const fader of channel.faders) rampTo(fader.gain, 0, ctx.currentTime, 0.2);
        for (const timer of channel.timers) clearTimeout(timer);
        channel.schedulers.length = 0;

        setTimeout(() => {
            for (const source of channel.sources) {
                try {
                    source.stop();
                } catch {
                    // Already stopped.
                }
            }
            // Let reverb tails ring out before cutting the send.
            setTimeout(() => channel.faders.forEach((fader) => fader.disconnect()), 3000);
        }, 300);
    }

    private runSchedulers() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== "running") return;
        for (const channel of this.channels.values()) this.fill(channel);
    }

    private fill(channel: Channel) {
        const ctx = this.ctx!;
        const to = ctx.currentTime + LOOKAHEAD;
        // If we fell far behind (e.g. a frozen tab), skip ahead instead of firing a burst.
        const from = Math.max(channel.scheduledUntil, ctx.currentTime);
        if (to <= from) return;
        for (const fn of channel.schedulers) fn(from, to);
        channel.scheduledUntil = to;
    }
}

export const engine = new AudioEngine();
