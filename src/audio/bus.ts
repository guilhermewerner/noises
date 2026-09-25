/** Events fired by the audio engine, consumed by the visual effects. */
export type FxEvent =
    | { type: "lightning"; intensity: number }
    | { type: "bark" }
    | { type: "bird" }
    | { type: "purr" }
    | { type: "hit"; intensity: number }
    | { type: "grind"; duration: number }
    | { type: "key"; char: string }
    | { type: "horn" }
    | { type: "pop" }
    | { type: "wave" }
    | { type: "clink" };

type Listener = (event: FxEvent) => void;

const listeners = new Set<Listener>();

export const bus = {
    emit(event: FxEvent) {
        for (const listener of listeners) listener(event);
    },
    on(listener: Listener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};
