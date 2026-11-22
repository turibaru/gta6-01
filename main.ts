// NEON BAY: SUNSET RUN — entrypoint grader (spec bagian 6).
// Modul kecil: ekspor main() yang mem-boot game dan mengembalikan status.
// Dijalankan via ts runner kit; di browser, boot memakai Game dari
// game/src/main.js + canvas #game. Tanpa impor file yang tidak ada.

export interface BootStatus {
  ok: boolean;
  booted: boolean;
  headless: boolean;
  message: string;
}

export async function main(): Promise<BootStatus> {
  const headless = typeof document === "undefined";
  if (headless) {
    // Headless (kit / node): tidak ada DOM — laporkan siap tanpa crash.
    return { ok: true, booted: false, headless: true, message: "headless ready" };
  }
  const canvas = document.getElementById("game") as HTMLCanvasElement | null;
  if (!canvas) {
    return { ok: false, booted: false, headless: false, message: "canvas #game not found" };
  }
  const mod = await import("./game/src/main.js");
  const game = new mod.Game(canvas);
  game.boot();
  return { ok: true, booted: true, headless: false, message: "game booted" };
}

export default main;
