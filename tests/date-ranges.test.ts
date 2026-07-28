import assert from "node:assert";
import {
  calculateComparisonPeriods,
  getMondayBasedWeekdayIndex,
  getMonSunWeekBounds,
} from "../lib/analytics/date-ranges.ts";

export function runDateRangesTests() {
  console.log("▶ Running Date Ranges Tests...");

  // Test 1: getMondayBasedWeekdayIndex (Monday = 0, Sunday = 6)
  const monday = new Date("2026-07-27T00:00:00Z"); // Monday
  const sunday = new Date("2026-07-26T00:00:00Z"); // Sunday
  assert.strictEqual(getMondayBasedWeekdayIndex(monday), 0, "Monday index must be 0");
  assert.strictEqual(getMondayBasedWeekdayIndex(sunday), 6, "Sunday index must be 6");

  // Test 2: 14d WoW Period Split (Week 2 = Current 7d vs Week 1 = Previous 7d)
  const periods = calculateComparisonPeriods("14d");
  assert.strictEqual(periods.mode, "wow_split", "14d preset must use wow_split mode");
  assert.strictEqual(periods.current.elapsedDays, 7, "Current WoW period must be 7 days");
  assert.strictEqual(periods.previous.elapsedDays, 7, "Previous WoW period must be 7 days");

  // Test 3: Mon-Sun Week Bounds
  const testDate = new Date("2026-07-22T00:00:00Z"); // Wednesday
  const bounds = getMonSunWeekBounds(testDate);
  assert.strictEqual(bounds.start.getDay(), 1, "Week start must be Monday");
  assert.strictEqual(bounds.end.getDay(), 0, "Week end must be Sunday");

  console.log("✔ Date Ranges Tests Passed!");
}
