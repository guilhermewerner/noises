import { BrainCircuit, CloudLightning, Coffee, Heart, Moon, TentTree, TrainFront, Wrench, type LucideIcon } from "lucide-react";
import type { SoundId } from "./sounds";

export interface Preset {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    gradient: [string, string];
    mix: Partial<Record<SoundId, number>>;
}

export const PRESETS: Preset[] = [
    {
        id: "sleep",
        name: "Soninho profundo",
        description: "Marrom + chuva fininha + ventilador",
        icon: Moon,
        gradient: ["#312e81", "#6d28d9"],
        mix: { brown: 0.55, rain: 0.35, fan: 0.3 },
    },
    {
        id: "focus",
        name: "Foco total",
        description: "Rosa, cafeteria e teclado",
        icon: BrainCircuit,
        gradient: ["#065f46", "#0ea5e9"],
        mix: { pink: 0.4, cafe: 0.35, keyboard: 0.3 },
    },
    {
        id: "storm",
        name: "Tempestade épica",
        description: "Chuva forte, trovões e vento",
        icon: CloudLightning,
        gradient: ["#1e1b4b", "#7c3aed"],
        mix: { rain: 0.8, thunder: 0.75, wind: 0.45 },
    },
    {
        id: "camp",
        name: "Acampamento",
        description: "Fogueira, grilos e riacho",
        icon: TentTree,
        gradient: ["#7c2d12", "#f59e0b"],
        mix: { fire: 0.7, crickets: 0.5, stream: 0.3, wind: 0.2 },
    },
    {
        id: "cozy",
        name: "Gatinho no colo",
        description: "Ronrom, lareira e chuva lá fora",
        icon: Heart,
        gradient: ["#831843", "#f472b6"],
        mix: { cat: 0.7, fire: 0.35, rain: 0.35 },
    },
    {
        id: "cafe",
        name: "Café da esquina",
        description: "Burburinho, xícaras e trem ao longe",
        icon: Coffee,
        gradient: ["#451a03", "#b45309"],
        mix: { cafe: 0.7, rain: 0.25, train: 0.2 },
    },
    {
        id: "night-train",
        name: "Viagem noturna",
        description: "Trem nos trilhos com chuva na janela",
        icon: TrainFront,
        gradient: ["#0c4a6e", "#f97316"],
        mix: { train: 0.7, rain: 0.45, brown: 0.2 },
    },
    {
        id: "chaos",
        name: "Oficina do caos",
        description: "Martelo, esmerilhadeira e o cachorro reclamando",
        icon: Wrench,
        gradient: ["#713f12", "#ef4444"],
        mix: { tools: 0.8, dog: 0.6, keyboard: 0.4, train: 0.3 },
    },
];
