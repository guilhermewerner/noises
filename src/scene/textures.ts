import * as THREE from "three";

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    draw(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
}

const cache: Record<string, THREE.Texture> = {};

function cached(key: string, make: () => THREE.Texture) {
    return (cache[key] ??= make());
}

export const leafTexture = () =>
    cached("leaf", () =>
        canvasTexture(128, (ctx, s) => {
            ctx.translate(s / 2, s / 2);
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.moveTo(-s * 0.42, 0);
            ctx.quadraticCurveTo(0, -s * 0.36, s * 0.42, 0);
            ctx.quadraticCurveTo(0, s * 0.36, -s * 0.42, 0);
            ctx.fill();
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.lineWidth = s * 0.025;
            ctx.beginPath();
            ctx.moveTo(-s * 0.46, 0);
            ctx.lineTo(s * 0.36, 0);
            ctx.stroke();
        }),
    );

export const pawTexture = () =>
    cached("paw", () =>
        canvasTexture(128, (ctx, s) => {
            ctx.fillStyle = "#fff";
            const blob = (x: number, y: number, rx: number, ry: number, rot = 0) => {
                ctx.beginPath();
                ctx.ellipse(x * s, y * s, rx * s, ry * s, rot, 0, Math.PI * 2);
                ctx.fill();
            };
            blob(0.5, 0.64, 0.2, 0.17);
            blob(0.24, 0.42, 0.08, 0.11, -0.4);
            blob(0.4, 0.27, 0.085, 0.115, -0.15);
            blob(0.6, 0.27, 0.085, 0.115, 0.15);
            blob(0.76, 0.42, 0.08, 0.11, 0.4);
        }),
    );

export const heartTexture = () =>
    cached("heart", () =>
        canvasTexture(128, (ctx, s) => {
            ctx.fillStyle = "#fff";
            ctx.translate(s / 2, s * 0.56);
            ctx.scale(s / 36, s / 36);
            ctx.beginPath();
            ctx.moveTo(0, 10);
            ctx.bezierCurveTo(-16, 0, -14, -14, -5, -13);
            ctx.bezierCurveTo(-2, -13, 0, -10, 0, -8);
            ctx.bezierCurveTo(0, -10, 2, -13, 5, -13);
            ctx.bezierCurveTo(14, -14, 16, 0, 0, 10);
            ctx.fill();
        }),
    );

export interface TextStyle {
    color: string;
    font?: string;
    glow?: string;
}

/** A texture with the text drawn centered; returns the aspect so sprites can be sized. */
export function textTexture(text: string, style: TextStyle) {
    const key = `text:${text}:${style.color}:${style.font}`;
    const texture = cached(key, () => {
        const font = style.font ?? "800 96px 'Bricolage Grotesque', system-ui, sans-serif";
        const measure = document.createElement("canvas").getContext("2d")!;
        measure.font = font;
        const width = Math.ceil(measure.measureText(text).width) + 60;
        const height = 150;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.font = font;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = style.glow ?? style.color;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 10;
        ctx.strokeStyle = "rgba(10, 12, 30, 0.85)";
        ctx.strokeText(text, width / 2, height / 2);
        ctx.fillStyle = style.color;
        ctx.fillText(text, width / 2, height / 2);
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.NoColorSpace;
        t.userData.aspect = width / height;
        return t;
    });
    return { texture, aspect: texture.userData.aspect as number };
}

