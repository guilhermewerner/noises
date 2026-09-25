import type { CSSProperties } from "react";
import { PRESETS, type Preset } from "../data/presets";
import { SOUND_BY_ID, SOUND_IDS, type SoundId } from "../data/sounds";
import { mixer, useMixer, type Volumes } from "../state/mixer";

function matches(preset: Preset, volumes: Volumes) {
    return SOUND_IDS.every((id) => Math.abs((preset.mix[id] ?? 0) - volumes[id]) < 0.005);
}

export function Presets() {
    const volumes = useMixer((s) => s.volumes);
    const playing = useMixer((s) => s.playing);

    return (
        <section className="presets" id="presets">
            <div className="section-head">
                <h2>Mixes prontos</h2>
                <p>Sem paciência pra mixar? Escolhe um desses e ajusta do seu jeito.</p>
            </div>
            <div className="preset-grid">
                {PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const current = matches(preset, volumes);
                    return (
                        <button
                            key={preset.id}
                            className={`preset ${current ? "on" : ""}`}
                            style={{ "--g1": preset.gradient[0], "--g2": preset.gradient[1] } as CSSProperties}
                            onClick={() => mixer.load(preset.mix, true)}
                        >
                            <span className="preset-icon">
                                <Icon size={22} />
                            </span>
                            <span className="preset-name">{preset.name}</span>
                            <span className="preset-desc">{preset.description}</span>
                            <span className="preset-sounds">
                                {(Object.keys(preset.mix) as SoundId[]).map((id) => {
                                    const SoundIcon = SOUND_BY_ID[id].icon;
                                    return (
                                        <span key={id} title={SOUND_BY_ID[id].name}>
                                            <SoundIcon size={13} />
                                        </span>
                                    );
                                })}
                            </span>
                            {current && <span className="preset-badge">{playing ? "tocando" : "carregado"}</span>}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
