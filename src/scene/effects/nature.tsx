import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { bus } from "../../audio/bus";
import { levels } from "../levels";
import { halfH, put, rand, syncScale, useParticles } from "../particles";
import { leafTexture } from "../textures";

const LEAVES = 80;
const GUSTS = 50;
const LEAF_COLORS = [
    [0.5, 0.78, 0.3],
    [0.95, 0.74, 0.22],
    [0.95, 0.48, 0.18],
    [0.72, 0.84, 0.28],
    [0.85, 0.3, 0.2],
] as const;

export function Wind() {
    const leaves = useParticles(LEAVES, "texture", { map: leafTexture(), blending: THREE.NormalBlending });
    const gusts = useParticles(GUSTS);
    const sim = useMemo(
        () => ({
            leaves: Array.from({ length: LEAVES }, () => ({
                x: rand(-1.2, 1.2),
                y: rand(-0.9, 0.9),
                z: rand(-5, 4),
                speed: rand(0.7, 1.4),
                phase: rand(0, 6.28),
                spin: rand(-4, 4),
                rot: rand(0, 6.28),
                size: rand(0.3, 0.55),
                color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
            })),
            gusts: Array.from({ length: GUSTS }, () => ({
                x: rand(-1.2, 1.2),
                y: rand(-0.9, 0.9),
                z: rand(-6, 3),
                speed: rand(0.8, 1.3),
                len: rand(1.5, 4),
            })),
        }),
        [],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const t = state.clock.elapsedTime;
        const aspect = syncScale(leaves, state);
        syncScale(gusts, state);
        const level = levels.wind;
        const gust = 0.7 + 0.3 * Math.sin(t * 0.7) * Math.sin(t * 0.23);

        const nLeaves = Math.ceil(LEAVES * level);
        sim.leaves.forEach((l, i) => {
            if (i >= nLeaves) return;
            const hh = halfH(l.z);
            const hw = hh * aspect;
            l.x += ((2 + 7 * level * gust) * l.speed * dt) / hw;
            l.y += ((Math.sin(t * 1.4 + l.phase) * 0.7 - 0.15) * dt) / hh;
            l.rot += l.spin * dt * (0.5 + level);
            if (l.x > 1.15) {
                l.x = -1.15;
                l.y = rand(-0.9, 0.9);
            }
            if (l.y < -1.1) l.y = 1.05;
            const [r, g, b] = l.color;
            put(leaves, i, l.x * hw, l.y * hh, l.z, r, g, b, 0.9, l.size, 1, l.rot);
        });
        leaves.commit(nLeaves);

        const nGusts = Math.ceil(GUSTS * level);
        sim.gusts.forEach((g, i) => {
            if (i >= nGusts) return;
            const hh = halfH(g.z);
            const hw = hh * aspect;
            g.x += ((14 + 14 * level) * g.speed * gust * dt) / hw;
            if (g.x > 1.3) {
                g.x = -1.3;
                g.y = rand(-0.9, 0.9);
            }
            const wobble = Math.sin(t * 2 + i) * 0.05;
            put(gusts, i, g.x * hw, g.y * hh, g.z, 0.8, 0.95, 1, 0.1 * level * gust, g.len, 0.012, wobble);
        });
        gusts.commit(nGusts);
    });

    return (
        <>
            <primitive object={gusts.points} />
            <primitive object={leaves.points} />
        </>
    );
}

