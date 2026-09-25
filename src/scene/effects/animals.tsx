import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { bus } from "../../audio/bus";
import { levels } from "../levels";
import { halfH, put, rand, syncScale, useParticles } from "../particles";
import { heartTexture, pawTexture } from "../textures";

const BIRDS = 16;

/** Little "V" birds flapping across the sky. Geometry is rebuilt every frame (it's tiny). */
export function Birds() {
    const { geometry, material, mesh, sim } = useMemo(() => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BIRDS * 4 * 3 * 3), 3).setUsage(THREE.DynamicDrawUsage));
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setRGB(0.88, 0.9, 0.98, THREE.LinearSRGBColorSpace),
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        const sim = Array.from({ length: BIRDS }, () => ({
            x: rand(-1.2, 1.2),
            y: rand(0.05, 0.8),
            z: rand(-8, 2),
            speed: rand(1.2, 2.6),
            phase: rand(0, 6.28),
            flap: rand(7, 11),
            size: rand(0.35, 0.6),
        }));
        return { geometry, material, mesh, sim };
    }, []);

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const t = state.clock.elapsedTime;
        const aspect = state.size.width / state.size.height;
        const level = levels.birds;
        const n = Math.ceil(BIRDS * level);
        const pos = geometry.attributes.position.array as Float32Array;
        let k = 0;
        const v = (x: number, y: number, z: number) => {
            pos[k++] = x;
            pos[k++] = y;
            pos[k++] = z;
        };

        for (let i = 0; i < n; i++) {
            const b = sim[i];
            const hh = halfH(b.z);
            const hw = hh * aspect;
            b.x += (b.speed * dt) / hw;
            if (b.x > 1.25) {
                b.x = -1.25;
                b.y = rand(0.05, 0.8);
            }
            const x = b.x * hw;
            const y = b.y * hh + Math.sin(t * 0.6 + b.phase) * 0.5;
            const s = b.size;
            const lift = Math.sin(t * b.flap + b.phase) * 0.28 * s;
            const bend = Math.cos(t * b.flap + b.phase) * 0.06 * s;
            // Each wing is two triangles: inner (shoulder → elbow) and outer (elbow → tip).
            for (const side of [-1, 1]) {
                const ex = x + side * 0.26 * s;
                const ey = y + lift * 0.5 + 0.05 * s;
                const tx = x + side * 0.55 * s;
                const ty = y + lift + bend;
                v(x, y, b.z);
                v(ex, ey, b.z);
                v(x, y - 0.06 * s, b.z);
                v(ex, ey, b.z);
                v(tx, ty, b.z);
                v(ex - side * 0.05 * s, ey - 0.05 * s, b.z);
            }
        }
        geometry.setDrawRange(0, k / 3);
        geometry.attributes.position.needsUpdate = true;
        material.opacity = 0.85 * Math.min(1, level * 2);
        mesh.visible = n > 0;
    });

    return <primitive object={mesh} />;
}

const PAWS = 28;

/** Paw prints that walk across the bottom of the screen, one per bark. */
export function Paws() {
    const paws = useParticles(PAWS, "texture", { map: pawTexture(), blending: THREE.NormalBlending });
    const sim = useMemo(
        () => ({
            prints: Array.from({ length: PAWS }, () => ({ x: 0, y: 0, age: 99, angle: 0 })),
            cursor: 0,
            step: 0,
            walkX: -1,
            walkY: 0.35,
            dir: 1,
            aspect: 1,
        }),
        [],
    );

    useEffect(
        () =>
            bus.on((event) => {
                if (event.type !== "bark") return;
                const hh = halfH(0);
                const hw = hh * sim.aspect;
                sim.walkX += (0.95 / hw) * sim.dir;
                // Turn around at the edges and wander up/down a bit.
                if (sim.walkX > 0.95 || sim.walkX < -0.95) {
                    sim.dir *= -1;
                    sim.walkY = rand(0.15, 0.6);
                }
                sim.step++;
                const p = sim.prints[sim.cursor];
                sim.cursor = (sim.cursor + 1) % PAWS;
                p.x = sim.walkX * hw;
                p.y = sim.walkY * hh + (sim.step % 2 ? 0.28 : -0.28);
                p.angle = (-Math.PI / 2) * sim.dir + rand(-0.15, 0.15);
                p.age = 0;
            }),
        [sim],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        sim.aspect = syncScale(paws, state);
        const level = levels.dog;
        sim.prints.forEach((p, i) => {
            p.age += dt;
            const alpha = Math.max(0, 1 - p.age / 8) * Math.min(1, level * 2);
            const pop = 1 + 0.5 * Math.exp(-p.age * 10);
            put(paws, i, p.x, p.y, 0, 1, 0.78, 0.45, alpha, 0.75 * pop, 1, p.angle);
        });
        paws.commit(PAWS);
    });

    return <primitive object={paws.points} />;
}

const HEARTS = 50;

export function Hearts() {
    const hearts = useParticles(HEARTS, "texture", { map: heartTexture() });
    const sim = useMemo(
        () => ({
            h: Array.from({ length: HEARTS }, () => ({ x: 0, y: 0, z: 0, life: 0, max: 1, phase: 0, size: 0.4 })),
            cursor: 0,
            pending: 0,
            debt: 0,
        }),
        [],
    );

    useEffect(
        () =>
            bus.on((event) => {
                if (event.type === "purr") sim.pending += Math.floor(rand(1, 4));
            }),
        [sim],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const t = state.clock.elapsedTime;
        const aspect = syncScale(hearts, state);
        const level = levels.cat;
        sim.debt += dt * 0.5 * level;
        const spawn = sim.pending + Math.floor(sim.debt);
        sim.debt -= Math.floor(sim.debt);
        sim.pending = 0;

        for (let s = 0; s < spawn; s++) {
            const h = sim.h[sim.cursor];
            sim.cursor = (sim.cursor + 1) % HEARTS;
            h.z = rand(-3, 3);
            const hh = halfH(h.z);
            h.x = rand(-0.95, 0.95) * hh * aspect;
            h.y = rand(-1, -0.4) * hh;
            h.max = h.life = rand(4, 7);
            h.phase = rand(0, 6.28);
            h.size = rand(0.3, 0.7);
        }

        sim.h.forEach((h, i) => {
            if (h.life <= 0) {
                put(hearts, i, 0, 0, 0, 0, 0, 0, 0, 0);
                return;
            }
            h.life -= dt;
            h.y += 0.6 * dt;
            const f = h.life / h.max;
            const alpha = Math.min(1, (1 - f) * 6) * f * Math.min(1, level * 2);
            const beat = 1 + 0.12 * Math.max(0, Math.sin(t * 7 + h.phase));
            put(hearts, i, h.x + Math.sin(t * 1.5 + h.phase) * 0.3, h.y, h.z, 1.3, 0.4, 0.75, alpha, h.size * beat, 1, Math.sin(t * 1.2 + h.phase) * 0.3);
        });
        hearts.commit(HEARTS);
    });

    return <primitive object={hearts.points} />;
}
