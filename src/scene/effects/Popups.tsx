import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { bus, type FxEvent } from "../../audio/bus";
import { halfH, rand } from "../particles";
import { textTexture, type TextStyle } from "../textures";

const POOL = 48;
const MONO = "700 110px ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace";

interface Popup {
    sprite: THREE.Sprite;
    life: number;
    max: number;
    height: number;
    aspect: number;
    vx: number;
    vy: number;
    spin: number;
    fall: boolean;
}

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

/** Maps audio events to comic-book onomatopoeia. Returns null to stay quiet. */
function describe(event: FxEvent): { text: string; style: TextStyle; height: number; fall?: boolean } | null {
    switch (event.type) {
        case "lightning":
            return event.intensity > 0.65 && Math.random() < 0.7
                ? { text: pick(["KABRUM!", "CRAAAC!", "BRRROOM!"]), style: { color: "#ddd6fe", glow: "#8b5cf6" }, height: 1.3 }
                : null;
        case "bark":
            return Math.random() < 0.55 ? { text: pick(["AU!", "AU AU!", "WOOF!", "auuu", "AU?!", "rrrAU!"]), style: { color: "#fcd34d", glow: "#f59e0b" }, height: 0.8 } : null;
        case "bird":
            return Math.random() < 0.7 ? { text: pick(["♪", "♫", "piu!", "fiu fiu", "♪♪"]), style: { color: "#fef08a", glow: "#facc15" }, height: 0.6 } : null;
        case "purr":
            return Math.random() < 0.3 ? { text: pick(["prrr", "rrrr", "miau~"]), style: { color: "#fbcfe8", glow: "#ec4899" }, height: 0.6 } : null;
        case "hit":
            return Math.random() < 0.3 ? { text: pick(["TOC!", "PÁ!", "TUM!", "CLANG!"]), style: { color: "#fde047", glow: "#f97316" }, height: 0.8 } : null;
        case "grind":
            return { text: pick(["BZZZT!", "VRRRRR", "ZIIIIN"]), style: { color: "#fef9c3", glow: "#fb923c" }, height: 0.8 };
        case "horn":
            return { text: "PÔÔÔ PÔÔÔ!", style: { color: "#fed7aa", glow: "#f97316" }, height: 1.1 };
        case "clink":
            return Math.random() < 0.4 ? { text: "tim!", style: { color: "#f5e1c8", glow: "#d6a77a" }, height: 0.5 } : null;
        case "wave":
            return Math.random() < 0.2 ? { text: pick(["xuááá", "shhhh"]), style: { color: "#a5f3fc", glow: "#06b6d4" }, height: 0.7 } : null;
        case "key":
            return { text: event.char, style: { color: "#86efac", glow: "#22c55e", font: MONO }, height: 0.42, fall: true };
        default:
            return null;
    }
}

export function Popups() {
    const { group, pool, state } = useMemo(() => {
        const group = new THREE.Group();
        const pool: Popup[] = Array.from({ length: POOL }, () => {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
            sprite.visible = false;
            sprite.renderOrder = 100;
            group.add(sprite);
            return { sprite, life: 0, max: 1, height: 1, aspect: 1, vx: 0, vy: 0, spin: 0, fall: false };
        });
        return { group, pool, state: { cursor: 0, aspect: 1 } };
    }, []);

    useEffect(() => {
        return bus.on((event) => {
            const d = describe(event);
            if (!d) return;
            const p = pool[state.cursor];
            state.cursor = (state.cursor + 1) % POOL;
            const { texture, aspect } = textTexture(d.text, d.style);
            const material = p.sprite.material;
            material.map = texture;
            material.needsUpdate = true;
            const z = d.fall ? rand(-2, 2) : 1;
            const hh = halfH(z);
            const hw = hh * state.aspect;
            // Keep away from the center where the mixer panel lives.
            const side = Math.random() < 0.5 ? -1 : 1;
            const limit = Math.max(0, hw - (d.height * 1.35 * aspect) / 2 - 0.2);
            const x = THREE.MathUtils.clamp(d.fall ? rand(-0.95, 0.95) * hw : side * rand(0.45, 0.88) * hw, -limit, limit);
            const y = d.fall ? hh * rand(0.6, 0.95) : rand(-0.6, 0.65) * hh;
            p.sprite.position.set(x, y, z);
            p.sprite.visible = true;
            p.fall = !!d.fall;
            p.max = p.life = d.fall ? rand(2.5, 4) : 1.8;
            p.height = d.height;
            p.aspect = aspect;
            p.vx = d.fall ? 0 : rand(-0.2, 0.2);
            p.vy = d.fall ? -rand(1.2, 2.4) : 0.55;
            p.spin = d.fall ? 0 : rand(-0.25, 0.25);
            material.rotation = d.fall ? 0 : rand(-0.2, 0.2);
        });
    }, [pool, state]);

    useFrame((frame, rawDt) => {
        const dt = Math.min(rawDt, 0.05);
        state.aspect = frame.size.width / frame.size.height;
        for (const p of pool) {
            if (!p.sprite.visible) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.sprite.visible = false;
                continue;
            }
            const age = p.max - p.life;
            p.sprite.position.x += p.vx * dt;
            p.sprite.position.y += p.vy * dt;
            p.sprite.material.rotation += p.spin * dt;
            // Pop in with a little overshoot, then fade.
            const pop = p.fall ? 1 : 1 + 0.35 * Math.exp(-age * 7) * Math.cos(age * 20);
            const scale = p.height * Math.min(1, age * 8) * pop;
            p.sprite.scale.set(scale * p.aspect, scale, 1);
            p.sprite.material.opacity = Math.min(1, p.life / 0.6);
        }
    });

    return <primitive object={group} />;
}
