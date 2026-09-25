import { useMemo } from "react";
import * as THREE from "three";

export type ParticleMode = "soft" | "ring" | "texture";

const vertexShader = /* glsl */ `
    uniform float uScale;
    attribute vec4 aColor;
    attribute float aSize;
    attribute vec2 aShape;
    varying vec4 vColor;
    varying vec2 vShape;

    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / -mv.z;
        vColor = aColor;
        vShape = aShape;
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D uMap;
    varying vec4 vColor;
    varying vec2 vShape;

    void main() {
        if (vColor.a <= 0.001) discard;
        vec2 p = gl_PointCoord - 0.5;
        p.y = -p.y;
        float c = cos(vShape.y);
        float s = sin(vShape.y);
        p = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);

        #if defined(MODE_TEXTURE)
            vec4 tex = texture2D(uMap, p + 0.5);
            float a = tex.a;
            if (abs(p.x) > 0.5 || abs(p.y) > 0.5) a = 0.0;
            gl_FragColor = vec4(vColor.rgb * tex.rgb, vColor.a * a);
        #else
            // Ellipse: x spans the full sprite, y is squashed by the thickness ratio.
            float thin = max(vShape.x, 0.02);
            float d = length(vec2(p.x, p.y / thin)) * 2.0;
            #if defined(MODE_RING)
                float a = smoothstep(0.55, 0.75, d) * (1.0 - smoothstep(0.85, 1.0, d)) + 0.15 * (1.0 - smoothstep(0.0, 0.9, d));
            #else
                float a = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
            #endif
            gl_FragColor = vec4(vColor.rgb, vColor.a * a);
        #endif
    }
`;

export interface Particles {
    points: THREE.Points;
    material: THREE.ShaderMaterial;
    max: number;
    pos: Float32Array;
    col: Float32Array;
    size: Float32Array;
    /** (thickness ratio 0..1, rotation radians) */
    shape: Float32Array;
    /** Uploads the first `count` particles and draws only those. */
    commit(count: number): void;
}

export function createParticles(
    max: number,
    mode: ParticleMode = "soft",
    options: { map?: THREE.Texture; blending?: THREE.Blending } = {},
): Particles {
    const geometry = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3);
    const col = new Float32Array(max * 4);
    const size = new Float32Array(max);
    const shape = new Float32Array(max * 2).fill(1);
    const attrs = {
        position: new THREE.BufferAttribute(pos, 3),
        aColor: new THREE.BufferAttribute(col, 4),
        aSize: new THREE.BufferAttribute(size, 1),
        aShape: new THREE.BufferAttribute(shape, 2),
    };
    for (const [name, attr] of Object.entries(attrs)) {
        attr.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute(name, attr);
    }
    geometry.setDrawRange(0, 0);

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { uScale: { value: 500 }, uMap: { value: options.map ?? null } },
        defines: mode === "texture" ? { MODE_TEXTURE: "" } : mode === "ring" ? { MODE_RING: "" } : {},
        transparent: true,
        depthWrite: false,
        blending: options.blending ?? THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;

    return {
        points,
        material,
        max,
        pos,
        col,
        size,
        shape,
        commit(count) {
            const n = Math.min(count, max);
            geometry.setDrawRange(0, n);
            for (const attr of Object.values(attrs)) {
                attr.clearUpdateRanges();
                attr.addUpdateRange(0, n * attr.itemSize);
                attr.needsUpdate = true;
            }
        },
    };
}

export function useParticles(max: number, mode: ParticleMode = "soft", options?: { map?: THREE.Texture; blending?: THREE.Blending }) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => createParticles(max, mode, options), []);
}

/** Pixel scale so that `aSize` is in world units, for a perspective camera. */
export function pointScale(heightPx: number, dpr: number, fovDeg: number) {
    return (heightPx * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
}

/** Small helper for writing one particle. */
export function put(
    p: Particles,
    i: number,
    x: number,
    y: number,
    z: number,
    r: number,
    g: number,
    b: number,
    a: number,
    size: number,
    thin = 1,
    angle = 0,
) {
    p.pos[i * 3] = x;
    p.pos[i * 3 + 1] = y;
    p.pos[i * 3 + 2] = z;
    p.col[i * 4] = r;
    p.col[i * 4 + 1] = g;
    p.col[i * 4 + 2] = b;
    p.col[i * 4 + 3] = a;
    p.size[i] = size;
    p.shape[i * 2] = thin;
    p.shape[i * 2 + 1] = angle;
}

export const rand = (min: number, max: number) => min + Math.random() * (max - min);

export const CAMERA_Z = 10;
export const FOV = 60;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);

/** Half the visible height/width at depth `z`. */
export const halfH = (z: number) => (CAMERA_Z - z) * TAN;
export const halfW = (z: number, aspect: number) => halfH(z) * aspect;

interface FrameSize {
    size: { width: number; height: number };
    viewport: { dpr: number };
}

/** Keeps point sizes in world units after resizes / DPR changes. */
export function syncScale(p: Particles, state: FrameSize) {
    p.material.uniforms.uScale.value = pointScale(state.size.height, state.viewport.dpr, FOV);
    return state.size.width / state.size.height;
}
