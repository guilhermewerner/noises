import { engine } from "../audio/engine";
import { SOUND_IDS, type SoundId } from "../data/sounds";
import { mixer } from "../state/mixer";

/**
 * Per-frame smoothed intensities shared by all effects. Each value eases toward
 * the slider volume while playing, and toward zero while paused.
 */
export const levels: Record<SoundId, number> & { audio: number; flash: number } = Object.assign(
    Object.fromEntries(SOUND_IDS.map((id) => [id, 0])) as Record<SoundId, number>,
    { audio: 0, flash: 0 },
);

const buffer = new Float32Array(512);

export function updateLevels(dt: number) {
    const { volumes, playing } = mixer.get();
    const k = 1 - Math.exp(-dt * 2.5);
    for (const id of SOUND_IDS) {
        const target = playing ? volumes[id] : 0;
        levels[id] += (target - levels[id]) * k;
        if (levels[id] < 0.002 && target === 0) levels[id] = 0;
    }
    const rms = engine.level(buffer);
    levels.audio += (Math.min(1, rms * 4) - levels.audio) * (1 - Math.exp(-dt * 10));
    levels.flash *= Math.exp(-dt * 7);
}
