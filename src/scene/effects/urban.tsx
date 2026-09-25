import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { bus } from "../../audio/bus";
import { levels } from "../levels";
import { halfH, put, rand, syncScale, useParticles } from "../particles";

const SPARKS = 900;

interface Emitter {
    x: number;
    y: number;
    angle: number;
    until: number;
}

/** Hammer hits burst sparks; the grinder sprays a stream of them. */
export function Sparks() {
    const sparks = useParticles(SPARKS);
    const sim = useMemo(
        () => ({
            s: Array.from({ length: SPARKS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1 })),
            cursor: 0,
            emitters: [] as Emitter[],
            bursts: [] as { intensity: number }[],
            aspect: 1,
            debt: 0,
        }),
        [],
    );

    useEffect(
        () =>
            bus.on((event) => {
                if (event.type === "hit") sim.bursts.push({ intensity: event.intensity });
                if (event.type === "grind") {
                    const hh = halfH(0);
                    const side = Math.random() < 0.5 ? -1 : 1;
                    sim.emitters.push({
                        x: side * rand(0.6, 0.9) * hh * sim.aspect,
                        y: rand(-0.7, 0.2) * hh,
                        // Spray away from the center of the screen.
                        angle: side < 0 ? rand(0.1, 0.7) : Math.PI - rand(0.1, 0.7),
                        until: performance.now() + event.duration * 1000,
                    });
                }
            }),
        [sim],
    );

    const spawn = (x: number, y: number, angle: number, speed: number, life: number) => {
        const s = sim.s[sim.cursor];
        sim.cursor = (sim.cursor + 1) % SPARKS;
        s.x = x;
        s.y = y;
        s.vx = Math.cos(angle) * speed;
        s.vy = Math.sin(angle) * speed;
        s.max = s.life = life;
    };

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        sim.aspect = syncScale(sparks, state);
        const hh = halfH(0);
        const hw = hh * sim.aspect;
        const level = levels.tools;

        for (const burst of sim.bursts) {
            // Keep bursts in the side margins, clear of the mixer panel.
            const x = (Math.random() < 0.5 ? -1 : 1) * rand(0.55, 0.9) * hw;
            const y = rand(-0.6, 0.6) * hh;
            const count = Math.floor(30 * burst.intensity);
            for (let i = 0; i < count; i++) spawn(x, y, rand(0.1, Math.PI - 0.1) + (Math.random() < 0.2 ? Math.PI : 0), rand(2, 9), rand(0.3, 1));
        }
        sim.bursts.length = 0;

        const now = performance.now();
        sim.emitters = sim.emitters.filter((e) => e.until > now);
        for (const e of sim.emitters) {
            sim.debt += dt * 260;
            while (sim.debt >= 1) {
                sim.debt -= 1;
                spawn(e.x, e.y, e.angle + rand(-0.3, 0.3), rand(6, 13), rand(0.3, 0.9));
            }
        }

        const floor = -hh * 0.98;
        for (let i = 0; i < SPARKS; i++) {
            const s = sim.s[i];
            if (s.life <= 0) {
                put(sparks, i, 0, 0, 0, 0, 0, 0, 0, 0);
                continue;
            }
            s.life -= dt;
            s.vy -= 11 * dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            if (s.y < floor && s.vy < 0) {
                s.y = floor;
                s.vy *= -0.35;
                s.vx *= 0.6;
            }
            const f = s.life / s.max;
            const speed = Math.hypot(s.vx, s.vy);
            const len = 0.06 + speed * 0.035;
            put(sparks, i, s.x, s.y, 0, 1.6, 0.6 + f * 0.8, 0.15 + f * 0.5, f * Math.min(1, level * 2 + 0.3), len, 0.035 / len, Math.atan2(s.vy, s.vx));
        }
        sparks.commit(SPARKS);
    });

    return <primitive object={sparks.points} />;
}

const STEAM = 160;

