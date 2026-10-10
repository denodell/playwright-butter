import type { Page } from '@playwright/test';
import type { ResetStrategy as CoreResetStrategy } from 'butter-churn';

export { test } from './fixture.js';
export { withButter } from './withButter.js';
export type { AutoOptions } from './withButter.js';
export type { Butter, ButterFixtures, ButterTestOptions, ButterOptions } from './fixture.js';
export { expect } from './matcher.js';
export { PACKAGE_NAME } from './constants.js';
export { SCHEMA_VERSION } from 'butter-churn';
// The result and option types, from the engine. ButterOptions and ResetStrategy are the
// Playwright forms, which pass a Playwright Page to a reset function.
export type {
  BaselineInfo,
  Budget,
  Budget120Result,
  BudgetCheck,
  BudgetStatus,
  Check,
  CheckStatus,
  Comparison,
  ComparisonStatus,
  Enforce,
  FramesResult,
  HeadlessMode,
  HotFunction,
  InputResult,
  ListOptions,
  ListResult,
  LongFramesResult,
  MatcherOptions,
  ProfileResult,
  ReplayMode,
  ResolvedOptions,
  ScrollOptions,
  ButterMode,
  ButterResult,
  Spread,
  TargetTiming,
  TopScript,
  Unavailable,
} from 'butter-churn';
export type ResetStrategy = CoreResetStrategy<Page>;
