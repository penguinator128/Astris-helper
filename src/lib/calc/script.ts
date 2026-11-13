/* Script page count to runtime and shooting days. */

export interface ScriptEstimate {
  runtimeMin: number;
  days: number;
  pagesPerDay: number;
  setups: number;
}

/** 1 page ≈ 1 minute is the industry rule of thumb; density adjusts it. */
export function scriptEstimate(pages: number, secondsPerPage = 60, pagesPerDay = 4, setupsPerPage = 3): ScriptEstimate {
  return {
    runtimeMin: (pages * secondsPerPage) / 60,
    days: Math.ceil(pages / pagesPerDay),
    pagesPerDay,
    setups: Math.round(pages * setupsPerPage),
  };
}
