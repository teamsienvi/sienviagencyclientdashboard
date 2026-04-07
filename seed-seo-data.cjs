const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  "https://mhuxrnxajtiwxauhlhlv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E"
);

// ═══════════════════════════════════════════════════════════════
// FULL HISTORICAL DATA — extracted from Ubersuggest API captures
// ═══════════════════════════════════════════════════════════════

const allData = {
  "blingybag.com": [
    // Week of Apr 5
    {
      audit: { score: 61, score_old: 61, score_change: 0, issues: { new: 12, total: 655, fixed: 0 },
        report_type: "none_fixed_new", from_date: "2026-03-28", to_date: "2026-04-04",
        highest_impact: [
          { count: 226, difficulty: "easy", seo_impact: "high", id: "title_duplicate_tag", level: "page" },
          { count: 5, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
        ]
      },
      keywords: [
        { keyword: "bling crossbody bag", volume: 170, desktop_old: 35, desktop_new: 37, desktop_change: -2 },
        { keyword: "handbags bling and more", volume: 50, desktop_old: 51, desktop_new: 53, desktop_change: -2 },
      ],
      keyword_report_type: "dropped",
      date: "2026-04-05T00:26:41Z"
    },
    // Week of Mar 29
    {
      audit: { score: 61, score_old: 61, score_change: 0, issues: { new: 0, total: 643, fixed: 28 },
        report_type: "some_fixed_no_new", from_date: "2026-03-21", to_date: "2026-03-28",
        highest_impact: [
          { count: 222, difficulty: "easy", seo_impact: "high", id: "title_duplicate_tag", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
        ]
      },
      keywords: [
        { keyword: "handbags bling and more", volume: 50, desktop_old: 57, desktop_new: 51, desktop_change: 6 },
      ],
      keyword_report_type: "improved",
      date: "2026-03-29T00:29:43Z"
    },
    // Week of Mar 22
    {
      audit: { score: 61, score_old: 61, score_change: 0, issues: { new: 7, total: 671, fixed: 2 },
        report_type: "some_fixed_new", from_date: "2026-03-14", to_date: "2026-03-21",
        highest_impact: [
          { count: 235, difficulty: "easy", seo_impact: "high", id: "title_duplicate_tag", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
        ]
      },
      keywords: [
        { keyword: "bling purses", volume: 720, desktop_old: 35, desktop_new: 33, desktop_change: 2 },
        { keyword: "bling handbags", volume: 720, desktop_old: null, desktop_new: 37, desktop_change: null },
        { keyword: "bling purse", volume: 720, desktop_old: 34, desktop_new: 31, desktop_change: 3 },
        { keyword: "bling bags", volume: 210, desktop_old: 54, desktop_new: 46, desktop_change: 8 },
        { keyword: "handbag bling", volume: 50, desktop_old: 64, desktop_new: 58, desktop_change: 6 },
        { keyword: "bling bling bags", volume: 50, desktop_old: 54, desktop_new: 53, desktop_change: 1 },
      ],
      keyword_report_type: "improved",
      date: "2026-03-22T00:30:22Z"
    },
    // Week of Mar 15
    {
      audit: { score: 61, score_old: 61, score_change: 0, issues: { new: 8, total: 666, fixed: 3 },
        report_type: "some_fixed_new", from_date: "2026-03-07", to_date: "2026-03-14",
        highest_impact: [
          { count: 232, difficulty: "easy", seo_impact: "high", id: "title_duplicate_tag", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
        ]
      },
      keywords: [
        { keyword: "bling handbags", volume: 720, desktop_old: 35, desktop_new: null, desktop_change: null },
        { keyword: "bling purse", volume: 720, desktop_old: 32, desktop_new: 34, desktop_change: -2 },
        { keyword: "bling crossbody bag", volume: 170, desktop_old: 26, desktop_new: 27, desktop_change: -1 },
        { keyword: "handbag bling", volume: 50, desktop_old: 63, desktop_new: 64, desktop_change: -1 },
        { keyword: "bling bling bags", volume: 50, desktop_old: 52, desktop_new: 54, desktop_change: -2 },
        { keyword: "handbags bling and more", volume: 50, desktop_old: 46, desktop_new: 53, desktop_change: -7 },
      ],
      keyword_report_type: "dropped",
      date: "2026-03-15T00:37:39Z"
    },
    // Week of Mar 8
    {
      audit: { score: 61, score_old: 61, score_change: 0, issues: { new: 5, total: 661, fixed: 0 },
        report_type: "none_fixed_new", from_date: "2026-02-28", to_date: "2026-03-07",
        highest_impact: [
          { count: 229, difficulty: "easy", seo_impact: "high", id: "title_duplicate_tag", level: "page" },
          { count: 5, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
        ]
      },
      keywords: [
        { keyword: "bling purses", volume: 720, desktop_old: 61, desktop_new: 35, desktop_change: 26 },
        { keyword: "bling handbags", volume: 720, desktop_old: 60, desktop_new: 35, desktop_change: 25 },
        { keyword: "bling purse", volume: 720, desktop_old: 65, desktop_new: 32, desktop_change: 33 },
        { keyword: "bling crossbody bag", volume: 170, desktop_old: 59, desktop_new: 26, desktop_change: 33 },
        { keyword: "handbag bling", volume: 50, desktop_old: null, desktop_new: 63, desktop_change: null },
        { keyword: "bling bling bags", volume: 50, desktop_old: null, desktop_new: 52, desktop_change: null },
        { keyword: "handbags bling and more", volume: 50, desktop_old: 84, desktop_new: 46, desktop_change: 38 },
      ],
      keyword_report_type: "improved",
      date: "2026-03-08T00:34:03Z"
    },
  ],

  "sienvi.com": [
    {
      audit: { score: 31, score_old: 31, score_change: 0, issues: { new: 0, total: 10, fixed: 0 },
        report_type: "none_fixed_no_new", from_date: "2026-03-28", to_date: "2026-04-04",
        highest_impact: [
          { count: 1, difficulty: "moderate", seo_impact: "high", id: "have_sitemap", level: "domain" },
          { count: 1, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 3, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-04-05T00:26:40Z"
    },
    {
      audit: { score: 31, score_old: 31, score_change: 0, issues: { new: 0, total: 10, fixed: 0 },
        report_type: "none_fixed_no_new", from_date: "2026-03-21", to_date: "2026-03-28",
        highest_impact: [
          { count: 1, difficulty: "moderate", seo_impact: "high", id: "have_sitemap", level: "domain" },
          { count: 1, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 3, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-03-29T00:29:43Z"
    },
  ],

  "snarkypets.com": [
    {
      audit: { score: 78, score_old: 78, score_change: 0, issues: { new: 8, total: 227, fixed: 0 },
        report_type: "none_fixed_new", from_date: "2026-03-28", to_date: "2026-04-04",
        highest_impact: [
          { count: 8, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-04-05T00:26:40Z"
    },
    {
      audit: { score: 78, score_old: 78, score_change: 0, issues: { new: 1, total: 219, fixed: 1 },
        report_type: "some_fixed_new", from_date: "2026-03-21", to_date: "2026-03-28",
        highest_impact: [
          { count: 7, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-03-29T00:29:43Z"
    },
    {
      audit: { score: 78, score_old: 78, score_change: 0, issues: { new: 9, total: 219, fixed: 0 },
        report_type: "none_fixed_new", from_date: "2026-03-14", to_date: "2026-03-21",
        highest_impact: [
          { count: 8, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-03-22T00:30:21Z"
    },
    {
      audit: { score: 78, score_old: 78, score_change: 0, issues: { new: 3, total: 210, fixed: 1 },
        report_type: "some_fixed_new", from_date: "2026-03-07", to_date: "2026-03-14",
        highest_impact: [
          { count: 7, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-03-15T00:37:39Z"
    },
    {
      audit: { score: 78, score_old: 78, score_change: 0, issues: { new: 6, total: 208, fixed: 0 },
        report_type: "none_fixed_new", from_date: "2026-02-28", to_date: "2026-03-07",
        highest_impact: [
          { count: 8, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "duplicate_meta_descriptions", level: "page" },
          { count: 4, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-03-08T00:34:03Z"
    },
  ],

  "oxisuretechsolutions.com": [
    {
      audit: { score: 77, score_old: 77, score_change: 0, issues: { new: 12, total: 93, fixed: 0 },
        report_type: "none_fixed_new", from_date: "2026-03-28", to_date: "2026-04-04",
        highest_impact: [
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "page_allowed", level: "page" },
        ]
      },
      keywords: [
        { keyword: "how to clean oxygen tubing", volume: 110, desktop_old: null, desktop_new: 49, desktop_change: null },
      ],
      keyword_report_type: "improved", date: "2026-04-05T00:26:40Z"
    },
    {
      audit: { score: 77, score_old: 77, score_change: 0, issues: { new: 12, total: 93, fixed: 0 },
        report_type: "none_fixed_new", from_date: "2026-03-14", to_date: "2026-03-21",
        highest_impact: [
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "page_allowed", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-03-22T00:30:21Z"
    },
    {
      audit: { score: 77, score_old: 77, score_change: 0, issues: { new: 7, total: 81, fixed: 0 },
        report_type: "none_fixed_new", from_date: "2026-03-07", to_date: "2026-03-14",
        highest_impact: [
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "page_allowed", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-03-15T00:37:39Z"
    },
    {
      audit: { score: 77, score_old: 77, score_change: 0, issues: { new: 14, total: 74, fixed: 5 },
        report_type: "some_fixed_new", from_date: "2026-02-28", to_date: "2026-03-07",
        highest_impact: [
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "content_count_words", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "have_title_duplicates", level: "page" },
          { count: 2, difficulty: "moderate", seo_impact: "high", id: "page_allowed", level: "page" },
        ]
      },
      keywords: [], keyword_report_type: null, date: "2026-03-08T00:34:02Z"
    },
  ],

  "fatherfigureformula.com": [
    { audit: { score: null, score_old: null, score_change: null, issues: null, report_type: null, from_date: null, to_date: null, highest_impact: null },
      keywords: [], keyword_report_type: null, date: "2026-02-28T22:02:40Z" },
  ],

  "serenityscrolls.faith": [
    { audit: { score: null, score_old: null, score_change: null, issues: null, report_type: null, from_date: null, to_date: null, highest_impact: null },
      keywords: [], keyword_report_type: null, date: "2026-02-28T22:05:37Z" },
  ],
};

// All tracked keywords from /api/projects endpoint
const projectKeywords = {
  "blingybag.com": { used: 9, limit: 150, keywords: ["bling crossbody bag","bling purses","bling handbags","handbag bling","bling bags","bling bling bag","bling purse","bling bling bags","handbags bling and more"] },
  "snarkypets.com": { used: 1, limit: 150, keywords: ["how to make cardboard house for cats"] },
  "oxisuretechsolutions.com": { used: 1, limit: 150, keywords: ["how to clean oxygen tubing"] },
  "sienvi.com": { used: 4, limit: 150, keywords: ["ai","automations","ai agents","agents"] },
  "serenityscrolls.faith": { used: 0, limit: 150, keywords: [] },
  "fatherfigureformula.com": { used: 0, limit: 150, keywords: [] },
};

async function seed() {
  console.log("🗑️  Clearing old SEO metrics...");
  await supabase.from('report_seo_metrics').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { data: configs } = await supabase.from('client_seo_config').select('client_id, domain');
  console.log("📋 Mapped domains:", configs.map(c => c.domain).join(", "));

  let totalInserted = 0;

  for (const [domain, weeks] of Object.entries(allData)) {
    const match = configs.find(c => c.domain === domain);
    if (!match) { console.log(`⚠️  ${domain} — no mapping, skipping`); continue; }

    const kwInfo = projectKeywords[domain] || { used: 0, limit: 150, keywords: [] };

    for (const week of weeks) {
      const { error } = await supabase.from('report_seo_metrics').insert({
        client_id: match.client_id,
        site_audit_score: week.audit.score,
        site_audit_issues: {
          ...(week.audit.issues || {}),
          highest_impact: week.audit.highest_impact,
          score_old: week.audit.score_old,
          score_change: week.audit.score_change,
          report_type: week.audit.report_type,
          from_date: week.audit.from_date,
          to_date: week.audit.to_date,
          keyword_report_type: week.keyword_report_type,
          all_tracked_keywords: kwInfo.keywords,
          keyword_quota: { used: kwInfo.used, limit: kwInfo.limit },
        },
        tracked_keywords: week.keywords,
        collected_at: week.date,
      });

      if (error) {
        console.error(`   ❌ ${domain} (${week.date}):`, error.message);
      } else {
        totalInserted++;
      }
    }
    console.log(`   ✅ ${domain} — ${weeks.length} weeks seeded`);
  }

  console.log(`\n🎉 Done! ${totalInserted} total rows inserted.`);
}

seed();