const oceanVertex = /* glsl */ `
    uniform float uTime;
    uniform float uSwell;
    varying float vH;
    varying vec2 vUv;

    float waves(vec2 p) {
        float h = sin(p.x * 0.32 + uTime * 0.8) * 0.4;
        h += sin(p.x * 0.75 - uTime * 1.2 + p.y * 0.4) * 0.16;
        h += sin(p.y * 0.9 + uTime * 0.9 + sin(p.x * 0.2)) * 0.3;
        h += sin((p.x + p.y) * 1.7 + uTime * 2.1) * 0.05;
        return h;
    }

    void main() {
        vec3 p = position;
        float h = waves(p.xy) * (0.55 + uSwell * 0.7);
        p.z += h;
        vH = h;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

const oceanFragment = /* glsl */ `
    uniform float uTime;
    uniform float uLevel;
    varying float vH;
    varying vec2 vUv;

    void main() {
        vec3 deep = vec3(0.01, 0.07, 0.14);
        vec3 shallow = vec3(0.03, 0.35, 0.45);
        vec3 col = mix(deep, shallow, smoothstep(-0.6, 0.7, vH));
        float foam = smoothstep(0.38, 0.62, vH + 0.08 * sin(vUv.x * 90.0 + uTime * 2.5) * sin(vUv.y * 40.0));
        col += foam * vec3(0.55, 0.85, 1.0) * 0.9;
        // Moon glints.
        float glint = pow(max(0.0, sin(vUv.x * 300.0 + uTime) * sin(vUv.y * 120.0 - uTime * 1.3)), 24.0);
        col += glint * vec3(0.8, 0.9, 1.0) * smoothstep(0.2, 0.8, vUv.y) * 1.2;
        float alpha = uLevel * smoothstep(1.0, 0.8, vUv.y) * 0.95;
        gl_FragColor = vec4(col, alpha);
    }
`;

export function Ocean() {
    const mesh = useRef<THREE.Mesh>(null);
    const swell = useRef(0);
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: oceanVertex,
                fragmentShader: oceanFragment,
                transparent: true,
                depthWrite: false,
                uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uSwell: { value: 0 } },
            }),
        [],
    );

    useEffect(
        () =>
            bus.on((event) => {
                if (event.type === "wave") swell.current = 1;
            }),
        [],
    );

    useFrame((state, dt) => {
        swell.current *= Math.exp(-Math.min(dt, 0.05) * 0.5);
        material.uniforms.uTime.value = state.clock.elapsedTime;
        material.uniforms.uLevel.value = levels.ocean;
        material.uniforms.uSwell.value = swell.current * levels.ocean;
        if (mesh.current) mesh.current.visible = levels.ocean > 0.002;
    });

    return (
        <mesh ref={mesh} material={material} position={[0, -5.4, -6]} rotation={[-1.35, 0, 0]} renderOrder={-10}>
            <planeGeometry args={[70, 18, 200, 60]} />
        </mesh>
    );
}

const BUBBLES = 180;

export function Bubbles() {
    const bubbles = useParticles(BUBBLES, "ring");
    const sim = useMemo(
        () =>
            Array.from({ length: BUBBLES }, () => ({
                x: rand(-1, 1),
                y: rand(-1, 1),
                z: rand(-4, 4),
                speed: rand(0.5, 1.6),
                size: rand(0.08, 0.32),
                phase: rand(0, 6.28),
                top: rand(-0.2, 1),
            })),
        [],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const t = state.clock.elapsedTime;
        const aspect = syncScale(bubbles, state);
        const n = Math.ceil(BUBBLES * levels.stream);
        sim.forEach((b, i) => {
            if (i >= n) return;
            const hh = halfH(b.z);
            b.y += (b.speed * dt) / hh;
            if (b.y > b.top) {
                b.y = -1.1;
                b.x = rand(-1, 1);
                b.top = rand(-0.2, 1);
            }
            const x = b.x * hh * aspect + Math.sin(t * 3 + b.phase) * 0.12;
            const fade = Math.min(1, (b.top - b.y) * 6);
            put(bubbles, i, x, b.y * hh, b.z, 0.55, 0.88, 1, 0.75 * levels.stream * fade, b.size);
        });
        bubbles.commit(n);
    });

    return <primitive object={bubbles.points} />;
}

const EMBERS = 450;

const glowFragment = /* glsl */ `
    uniform float uLevel;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
        float flicker = 0.85 + 0.15 * sin(uTime * 9.0) * sin(uTime * 5.3 + vUv.x * 6.0);
        float h = pow(1.0 - vUv.y, 2.2);
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        vec3 col = mix(vec3(0.9, 0.25, 0.03), vec3(1.0, 0.6, 0.15), h);
        gl_FragColor = vec4(col * h * edge * uLevel * flicker * 0.55, 1.0);
    }
