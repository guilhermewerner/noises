import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { levels } from "../levels";

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.999, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform vec3 uTop;
    uniform vec3 uBottom;
    uniform vec3 uGlow;
    uniform float uGlowAmount;
    uniform float uFlash;
    uniform float uStars;
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
        vec2 p = vec2(vUv.x * uAspect, vUv.y);
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));

        // Slow aurora-like blobs so the sky never feels static.
        float b1 = smoothstep(0.9, 0.0, length(p - vec2(uAspect * (0.22 + 0.08 * sin(uTime * 0.05)), 0.78)));
        float b2 = smoothstep(0.9, 0.0, length(p - vec2(uAspect * (0.82 + 0.06 * cos(uTime * 0.04)), 0.4)));
        col += vec3(0.22, 0.1, 0.42) * b1 * 0.3 + vec3(0.04, 0.22, 0.32) * b2 * 0.22;

        col += uGlow * uGlowAmount * pow(1.0 - vUv.y, 2.4);

        vec2 cell = floor(p * 80.0);
        float h = hash(cell);
        float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + h * 3.0) + h * 40.0);
        vec2 f = fract(p * 80.0) - 0.5 + (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.5;
        float star = step(0.991, h) * twinkle * smoothstep(0.2, 0.0, length(f));
        col += star * uStars * smoothstep(0.25, 0.75, vUv.y);

        col += vec3(0.5, 0.55, 0.85) * uFlash * 0.55;
        gl_FragColor = vec4(col, 1.0);
    }
`;

const v3 = (r: number, g: number, b: number) => new THREE.Vector3(r, g, b);

/** Sky palettes blended by "mood" weights derived from the active sounds. */
const MOODS = {
    base: { top: v3(0.02, 0.025, 0.07), bottom: v3(0.06, 0.07, 0.16) },
    storm: { top: v3(0.02, 0.025, 0.035), bottom: v3(0.09, 0.1, 0.13) },
    sea: { top: v3(0.01, 0.04, 0.08), bottom: v3(0.02, 0.16, 0.2) },
    dawn: { top: v3(0.1, 0.08, 0.24), bottom: v3(0.36, 0.16, 0.24) },
    work: { top: v3(0.03, 0.03, 0.05), bottom: v3(0.1, 0.08, 0.07) },
};

export function Backdrop() {
    const size = useThree((s) => s.size);
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader,
                fragmentShader,
                depthTest: false,
                depthWrite: false,
                uniforms: {
                    uTop: { value: MOODS.base.top.clone() },
                    uBottom: { value: MOODS.base.bottom.clone() },
                    uGlow: { value: v3(0.55, 0.2, 0.05) },
                    uGlowAmount: { value: 0 },
                    uFlash: { value: 0 },
                    uStars: { value: 1 },
                    uTime: { value: 0 },
                    uAspect: { value: 1 },
                },
            }),
        [],
    );

    const top = useMemo(() => new THREE.Vector3(), []);
    const bottom = useMemo(() => new THREE.Vector3(), []);

    useFrame((state, dt) => {
        const u = material.uniforms;
        u.uTime.value = state.clock.elapsedTime;
        u.uAspect.value = size.width / size.height;
        u.uFlash.value = levels.flash;

        const storm = Math.min(1, Math.max(levels.rain * 0.8, levels.thunder));
        const sea = Math.min(1, levels.ocean + levels.stream * 0.5);
        const dawn = levels.birds * 0.8;
        const work = Math.min(1, levels.tools + levels.train * 0.6 + levels.keyboard * 0.4);

        top.copy(MOODS.base.top);
        bottom.copy(MOODS.base.bottom);
        for (const [mood, w] of [
            ["sea", sea],
            ["dawn", dawn],
            ["work", work],
            ["storm", storm],
        ] as const) {
            top.lerp(MOODS[mood].top, w * 0.85);
            bottom.lerp(MOODS[mood].bottom, w * 0.85);
        }
        const k = 1 - Math.exp(-dt * 2);
        u.uTop.value.lerp(top, k);
        u.uBottom.value.lerp(bottom, k);

        const warm = Math.min(1, levels.fire + levels.cafe * 0.5 + levels.cat * 0.4);
        u.uGlowAmount.value += (warm * (0.8 + 0.2 * Math.sin(state.clock.elapsedTime * 7)) - u.uGlowAmount.value) * k;
        u.uStars.value += (1 - storm * 0.9 - dawn * 0.5 - (levels.white + levels.pink) * 0.3 - u.uStars.value) * k;
    });

    return (
        <mesh frustumCulled={false} renderOrder={-1000} material={material}>
            <planeGeometry args={[2, 2]} />
        </mesh>
    );
}
