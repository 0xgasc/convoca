export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const HARVEST_INTERVAL_MS = 30 * 60 * 1000; // 30 min
  const CITIES = ['nyc', 'guatemala_city'] as const;

  async function harvestCycle() {
    try {
      const { runHarvester } = await import('@/lib/agents/harvester');
      for (const city of CITIES) {
        await runHarvester({ city, sessionId: 'cron' }).catch(() => {/* best-effort */});
      }
    } catch { /* best-effort */ }
  }

  async function notifyCycle() {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
      const secret  = process.env.CRON_SECRET ?? 'dev-cron-secret';
      await fetch(`${baseUrl}/api/cron/notify`, {
        method: 'POST',
        headers: { 'x-cron-secret': secret },
      });
    } catch { /* best-effort */ }
  }

  // Harvest: warm-up 3 min, then every 30 min
  setTimeout(() => {
    void harvestCycle();
    setInterval(() => void harvestCycle(), HARVEST_INTERVAL_MS);
  }, 3 * 60 * 1000);

  // Notifications: run once ~8 AM by checking the hour every 60 min
  function scheduleNotify() {
    const now = new Date();
    const hour = now.getHours();
    if (hour === 8) void notifyCycle();
  }
  setTimeout(() => {
    scheduleNotify();
    setInterval(scheduleNotify, 60 * 60 * 1000); // check every hour
  }, 5 * 60 * 1000); // start checking after 5-min warm-up
}
