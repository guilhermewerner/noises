export type NoiseColor = "white" | "pink" | "brown";

/** Stereo noise buffer that loops seamlessly (the tail is crossfaded into the head). */
export function makeNoiseBuffer(ctx: BaseAudioContext, color: NoiseColor, seconds = 8): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const fade = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
        const raw = generate(color, length + fade);
        const out = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) out[i] = raw[i];
        for (let i = 0; i < fade; i++) {
            const t = i / fade;
            out[i] = raw[i] * t + raw[length + i] * (1 - t);
        }
    }

    return buffer;
}

function generate(color: NoiseColor, length: number): Float32Array {
    const data = new Float32Array(length);

    if (color === "white") {
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    } else if (color === "pink") {
        // Paul Kellet's refined pink noise filter.
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + w * 0.0555179;
            b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856;
            b4 = 0.55 * b4 + w * 0.5329522;
            b5 = -0.7616 * b5 - w * 0.016898;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
        }
    } else {
        let last = 0;
        for (let i = 0; i < length; i++) {
            const w = Math.random() * 2 - 1;
            last = (last + 0.02 * w) / 1.02;
            data[i] = last * 3.5;
        }
    }

    return data;
}

/** Synthetic room impulse response: decaying stereo noise. */
export function makeImpulse(ctx: BaseAudioContext, seconds = 2.8, decay = 3): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return buffer;
}
