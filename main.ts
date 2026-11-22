// NEON BAY: SUNSET RUN — entrypoint (gta6-01, round 10)
// Modul TypeScript kecil: mem-boot game di browser, atau melaporkan status
// headless saat dijalankan via node / ts runner tanpa DOM.
// JANGAN impor file yang tidak ada — hanya ./game/src/main.js (ada).

export interface MainStatus {
  ok: boolean;
  game: string;
  headless: boolean;
  booted: boolean;
  error: string | null;
}

export async function main(): Promise<MainStatus> {
  const status: MainStatus = {
    ok: true,
    game: "NEON BAY: SUNSET RUN",
    headless: typeof document === "undefined",
    booted: false,
    error: null,
  };
  // Headless (node): tidak ada DOM/canvas — laporkan status, jangan boot.
  if (status.headless) return status;
  try {
    const mod = await import("./game/src/main.js");
    const canvas = document.getElementById("game") as HTMLCanvasElement | null;
    const game = new mod.Game(canvas as HTMLCanvasElement);
    game.boot();
    status.booted = game.booted;
    status.ok = game.bootErrors.length === 0;
    if (!status.ok) status.error = game.bootErrors.join("; ");
  } catch (err) {
    status.ok = false;
    status.error = err instanceof Error ? err.message : String(err);
  }
  return status;
}

// Auto-boot saat dimuat di browser (bukan saat dijalankan headless).
if (typeof document !== "undefined") {
  void main();
}
