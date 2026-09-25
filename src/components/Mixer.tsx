import { Eraser, Shuffle } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, SOUNDS, SOUND_IDS, type Category } from "../data/sounds";
import { mixer, useMixer } from "../state/mixer";
import { SoundCard } from "./SoundCard";

export function Mixer() {
    const [category, setCategory] = useState<Category | "all">("all");
    const activeCount = useMixer((s) => SOUND_IDS.filter((id) => s.volumes[id] > 0).length);
    const visible = category === "all" ? SOUNDS : SOUNDS.filter((s) => s.category === category);

    return (
        <section className="panel" id="mixer">
            <div className="panel-head">
                <div className="chips" role="tablist" aria-label="Categorias">
                    {CATEGORIES.map((c) => (
                        <button key={c.id} role="tab" aria-selected={category === c.id} className={`chip ${category === c.id ? "on" : ""}`} onClick={() => setCategory(c.id)}>
                            {c.label}
                        </button>
                    ))}
                </div>
                <div className="panel-actions">
                    <span className="status">
                        <b>{activeCount}</b> {activeCount === 1 ? "som ligado" : "sons ligados"}
                    </span>
                    <button className="ghost" onClick={() => mixer.randomize()} title="Mix aleatório (R)">
                        <Shuffle size={16} /> Surpreenda-me
                    </button>
                    <button className="ghost" onClick={() => mixer.clear()} disabled={!activeCount} title="Silenciar tudo (Esc)">
                        <Eraser size={16} /> Limpar
                    </button>
                </div>
            </div>

            <div className="grid">
                {visible.map((sound) => (
                    <SoundCard key={sound.id} sound={sound} />
                ))}
            </div>
        </section>
    );
}
