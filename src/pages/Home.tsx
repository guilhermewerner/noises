import { Headphones, MousePointerClick } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { Mixer } from "../components/Mixer";
import { Presets } from "../components/Presets";
import { SOUND_IDS, SOUNDS } from "../data/sounds";
import { decodeMix, encodeMix, mixer, useMixer } from "../state/mixer";

const STORAGE_KEY = "barulhinho:mix";

/** Keeps the mix in `?mix=` (shareable) and localStorage (for next visit). */
function useMixPersistence() {
    const [params, setParams] = useSearchParams();

    useEffect(() => {
        const mix = decodeMix(params.get("mix")) ?? decodeMix(localStorage.getItem(STORAGE_KEY));
        if (mix) mixer.load(mix);
        // Only on first load; afterwards the store is the source of truth.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const volumes = useMixer((s) => s.volumes);
    useEffect(() => {
        const encoded = encodeMix(volumes);
        localStorage.setItem(STORAGE_KEY, encoded);
        const timer = setTimeout(() => {
            setParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    if (encoded) next.set("mix", encoded);
                    else next.delete("mix");
                    return next;
                },
                { replace: true, preventScrollReset: true },
            );
        }, 400);
        return () => clearTimeout(timer);
    }, [volumes, setParams]);
}

export function Home() {
    useMixPersistence();
    const playing = useMixer((s) => s.playing);
    const hasMix = useMixer((s) => SOUND_IDS.some((id) => s.volumes[id] > 0));

    return (
        <>
            <section className="hero">
                <span className="badge">
                    <Headphones size={14} /> {SOUNDS.length} sons · gerados ao vivo no navegador
                </span>
                <h1>
                    Misture o barulho <span className="gradient">perfeito.</span>
                </h1>
                <p>
                    Pra dormir, focar ou só relaxar. Combina chuva com trovão, fogueira com grilos… ou um cachorro latindo no meio de uma oficina. A gente não
                    julga.
                </p>
                {hasMix && !playing && (
                    <button className="hint" onClick={() => mixer.setPlaying(true)}>
                        <MousePointerClick size={16} /> Seu mix tá pronto, clica aqui pra tocar
                    </button>
                )}
            </section>
            <Mixer />
            <Presets />
        </>
    );
}