/** Coffee steam curling up from the bottom corners. */
export function Steam() {
    const steam = useParticles(STEAM);
    const sim = useMemo(
        () => ({
            p: Array.from({ length: STEAM }, () => ({ x: 0, y: 0, z: 0, life: 0, max: 1, phase: 0, source: 0 })),
            cursor: 0,
            debt: 0,
            sources: [-0.8, -0.55, 0.6, 0.85],
        }),
        [],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const t = state.clock.elapsedTime;
        const aspect = syncScale(steam, state);
        const level = levels.cafe;
        sim.debt += dt * 34 * level;
        while (sim.debt >= 1) {
            sim.debt -= 1;
            const p = sim.p[sim.cursor];
            sim.cursor = (sim.cursor + 1) % STEAM;
            p.source = sim.sources[Math.floor(Math.random() * sim.sources.length)];
            p.z = rand(-1, 1);
            const hh = halfH(p.z);
            p.x = p.source * hh * aspect + rand(-0.2, 0.2);
            p.y = -hh * 0.95;
            p.max = p.life = rand(3, 5);
            p.phase = rand(0, 6.28);
        }

        sim.p.forEach((p, i) => {
            if (p.life <= 0) {
                put(steam, i, 0, 0, 0, 0, 0, 0, 0, 0);
                return;
            }
            p.life -= dt;
            p.y += 0.9 * dt;
            const f = p.life / p.max;
            const age = 1 - f;
            const x = p.x + Math.sin(t * 1.3 + p.phase + age * 4) * age * 0.9;
            const alpha = Math.min(1, age * 5) * f * 0.14 * Math.min(1, level * 2);
            put(steam, i, x, p.y, p.z, 1, 0.92, 0.85, alpha, 0.4 + age * 2.2);
        });
        steam.commit(STEAM);
    });

    return <primitive object={steam.points} />;
}

const DUST = 420;

/** Dust swirling in the fan's airflow. */
export function Vortex() {
    const dust = useParticles(DUST);
    const sim = useMemo(
        () =>
            Array.from({ length: DUST }, () => ({
                r: Math.sqrt(Math.random()) * 11 + 0.8,
                theta: rand(0, 6.28),
                z: rand(-6, 3),
                size: rand(0.03, 0.1),
                wobble: rand(0, 6.28),
            })),
        [],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const t = state.clock.elapsedTime;
        syncScale(dust, state);
        const level = levels.fan;
        const n = Math.ceil(DUST * level);
        sim.forEach((d, i) => {
            if (i >= n) return;
            d.theta += ((0.25 + 1.1 * level) / (0.5 + d.r * 0.18)) * dt;
            const r = d.r + Math.sin(t * 0.8 + d.wobble) * 0.2;
            const twinkle = 0.6 + 0.4 * Math.sin(t * 3 + d.wobble * 5);
            put(dust, i, Math.cos(d.theta) * r, Math.sin(d.theta) * r * 0.62, d.z, 0.75, 0.85, 1, 0.35 * twinkle * Math.min(1, level * 2), d.size);
        });
        dust.commit(n);
    });

    return <primitive object={dust.points} />;
}

const LIGHTS = 70;

/** Warm window lights streaking past, like looking out of a night train. */
export function TrainLights() {
    const lights = useParticles(LIGHTS);
    const sim = useMemo(
        () => ({
            l: Array.from({ length: LIGHTS }, () => ({
                x: rand(-1.3, 1.3),
                y: rand(-0.9, 0.9),
                z: rand(-9, 2),
                len: rand(1.2, 5),
                speed: rand(0.8, 1.3),
                warm: Math.random(),
            })),
            boost: 0,
        }),
        [],
    );

    useEffect(
        () =>
            bus.on((event) => {
                if (event.type === "horn") sim.boost = 1;
            }),
        [sim],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const aspect = syncScale(lights, state);
        sim.boost *= Math.exp(-dt * 0.7);
        const level = levels.train;
        const n = Math.ceil(LIGHTS * level);
        sim.l.forEach((l, i) => {
            if (i >= n) return;
            const hh = halfH(l.z);
            const hw = hh * aspect;
            l.x -= ((22 + sim.boost * 30) * l.speed * dt) / hw;
            if (l.x < -1.4) {
                l.x = rand(1.3, 1.8);
                l.y = rand(-0.9, 0.9);
            }
            const [r, g, b] = l.warm > 0.3 ? [1.2, 0.72, 0.35] : [0.55, 0.75, 1.1];
            put(lights, i, l.x * hw, l.y * hh, l.z, r, g, b, (0.22 + sim.boost * 0.3) * Math.min(1, level * 2), l.len * (1 + sim.boost), 0.02);
        });
        lights.commit(n);
    });

    return <primitive object={lights.points} />;
}
