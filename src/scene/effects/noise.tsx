import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { SoundId } from "../../data/sounds";
import { levels } from "../levels";
import { halfH, put, rand, syncScale, useParticles } from "../particles";

interface GrainProps {
    id: Extract<SoundId, "white" | "pink" | "brown">;
}

/**
 * Each noise color gets its own "grain": white is fine fast TV static,
 * pink is softer and slower, brown drifts as big warm blobs.
 */
const PRESETS = {
    white: { count: 1600, size: [0.025, 0.06], refresh: 1, drift: 0, color: [0.95, 0.97, 1], alpha: 0.5, blending: THREE.AdditiveBlending },
    pink: { count: 900, size: [0.05, 0.13], refresh: 0.18, drift: 0.3, color: [1.1, 0.55, 0.8], alpha: 0.45, blending: THREE.AdditiveBlending },
    brown: { count: 120, size: [1.5, 3.8], refresh: 0, drift: 0.25, color: [0.55, 0.32, 0.16], alpha: 0.16, blending: THREE.AdditiveBlending },
} as const;

export function Grain({ id }: GrainProps) {
    const cfg = PRESETS[id];
    const grain = useParticles(cfg.count, "soft", { blending: cfg.blending });
    const sim = useMemo(
        () =>
            Array.from({ length: cfg.count }, () => ({
                x: rand(-1.1, 1.1),
                y: rand(-1.1, 1.1),
                z: rand(-6, 4),
                size: rand(cfg.size[0], cfg.size[1]),
                phase: rand(0, 6.28),
                a: Math.random(),
            })),
        [cfg],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const t = state.clock.elapsedTime;
        const aspect = syncScale(grain, state);
        const level = levels[id];
        const n = Math.ceil(cfg.count * Math.min(1, level * 1.4));
        // Reacts to the actual output loudness.
        const pulse = 0.55 + levels.audio * 0.9;
        const [r, g, b] = cfg.color;

        sim.forEach((p, i) => {
            if (i >= n) return;
            if (Math.random() < cfg.refresh) {
                p.x = rand(-1.1, 1.1);
                p.y = rand(-1.1, 1.1);
                p.a = Math.random();
            }
            p.x += Math.sin(t * 0.3 + p.phase) * cfg.drift * dt * 0.05;
            p.y += Math.cos(t * 0.25 + p.phase) * cfg.drift * dt * 0.05;
            const hh = halfH(p.z);
            const flicker = id === "brown" ? 0.7 + 0.3 * Math.sin(t * 0.5 + p.phase) : p.a;
            put(grain, i, p.x * hh * aspect, p.y * hh, p.z, r, g, b, cfg.alpha * flicker * pulse * Math.min(1, level * 2), p.size);
        });
        grain.commit(n);
    });

    return <primitive object={grain.points} />;
}
