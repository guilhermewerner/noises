import { AudioWaveform, Check, Pause, Play, Share2, Timer, Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { engine } from "../audio/engine";
import { SOUND_IDS } from "../data/sounds";
import { mixer, useMixer } from "../state/mixer";

export function Navbar() {
    return (
        <header className="nav">
            <div className="nav-inner">
                <Link to="/" className="brand" aria-label="barulhinho, início">
                    <span className="brand-mark">
                        <AudioWaveform size={20} strokeWidth={2.5} />
                    </span>
                    <span className="brand-name">barulhinho</span>
                </Link>

                <nav className="nav-links">
                    <a href="#mixer">Mixer</a>
                    <a href="#presets">Presets</a>
                    <a href="#sobre">Sobre</a>
                </nav>

                <div className="nav-actions">
                    <LevelMeter />
                    <MasterVolume />
                    <SleepTimer />
                    <ShareButton />
                    <PlayButton />
                </div>
            </div>
        </header>
    );
}

function PlayButton() {
    const playing = useMixer((s) => s.playing);
    const hasMix = useMixer((s) => SOUND_IDS.some((id) => s.volumes[id] > 0));
    return (
        <button
            className={`play ${!playing && hasMix ? "pulse" : ""}`}
            onClick={() => mixer.setPlaying(!playing)}
            aria-label={playing ? "Pausar" : "Tocar"}
            title={playing ? "Pausar (espaço)" : "Tocar (espaço)"}
        >
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
    );
}

function MasterVolume() {
    const master = useMixer((s) => s.master);
    const Icon = master === 0 ? VolumeX : master < 0.5 ? Volume1 : Volume2;
    return (
        <label className="master" title="Volume geral">
            <Icon size={18} />
            <input
                type="range"
                min={0}
                max={100}
                value={Math.round(master * 100)}
                onChange={(e) => mixer.setMaster(Number(e.target.value) / 100)}
                style={{ "--fill": `${master * 100}%` } as CSSProperties}
                aria-label="Volume geral"
            />
        </label>
    );
}

const TIMER_OPTIONS = [15, 30, 45, 60, 90];

function formatRemaining(ms: number) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function SleepTimer() {
    const timerEnd = useMixer((s) => s.timerEnd);
    const [open, setOpen] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!timerEnd) return;
        const id = setInterval(() => {
            const t = Date.now();
            setNow(t);
            if (t >= timerEnd) void mixer.expireTimer();
        }, 1000);
        return () => clearInterval(id);
    }, [timerEnd]);

    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener("pointerdown", close);
        return () => window.removeEventListener("pointerdown", close);
    }, [open]);

    const choose = (minutes: number | null) => {
        mixer.setTimer(minutes);
        setNow(Date.now());
        setOpen(false);
    };

    return (
        <div className="timer" ref={ref}>
            <button className={`icon-btn ${timerEnd ? "active" : ""}`} onClick={() => setOpen(!open)} title="Timer para dormir" aria-expanded={open}>
                <Timer size={18} />
                {timerEnd && <span className="timer-left">{formatRemaining(timerEnd - now)}</span>}
            </button>
            {open && (
                <div className="menu" role="menu">
                    <div className="menu-title">Desligar em…</div>
                    {TIMER_OPTIONS.map((m) => (
                        <button key={m} role="menuitem" onClick={() => choose(m)}>
                            {m} min
                        </button>
                    ))}
                    {timerEnd && (
                        <button role="menuitem" className="danger" onClick={() => choose(null)}>
                            Cancelar timer
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function ShareButton() {
    const [copied, setCopied] = useState(false);
    const share = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            window.prompt("Copie o link do seu mix:", window.location.href);
        }
    };
    return (
        <button className={`icon-btn ${copied ? "active" : ""}`} onClick={share} title="Copiar link do mix">
            {copied ? <Check size={18} /> : <Share2 size={18} />}
            {copied && <span className="toast">Link copiado!</span>}
        </button>
    );
}

/** Tiny live spectrum from the master analyser. */
function LevelMeter() {
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const el = canvas.current!;
        const ctx = el.getContext("2d")!;
        const bars = 7;
        let data = new Uint8Array(0);
        let raf = 0;
        const draw = () => {
            raf = requestAnimationFrame(draw);
            const { width, height } = el;
            ctx.clearRect(0, 0, width, height);
            const analyser = engine.analyser;
            if (analyser && data.length !== analyser.frequencyBinCount) data = new Uint8Array(analyser.frequencyBinCount);
            if (analyser && engine.running) analyser.getByteFrequencyData(data);
            else data.fill(0);
            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, "#7c5cff");
            gradient.addColorStop(1, "#22d3ee");
            ctx.fillStyle = gradient;
            const w = width / bars;
            for (let i = 0; i < bars; i++) {
                // Log-ish spacing so bass doesn't hog every bar.
                const bin = Math.floor(Math.pow(i / bars, 1.8) * data.length * 0.6) + 1;
                const v = (data[bin] ?? 0) / 255;
                const h = Math.max(3, v * height);
                ctx.beginPath();
                ctx.roundRect(i * w + 1.5, height - h, w - 3, h, 2);
                ctx.fill();
            }
        };
        draw();
        return () => cancelAnimationFrame(raf);
    }, []);

    return <canvas ref={canvas} className="meter" width={56} height={28} aria-hidden />;
}
