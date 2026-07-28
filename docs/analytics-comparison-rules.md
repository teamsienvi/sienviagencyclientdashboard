# Social Media Analytics Week-over-Week (WoW) Performance Rules

## 1. Overview
This document defines the comparison semantics, data contracts, and storytelling rules for the Sienvi Agency Client Dashboard social analytics comparison engine.

## 2. Comparison Model
- **7-Day View (`7d`)**: Compares Current 7 Days (e.g. Mon–Sun or matching elapsed weekdays) vs. Previous 7 Days.
- **14-Day View (`14d`)**: Dedicated **Week-over-Week Split Mode** that compares **Week 2 (Current 7 Days)** vs. **Week 1 (Previous 7 Days)** instead of aggregating into a single 14-day blob.
- **Custom & Larger Horizons (`30d`, `60d`, `90d`, `365d`, `custom`)**: Compares against the immediately preceding equal-length period.

## 3. Metrics & Delta Math
- **Views / Reach**: Normalized total video views / impressions.
  - `Absolute Delta` = $\text{Current Views} - \text{Previous Views}$
  - `Relative Delta (%)` = $\frac{\text{Current Views} - \text{Previous Views}}{\text{Previous Views}} \times 100$
- **Engagement Rate (ER)**:
  - `Denominator`: $\text{Total Engagements} \div \text{Total Views}$
  - `Percentage-Point Delta (pp)` = $\text{Current ER \%} - \text{Previous ER \%}$ (e.g. $4.2\% - 3.0\% = +1.2\text{ pp}$).
- **Net Follower Change**: Net follower gain during period.
- **Combined Followers**: Total channel audience count.

## 4. Drivers & Leadership Criteria
- **Scale Leader**: Channel with the largest current view volume.
- **Efficiency Leader**: Channel with the highest Engagement Rate, requiring a minimum sample of 50 views to avoid low-sample skew.
- **Low-Volume Warning**: Triggered when a channel has ER $> 10\%$ but fewer than 50 views.

## 5. Storytelling & Recommendation Rules
- **Executive Summary**: Generated strictly from empirical metrics and post metadata. Never invents unsupported causes.
- **Deterministic Recommendations**:
  1. *Restore Posting Consistency*: Triggered when post volume dropped and views decreased.
  2. *Repeat Content Format*: Triggered when a single post accounts for $\ge 20\%$ of total reach.
  3. *Optimize Conversion*: Triggered when interactions are high ($> 50$) but net follower gain is low ($\le 2$).
  4. *Scale High-Efficiency Channel*: Triggered when a channel has high ER ($\ge 5\%$) but low reach share ($< 15\%$).

## 6. Accessibility & Data Integrity
- Positive/negative changes use explicit directional arrows (`↑`, `↓`, `→`), text labels (`Increase`, `Decline`), and line styles (solid current vs. dashed prior) in addition to contrast-safe colors.
- Zero activity, missing data, delayed sync, and disconnected accounts are treated as distinct states.
