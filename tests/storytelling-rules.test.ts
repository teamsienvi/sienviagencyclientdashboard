import assert from "node:assert";
import {
  generateExecutiveSummaryText,
  analyzeDrivers,
  generateDeterministicRecommendations,
} from "../lib/analytics/storytelling-rules.ts";
import { createMetricComparison } from "../lib/analytics/comparison.ts";

export function runStorytellingRulesTests() {
  console.log("▶ Running Storytelling Rules Tests...");

  const views = createMetricComparison("views", "Total Views", 1200, 1000);
  const er = createMetricComparison("er", "Engagement Rate", 4.5, 3.5, true);
  const netFollowers = createMetricComparison("followers", "Net Followers", 25, 10);
  const posts = createMetricComparison("posts", "Posts Published", 6, 8);
  const engagements = createMetricComparison("engagements", "Engagements", 150, 100);

  const channelBreakdown = [
    { platform: "youtube", label: "YouTube", currentViews: 800, previousViews: 600, absoluteDelta: 200, contributionPct: 60, currentER: 5.0, previousER: 4.0, erDeltaPp: 1.0, currentFollowers: 1000, netFollowers: 20, postsPublished: 4, dataStatus: "connected" as const },
    { platform: "facebook", label: "Facebook", currentViews: 400, previousViews: 400, absoluteDelta: 0, contributionPct: 0, currentER: 3.5, previousER: 3.5, erDeltaPp: 0, currentFollowers: 500, netFollowers: 5, postsPublished: 2, dataStatus: "connected" as const },
  ];

  const topPosts = [
    { id: "p1", date: "2026-07-25", platform: "youtube", title: "Viral Short", views: 500, engagements: 30, engagementRate: 6.0, contributionPct: 41, isSpikeDriver: true },
  ];

  // Test 1: Dynamic Factual Executive Summary
  const summary = generateExecutiveSummaryText(views, er, netFollowers, channelBreakdown, topPosts, "Jul 20–26", true);
  assert.ok(summary.includes("increased"));
  assert.ok(summary.includes("YouTube"));
  assert.ok(summary.includes("Viral Short"));

  // Test 2: Scale vs Efficiency Leaders
  const drivers = analyzeDrivers(channelBreakdown, topPosts);
  assert.strictEqual(drivers.scaleLeader, "YouTube");
  assert.ok(drivers.efficiencyLeader.includes("YouTube"));

  // Test 3: Deterministic Recommendations
  const recs = generateDeterministicRecommendations(views, engagements, netFollowers, posts, drivers, channelBreakdown);
  assert.ok(recs.length >= 1, "Must generate at least 1 recommendation");
  assert.strictEqual(recs[0].type, "repeat_format", "First recommendation must highlight repeating top format");

  console.log("✔ Storytelling Rules Tests Passed!");
}
