import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { bus } from "../../audio/bus";
import { levels } from "../levels";
import { halfH, put, rand, syncScale, useParticles } from "../particles";

const DROPS = 1500;
const SPLASHES = 220;

export function Rain() {
    const drops = useParticles(DROPS);
    const splashes = useParticles(SPLASHES, "ring");
    const sim = useMemo(() => {
        const s = {
            x: new Float32Array(DROPS),
            y: new Float32Array(DROPS),
            z: new Float32Array(DROPS),
            speed: new Float32Array(DROPS),
            len: new Float32Array(DROPS),
            splash: Array.from({ length: SPLASHES }, () => ({ x: 0, y: 0, z: 0, life: 0 })),
            cursor: 0,
        };
        for (let i = 0; i < DROPS; i++) {
            s.z[i] = rand(-6, 5);
            s.x[i] = rand(-1, 1) * halfH(s.z[i]) * 2.2;
            s.y[i] = rand(-1, 1.3) * halfH(s.z[i]);
            s.speed[i] = rand(13, 22);
            s.len[i] = rand(0.45, 0.9);
        }
        return s;
    }, []);

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const aspect = syncScale(drops, state);
        syncScale(splashes, state);
        const level = levels.rain;
        const n = Math.floor(DROPS * Math.min(1, level * 1.15));
        const slant = -(1.5 + levels.wind * 9);
        const alpha = 0.16 + level * 0.3;

        for (let i = 0; i < n; i++) {
            const z = sim.z[i];
            const hh = halfH(z);
            const vx = slant * (sim.speed[i] / 18);
            const vy = -sim.speed[i];
            sim.x[i] += vx * dt;
            sim.y[i] += vy * dt;
            if (sim.y[i] < -hh) {
                if (Math.random() < 0.18) {
                    const sp = sim.splash[sim.cursor];
                    sim.cursor = (sim.cursor + 1) % SPLASHES;
                    sp.x = sim.x[i];
                    sp.y = -hh * 0.97;
                    sp.z = z;
                    sp.life = 1;
                }
                sim.y[i] = hh + rand(0, 2);
                sim.x[i] = rand(-1.1, 1.3) * hh * aspect;
            }
            put(drops, i, sim.x[i], sim.y[i], z, 0.62, 0.76, 1, alpha, sim.len[i], 0.03, Math.atan2(vy, vx));
        }
        drops.commit(n);

        for (let i = 0; i < SPLASHES; i++) {
            const sp = sim.splash[i];
            sp.life = Math.max(0, sp.life - dt * 2.8);
            put(splashes, i, sp.x, sp.y, sp.z, 0.7, 0.85, 1, sp.life * 0.5 * level, 0.08 + (1 - sp.life) * 0.4, 0.35);
        }
        splashes.commit(level > 0 ? SPLASHES : 0);
    });

    return (
        <>
            <primitive object={drops.points} />
            <primitive object={splashes.points} />
        </>
    );
}

const PUFFS = 46;

/** Heavy clouds that roll in with rain/thunder and light up on flashes. */
export function Clouds() {
    const puffs = useParticles(PUFFS, "soft", { blending: THREE.NormalBlending });
    const sim = useMemo(
        () =>
            Array.from({ length: PUFFS }, () => ({
                x: rand(-1.2, 1.2),
                y: rand(0.5, 1.05),
                z: rand(-9, -2),
                size: rand(5, 10),
                speed: rand(0.05, 0.2),
                shade: rand(0.75, 1.1),
            })),
        [],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        const aspect = syncScale(puffs, state);
        const level = Math.min(1, Math.max(levels.rain * 0.85, levels.thunder));
        const flash = levels.flash;
        sim.forEach((c, i) => {
            c.x += (c.speed * dt) / aspect / 4;
            if (c.x > 1.3) c.x = -1.3;
            const hh = halfH(c.z);
            // Slide down from above the screen as the level rises.
            const y = c.y * hh + (1 - level) * hh * 0.8;
            const g = 0.16 * c.shade + flash * 0.55;
            put(puffs, i, c.x * hh * aspect, y, c.z, g * 0.9, g, g * 1.25 + flash * 0.2, 0.55 * level, c.size);
        });
        puffs.commit(level > 0.002 ? PUFFS : 0);
    });

    return <primitive object={puffs.points} />;
}

const SEGMENTS = 1400;

interface Segment {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    width: number;
}

interface Bolt {
    segments: Segment[];
    life: number;
    z: number;
}

/** Recursive midpoint displacement with occasional forks. */
function makeBolt(ax: number, ay: number, bx: number, by: number, depth: number, width: number, out: Segment[]) {
    if (depth === 0) {
        out.push({ ax, ay, bx, by, width });
        return;
    }
    const len = Math.hypot(bx - ax, by - ay);
    const mx = (ax + bx) / 2 + rand(-0.5, 0.5) * len * 0.35;
    const my = (ay + by) / 2 + rand(-0.5, 0.5) * len * 0.1;
    makeBolt(ax, ay, mx, my, depth - 1, width, out);
    makeBolt(mx, my, bx, by, depth - 1, width, out);
    if (depth >= 3 && depth <= 5 && Math.random() < 0.35) {
        const angle = Math.atan2(by - ay, bx - ax) + rand(-0.9, 0.9);
        const bl = len * rand(0.5, 1);
        makeBolt(mx, my, mx + Math.cos(angle) * bl, my + Math.sin(angle) * bl, depth - 2, width * 0.55, out);
    }
}

export function Lightning() {
    const glow = useParticles(SEGMENTS);
    const bolts = useMemo<Bolt[]>(() => [], []);
    const aspectRef = useMemo(() => ({ value: 1 }), []);

    useEffect(
        () =>
            bus.on((event) => {
                if (event.type !== "lightning") return;
                levels.flash = Math.max(levels.flash, 0.6 + event.intensity * 0.6);
                const z = rand(-7, -3);
                const hh = halfH(z);
                const hw = hh * aspectRef.value;
                const x = rand(-0.85, 0.85) * hw;
                const segments: Segment[] = [];
                makeBolt(x, hh * 1.05, x + rand(-0.3, 0.3) * hw, rand(-0.9, -0.2) * hh, 7, 0.1 + event.intensity * 0.08, segments);
                bolts.push({ segments, life: 1, z });
            }),
        [bolts, aspectRef],
    );

    useFrame((state, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        aspectRef.value = syncScale(glow, state);
        let i = 0;
        for (let b = bolts.length - 1; b >= 0; b--) {
            const bolt = bolts[b];
            bolt.life -= dt * 2.2;
            if (bolt.life <= 0) {
                bolts.splice(b, 1);
                continue;
            }
            // Real bolts stutter a few times before fading.
            const flicker = bolt.life > 0.5 ? (Math.sin(bolt.life * 60) > -0.3 ? 1 : 0.35) : bolt.life * 2;
            for (const s of bolt.segments) {
                if (i >= SEGMENTS - 1) break;
                const dx = s.bx - s.ax;
                const dy = s.by - s.ay;
                const len = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx);
                const cx = (s.ax + s.bx) / 2;
                const cy = (s.ay + s.by) / 2;
                const core = len * 1.2 + s.width;
                put(glow, i++, cx, cy, bolt.z, 0.9, 0.93, 1, flicker, core, s.width / core, angle);
                const halo = len * 1.4 + s.width * 6;
                put(glow, i++, cx, cy, bolt.z, 0.45, 0.5, 1, flicker * 0.35, halo, (s.width * 6) / halo, angle);
            }
        }
        glow.commit(i);
    });

    return <primitive object={glow.points} />;
}
