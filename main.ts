// NEON BAY: SUNSET RUN — entrypoint (R12 rebuild, spec section 6).
// Small TypeScript module: exports main(), which boots the game and
// returns a status string. Safe to run headless (no crash without a DOM).

import { Game } from "./game/src/main.js";

export function main() {
  if (typeof document === "undefined") {
    return "headless: no document, game not booted";
  }
  const canvas = document.getElementById("game");
  if (!canvas) {
    return "error: canvas #game not found";
  }
  const game = new Game(canvas);
  game.boot();
  window.__neonBayGame = game;
  return "ok: NEON BAY booted" + (game.shotId ? " shot=" + game.shotId : "");
}

export default main;

// Auto-boot in the browser when this module loads.
if (typeof document !== "undefined" && typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => main());
  } else {
    main();
  }
}
