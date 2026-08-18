/** Minutes late vs. the planned instant — never negative (an early arrival isn't a "negative delay" for display). */
export function computeDelayMinutes(arrivalTime: Date, plannedStart: Date): number {
  return Math.max(0, Math.round((arrivalTime.getTime() - plannedStart.getTime()) / 60000));
}
