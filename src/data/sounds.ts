import {
    AudioWaveform,
    Bird,
    Bug,
    Cat,
    CloudLightning,
    CloudRain,
    Coffee,
    Dog,
    Droplets,
    Fan,
    Flame,
    Hammer,
    Keyboard,
    Radio,
    TrainFront,
    Tv,
    WavesHorizontal,
    Wind,
    type LucideIcon,
} from "lucide-react";

export type SoundId =
    | "rain"
    | "thunder"
    | "wind"
    | "ocean"
    | "stream"
    | "fire"
    | "crickets"
    | "birds"
    | "dog"
    | "cat"
    | "tools"
    | "cafe"
    | "keyboard"
    | "fan"
    | "train"
    | "white"
    | "pink"
    | "brown";

export type Category = "nature" | "animals" | "urban" | "noise";

export interface SoundMeta {
    id: SoundId;
    name: string;
    hint: string;
    icon: LucideIcon;
    color: string;
    category: Category;
}

export const CATEGORIES: { id: Category | "all"; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "nature", label: "Natureza" },
    { id: "animals", label: "Bichos" },
    { id: "urban", label: "Cidade & trampo" },
    { id: "noise", label: "Ruídos" },
];

export const SOUNDS: SoundMeta[] = [
    { id: "rain", name: "Chuva", hint: "Pingos no telhado", icon: CloudRain, color: "#60a5fa", category: "nature" },
    { id: "thunder", name: "Trovão", hint: "Raios e cabrum", icon: CloudLightning, color: "#a78bfa", category: "nature" },
    { id: "wind", name: "Vento", hint: "Rajadas e folhas", icon: Wind, color: "#5eead4", category: "nature" },
    { id: "ocean", name: "Mar", hint: "Ondas quebrando", icon: WavesHorizontal, color: "#22d3ee", category: "nature" },
    { id: "stream", name: "Riacho", hint: "Água e bolhinhas", icon: Droplets, color: "#38bdf8", category: "nature" },
    { id: "fire", name: "Fogueira", hint: "Estalos e brasas", icon: Flame, color: "#fb923c", category: "nature" },
    { id: "crickets", name: "Grilos", hint: "Noite com vagalumes", icon: Bug, color: "#a3e635", category: "animals" },
    { id: "birds", name: "Passarinhos", hint: "Manhã no mato", icon: Bird, color: "#fcd34d", category: "animals" },
    { id: "dog", name: "Cachorro", hint: "Au au do vizinho", icon: Dog, color: "#f59e0b", category: "animals" },
    { id: "cat", name: "Gato", hint: "Ronronando no colo", icon: Cat, color: "#f472b6", category: "animals" },
    { id: "tools", name: "Oficina", hint: "Martelo, serra, faísca", icon: Hammer, color: "#facc15", category: "urban" },
    { id: "cafe", name: "Cafeteria", hint: "Burburinho e xícaras", icon: Coffee, color: "#d6a77a", category: "urban" },
    { id: "keyboard", name: "Teclado", hint: "Clack clack mecânico", icon: Keyboard, color: "#4ade80", category: "urban" },
    { id: "fan", name: "Ventilador", hint: "Zumbido constante", icon: Fan, color: "#93c5fd", category: "urban" },
    { id: "train", name: "Trem", hint: "Tu-tum... tu-tum", icon: TrainFront, color: "#fdba74", category: "urban" },
    { id: "white", name: "Ruído branco", hint: "Chiado de TV", icon: Tv, color: "#e5e7eb", category: "noise" },
    { id: "pink", name: "Ruído rosa", hint: "Mais suave, equilibrado", icon: Radio, color: "#f9a8d4", category: "noise" },
    { id: "brown", name: "Ruído marrom", hint: "Grave e aconchegante", icon: AudioWaveform, color: "#c08457", category: "noise" },
];

export const SOUND_IDS = SOUNDS.map((sound) => sound.id);

export const SOUND_BY_ID = Object.fromEntries(SOUNDS.map((sound) => [sound.id, sound])) as Record<SoundId, SoundMeta>;
