import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useRef, type ComponentType } from "react";
import { SOUND_IDS, type SoundId } from "../data/sounds";
import { useMixer } from "../state/mixer";
import { Birds, Hearts, Paws } from "./effects/animals";
import { Backdrop } from "./effects/Backdrop";
import { Bubbles, Fire, Fireflies, Ocean, Wind } from "./effects/nature";
import { Grain } from "./effects/noise";
import { Popups } from "./effects/Popups";
import { Sparks, Steam, TrainLights, Vortex } from "./effects/urban";
import { Clouds, Lightning, Rain } from "./effects/weather";
import { updateLevels } from "./levels";
import { CAMERA_Z, FOV } from "./particles";

const WhiteGrain = () => <Grain id="white" />;
const PinkGrain = () => <Grain id="pink" />;
const BrownGrain = () => <Grain id="brown" />;

/** Keyboard only needs popups (falling letters), which are always mounted. */
const EFFECTS: Partial<Record<SoundId, ComponentType>> = {
    rain: Rain,
    thunder: Lightning,
    wind: Wind,
    ocean: Ocean,
    stream: Bubbles,
    fire: Fire,
    crickets: Fireflies,
    birds: Birds,
    dog: Paws,
    cat: Hearts,
    tools: Sparks,
    cafe: Steam,
    fan: Vortex,
    train: TrainLights,
    white: WhiteGrain,
    pink: PinkGrain,
    brown: BrownGrain,
};

function LevelDriver() {
    useFrame((_, dt) => updateLevels(Math.min(dt, 0.1)), -1);
    return null;
}

/**
 * Effects mount the first time their sound is turned on and then stay mounted,
 * fading with the (smoothed) volume, so toggling never reallocates buffers.
 */
function useEverActive() {
    const active = useMixer((s) => SOUND_IDS.filter((id) => s.volumes[id] > 0).join(","));
    const seen = useRef(new Set<SoundId>());
    for (const id of active.split(",")) if (id) seen.current.add(id as SoundId);
    return seen.current;
}

function Effects() {
    const seen = useEverActive();
    return (
        <>
            {(seen.has("rain") || seen.has("thunder")) && <Clouds />}
            {SOUND_IDS.map((id) => {
                const Effect = EFFECTS[id];
                return Effect && seen.has(id) ? <Effect key={id} /> : null;
            })}
        </>
    );
}

export default function Scene() {
    return (
        <div className="scene" aria-hidden>
            <Canvas
                linear
                flat
                dpr={[1, 1.5]}
                camera={{ position: [0, 0, CAMERA_Z], fov: FOV, near: 0.1, far: 100 }}
                gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
            >
                <LevelDriver />
                <Backdrop />
                <Effects />
                <Popups />
                <EffectComposer multisampling={0}>
                    <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.45} luminanceSmoothing={0.25} radius={0.7} />
                </EffectComposer>
            </Canvas>
        </div>
    );
}
