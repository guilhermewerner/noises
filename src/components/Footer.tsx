import { AudioWaveform, Heart, Keyboard, Link2, Moon, Sparkles } from "lucide-react";

const FEATURES = [
    {
        icon: Sparkles,
        title: "Gerado ao vivo",
        text: "Nenhum arquivo de áudio: cada pingo, latido e faísca é sintetizado na hora pelo seu navegador com a Web Audio API. Nunca repete igual.",
    },
    {
        icon: Link2,
        title: "Mix no link",
        text: "Seu mix fica salvo na URL e no navegador. Copia o link e manda pro amigo que não consegue dormir.",
    },
    {
        icon: Moon,
        title: "Timer pra dormir",
        text: "Escolhe o tempo no relógio lá em cima e o som vai sumindo devagarinho quando acabar.",
    },
    {
        icon: Keyboard,
        title: "Atalhos",
        text: "Espaço toca ou pausa. R sorteia um mix aleatório. Esc silencia tudo.",
    },
];

export function Footer() {
    return (
        <footer className="footer" id="sobre">
            <div className="footer-inner">
                <div className="footer-features">
                    {FEATURES.map(({ icon: Icon, title, text }) => (
                        <div className="feature" key={title}>
                            <span className="feature-icon">
                                <Icon size={18} />
                            </span>
                            <div>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="footer-bottom">
                    <div className="brand small">
                        <span className="brand-mark">
                            <AudioWaveform size={16} strokeWidth={2.5} />
                        </span>
                        <span className="brand-name">barulhinho</span>
                    </div>
                    <p>
                        © {new Date().getFullYear()} · feito com <Heart size={13} fill="currentColor" className="heart" /> e muito ruído
                    </p>
                    <p className="muted">Use fones pra uma experiência melhor. Cuide dos seus ouvidos: volume moderado.</p>
                </div>
            </div>
        </footer>
    );
}
