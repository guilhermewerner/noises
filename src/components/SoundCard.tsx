import type { CSSProperties } from "react";
import type { SoundMeta } from "../data/sounds";
import { mixer, useMixer } from "../state/mixer";

export function SoundCard({ sound }: { sound: SoundMeta }) {
    const volume = useMixer((s) => s.volumes[sound.id]);
    const playing = useMixer((s) => s.playing);
    const active = volume > 0;
    const Icon = sound.icon;
    const percent = Math.round(volume * 100);

    return (
        <div className={`card ${active ? "on" : ""} ${active && playing ? "live" : ""}`} style={{ "--c": sound.color, "--fill": `${percent}%` } as CSSProperties}>
            <button className="card-head" onClick={() => mixer.toggle(sound.id)} aria-pressed={active} title={active ? `Desligar ${sound.name}` : `Ligar ${sound.name}`}>
                <span className="card-icon">
                    <Icon size={22} strokeWidth={2.2} />
                </span>
                <span className="card-text">
                    <span className="card-title">{sound.name}</span>
                    <span className="card-hint">{sound.hint}</span>
                </span>
                <span className="eq" aria-hidden>
                    <i />
                    <i />
                    <i />
                </span>
            </button>
            <div className="card-slider">
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={percent}
                    onChange={(e) => mixer.setVolume(sound.id, Number(e.target.value) / 100)}
                    aria-label={`Volume de ${sound.name}`}
                />
                <span className="card-value">{percent}</span>
            </div>
        </div>
    );
}