`;

export function Fire() {
    const embers = useParticles(EMBERS);
    const glow = useRef<THREE.Mesh>(null);
    const sim = useMemo(
        () => ({
            e: Array.from({ length: EMBERS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0.1, seed: rand(0, 100) })),
            cursor: 0,
            debt: 0,
            burst: 0,
        }),
        [],
    );
    const glowMaterial = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
                fragmentShader: glowFragment,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: { uLevel: { value: 0 }, uTime: { value: 0 } },
            }),
        [],
    );
    useEffect(
        () =>
            bus.on((event) => {
                if (event.type === "pop" && levels.fire > 0) sim.burst += 14;
            }),
        [sim],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const t = state.clock.elapsedTime;
        const aspect = syncScale(embers, state);
        const level = levels.fire;

        sim.debt += dt * 110 * level + sim.burst;
        sim.burst = 0;
        while (sim.debt >= 1) {
            sim.debt -= 1;
            const e = sim.e[sim.cursor];
            sim.cursor = (sim.cursor + 1) % EMBERS;
            e.z = rand(-3, 3);
            const hh = halfH(e.z);
            // Bias spawns toward the middle, like a campfire.
            e.x = (Math.random() + Math.random() - 1) * hh * aspect * 0.9;
            e.y = -hh - 0.2;
            e.vx = rand(-0.4, 0.4);
            e.vy = rand(1, 3.2);
            e.max = e.life = rand(2, 4.5);
            e.size = rand(0.05, 0.13);
        }

        for (let i = 0; i < EMBERS; i++) {
            const e = sim.e[i];
            if (e.life <= 0) {
                put(embers, i, 0, 0, 0, 0, 0, 0, 0, 0);
                continue;
            }
            e.life -= dt;
            e.vy += 0.4 * dt;
            e.vx += Math.sin(t * 2.3 + e.seed) * 1.2 * dt;
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            const f = Math.max(0, e.life / e.max);
            const r = 1;
            const g = 0.2 + 0.7 * f * f;
            const b = 0.05 + 0.35 * f * f * f;
            const flick = 0.7 + 0.3 * Math.sin(t * 20 + e.seed);
            put(embers, i, e.x, e.y, e.z, r * 1.4, g * 1.3, b, f * flick * Math.min(1, level * 2), e.size * (0.5 + f));
        }
        embers.commit(EMBERS);

        glowMaterial.uniforms.uLevel.value = level;
        glowMaterial.uniforms.uTime.value = t;
        if (glow.current) {
            glow.current.visible = level > 0.002;
            const hh = halfH(-1);
            glow.current.scale.set(hh * aspect * 2.2, 5, 1);
            glow.current.position.set(0, -hh + 2.2, -1);
        }
    });

    return (
        <>
            <mesh ref={glow} material={glowMaterial}>
                <planeGeometry args={[1, 1]} />
            </mesh>
            <primitive object={embers.points} />
        </>
    );
}

const FLIES = 70;

export function Fireflies() {
    const flies = useParticles(FLIES);
    const sim = useMemo(
        () =>
            Array.from({ length: FLIES }, () => ({
                x: rand(-0.95, 0.95),
                y: rand(-0.9, 0.5),
                z: rand(-5, 4),
                a: rand(0.2, 0.6),
                b: rand(0.2, 0.6),
                phase: rand(0, 6.28),
                blink: rand(0.6, 1.6),
            })),
        [],
    );

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        const aspect = syncScale(flies, state);
        const level = levels.crickets;
        const n = Math.ceil(FLIES * level);
        sim.forEach((f, i) => {
            if (i >= n) return;
            const hh = halfH(f.z);
            const x = f.x * hh * aspect + Math.sin(t * f.a + f.phase) * 1.4 + Math.sin(t * f.b * 2.3) * 0.3;
            const y = f.y * hh + Math.cos(t * f.b + f.phase * 1.3) * 0.8;
            const on = Math.pow(Math.max(0, Math.sin(t * f.blink + f.phase)), 5);
            put(flies, i, x, y, f.z, 0.8, 1.25, 0.35, on * Math.min(1, level * 1.6), 0.13 + on * 0.1);
        });
        flies.commit(n);
    });

    return <primitive object={flies.points} />;
}
