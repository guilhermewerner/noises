# barulhinho

Mixer de sons ambiente para dormir, focar ou relaxar: chuva, trovão, vento, mar, riacho, fogueira, grilos, passarinhos, cachorro, gato, oficina, cafeteria, teclado, ventilador, trem e ruídos branco/rosa/marrom.

- **Todos os sons são sintetizados em tempo real** com a Web Audio API (`src/audio/sounds.ts`), sem arquivos de áudio.
- Cada som dispara efeitos visuais em three.js / React Three Fiber (`src/scene/effects`): chuva, raios, folhas, ondas, brasas, vagalumes, faíscas, patinhas, corações, onomatopeias…
- O mix fica salvo na URL (`?mix=rain.80-thunder.75`) e no `localStorage`.
- Timer para dormir com fade out; atalhos: `Espaço` toca/pausa, `R` mix aleatório, `Esc` limpa.

Fiz para uma pessoa especial 💗

```sh
npm install
npm run dev
npm run build
```
