import { lazy, Suspense, useEffect, useRef, type RefObject } from "react";
import { Outlet } from "react-router";
import { bus } from "../audio/bus";
import { mixer } from "../state/mixer";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

// three.js is the heaviest chunk; let the UI paint first.
const Scene = lazy(() => import("../scene/Scene"));

function useShortcuts() {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const target = e.target as HTMLElement;
            // Let buttons, inputs and menus handle their own keys.
            if (target.closest("button, input, textarea, select, [role=menu]")) return;
            if (e.code === "Space") {
                e.preventDefault();
                mixer.setPlaying(!mixer.get().playing);
            } else if (e.key === "r" || e.key === "R") {
                mixer.randomize();
            } else if (e.key === "Escape") {
                mixer.clear();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
}

/** Big thunder makes the whole page jump a little. */
function useThunderShake(ref: RefObject<HTMLDivElement | null>) {
    useEffect(
        () =>
            bus.on((event) => {
                const el = ref.current;
                if (event.type !== "lightning" || event.intensity < 0.75 || !el) return;
                if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
                // Shake lands when the rumble does, not with the flash.
                setTimeout(() => {
                    el.classList.remove("shake");
                    void el.offsetWidth;
                    el.classList.add("shake");
                }, 350);
            }),
        [ref],
    );
}

export function Layout() {
    const page = useRef<HTMLDivElement>(null);
    useShortcuts();
    useThunderShake(page);

    return (
        <>
            <Suspense fallback={<div className="scene" />}>
                <Scene />
            </Suspense>
            <div className="page" ref={page}>
                <Navbar />
                <main className="main">
                    <Outlet />
                </main>
                <Footer />
            </div>
        </>
    );
}
