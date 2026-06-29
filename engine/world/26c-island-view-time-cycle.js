  // -------- island view time cycle --------
  // Island visits start at midday, then loop a full virtual day every 30 real
  // minutes. Night (21:00–06:00 virtual) is capped at 10 real minutes.
  const ISLAND_VIEW_MIDDAY_MIN = 720;
  const ISLAND_VIEW_CYCLE_MS = 30 * 60 * 1000;
  const ISLAND_VIEW_PHASE_AFTERNOON_MS = 12 * 60 * 1000; // 12:00 → 21:00
  const ISLAND_VIEW_PHASE_NIGHT_MS = 10 * 60 * 1000;       // 21:00 → 06:00
  const ISLAND_VIEW_PHASE_MORNING_MS = 8 * 60 * 1000;     // 06:00 → 12:00

  function isIslandViewTimeCycleContext() {
    const body = document.body;
    if (!body) return false;
    return body.classList.contains('tinyverse-collectible')
      || body.classList.contains('random-island-preview-mode');
  }

  function islandViewTodMinutesFromElapsed(elapsedMs) {
    const raw = Number(elapsedMs) || 0;
    const cycleMs = ((raw % ISLAND_VIEW_CYCLE_MS) + ISLAND_VIEW_CYCLE_MS) % ISLAND_VIEW_CYCLE_MS;
    if (cycleMs < ISLAND_VIEW_PHASE_AFTERNOON_MS) {
      const t = cycleMs / ISLAND_VIEW_PHASE_AFTERNOON_MS;
      return ISLAND_VIEW_MIDDAY_MIN + t * 540;
    }
    const afterAfternoon = cycleMs - ISLAND_VIEW_PHASE_AFTERNOON_MS;
    if (afterAfternoon < ISLAND_VIEW_PHASE_NIGHT_MS) {
      const t = afterAfternoon / ISLAND_VIEW_PHASE_NIGHT_MS;
      let virt = 1260 + t * 540;
      if (virt >= 1440) virt -= 1440;
      return virt;
    }
    const afterNight = afterAfternoon - ISLAND_VIEW_PHASE_NIGHT_MS;
    const t = afterNight / ISLAND_VIEW_PHASE_MORNING_MS;
    return 360 + t * 360;
  }

  window.__tinyworldIslandViewTimeCycle = {
    ISLAND_VIEW_MIDDAY_MIN,
    ISLAND_VIEW_CYCLE_MS,
    ISLAND_VIEW_PHASE_NIGHT_MS,
    isIslandViewTimeCycleContext,
    islandViewTodMinutesFromElapsed,
  };