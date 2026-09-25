import { Dog } from "lucide-react";
import { Link } from "react-router";

export function NotFound() {
    return (
        <section className="hero not-found">
            <span className="nf-icon">
                <Dog size={40} />
            </span>
            <h1>
                <span className="gradient">404</span>, o cachorro comeu essa página.
            </h1>
            <p>Mas o mixer continua inteirinho lá no começo.</p>
            <Link to="/" className="hint">
                Voltar pro barulho
            </Link>
        </section>
    );
}
