import { useSyncExternalStore } from "react";
import { engine } from "../audio/engine";
import { SOUND_IDS, type SoundId } from "../data/sounds";

export type Volumes = Record<SoundId, number>;

export interface MixerState {
    volumes: Volumes;
    master: number;
    playing: boolean;
    /** Epoch ms when the sleep timer fades everything out. */
    timerEnd: number | null;
}

const silent = () => Object.fromEntries(SOUND_IDS.map((id) => [id, 0])) as Volumes;

let state: MixerState = { volumes: silent(), master: 0.8, playing: false, timerEnd: null };
const listeners = new Set<() => void>();

function set(patch: Partial<MixerState>) {
    const prev = state;
    state = { ...state, ...patch };
    syncEngine(prev, state);
    for (const listener of listeners) listener();
}

/** Pushes store changes into the audio graph. */
function syncEngine(prev: MixerState, next: MixerState) {
    if (next.playing) {
        if (!prev.playing) void engine.play(next.master);
        else if (prev.master !== next.master) engine.setMaster(next.master);
        for (const id of SOUND_IDS) {
            if (!prev.playing || prev.volumes[id] !== next.volumes[id]) engine.setVolume(id, next.volumes[id]);
        }
    } else if (prev.playing) {
        void engine.pause();
    }
}

export const mixer = {
    get: () => state,
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },

    setVolume(id: SoundId, volume: number) {
        const volumes = { ...state.volumes, [id]: volume };
        // Touching a slider while paused starts playback: it's the obvious intent.
        set({ volumes, playing: state.playing || volume > 0 });
    },

    toggle(id: SoundId) {
        mixer.setVolume(id, state.volumes[id] > 0 ? 0 : 0.5);
    },

    /** Replaces the whole mix. Does not start playback unless `play` is set. */
    load(mix: Partial<Volumes>, play = false) {
        set({ volumes: { ...silent(), ...mix }, playing: play || state.playing });
    },

    clear() {
        set({ volumes: silent() });
    },

    randomize() {
        const ids = [...SOUND_IDS].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3));
        const mix: Partial<Volumes> = {};
        for (const id of ids) mix[id] = Math.round((0.25 + Math.random() * 0.6) * 100) / 100;
        mixer.load(mix, true);
    },

    setMaster(master: number) {
        set({ master });
    },

    setPlaying(playing: boolean) {
        if (playing === state.playing) return;
        if (playing && !SOUND_IDS.some((id) => state.volumes[id] > 0)) {
            // Nothing selected: give them some rain instead of silence.
            set({ playing, volumes: { ...state.volumes, rain: 0.5 } });
            return;
        }
        set({ playing, timerEnd: playing ? state.timerEnd : null });
    },

    setTimer(minutes: number | null) {
        set({ timerEnd: minutes ? Date.now() + minutes * 60_000 : null });
    },

    /** Called when the sleep timer runs out: slow fade, then pause. */
    async expireTimer() {
        state = { ...state, timerEnd: null };
        await engine.pause(8);
        set({ playing: false });
    },
};

export function useMixer<T>(selector: (state: MixerState) => T): T {
    return useSyncExternalStore(mixer.subscribe, () => selector(state));
}

// ---------------------------------------------------------------------------
// Serialization, e.g. "rain.60-thunder.35"
// ---------------------------------------------------------------------------

export function encodeMix(volumes: Volumes): string {
    return SOUND_IDS.filter((id) => volumes[id] > 0)
        .map((id) => `${id}.${Math.round(volumes[id] * 100)}`)
        .join("-");
}

export function decodeMix(value: string | null): Partial<Volumes> | null {
    if (!value) return null;
    const mix: Partial<Volumes> = {};
    for (const part of value.split("-")) {
        const [id, amount] = part.split(".");
        const volume = Number(amount) / 100;
        if ((SOUND_IDS as string[]).includes(id) && volume > 0 && volume <= 1) mix[id as SoundId] = volume;
    }
    return Object.keys(mix).length ? mix : null;
}
