/**
 * The project's name: baselines, history and calibration output carry it in their `kind`, replays
 * name it as their muxing app, and messages use it for the command, as in `npx playwright-butter`.
 */
export const TOOL_NAME = 'playwright-butter';

/** Version of the JSON result format. Bump only on breaking changes to the result shape. */
export const SCHEMA_VERSION = 1;

/** Tells toBeSmooth() and automatic mode not to compare or write baselines while calibrating. */
export const CALIBRATE_ENV = 'BUTTER_CALIBRATE';

export const RECORD_ENV = 'BUTTER_RECORD_BASELINES';

export function recordingBaselines(env: Record<string, string | undefined> = process.env): boolean {
  const v = env[RECORD_ENV]?.trim().toLowerCase();
  return !!v && v !== '0' && v !== 'false';
}
