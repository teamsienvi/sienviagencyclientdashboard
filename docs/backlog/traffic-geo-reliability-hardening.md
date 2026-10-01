# Infrastructure Backlog: Traffic Geolocation Acquisition Reliability Hardening

**Item ID:** BACKLOG-ANALYTICS-GEO-RELIABILITY  
**Status:** Open / Proposed  
**Priority:** Medium (Data Enrichment & Analytics Completeness)  
**Component:** Client-Side Tracker (`track-analytics`) & Ingestion Pipeline  
**Created:** 2026-10-01  

---

## 1. Problem Statement & Historical Context

During the production verification and forensics of the PlayIQ analytics dataset, the following empirical facts were established:

1. **Real Browser Acquisition Functional:** When a real user navigates via a modern desktop browser (e.g. Chrome on Windows), the production tracking script's client-side call to `https://ipapi.co/json/` succeeds (`HTTP 200 OK`) and returns a two-letter country code (verified empirically: `country: "PH"` successfully transmitted and stored in the database).
2. **Historical `XX` Defect Identified:** In historical PlayIQ records, 1,985 page views were stored as `country: "XX"`. Forensic testing confirmed that `https://ipapi.co/json/` actively challenges non-interactive bots, datacenter IPs, and privacy-shielded environments with Cloudflare Bot Challenge (`HTTP 403 HTML`). When `ipapi.co` returns non-JSON HTML or times out:
   * The client-side tracker `.catch()` block catches the error and silently sends the tracking payload without `country`.
   * The receiving Supabase Edge Function (`track-analytics`) checks server fallback headers (`cf-ipcountry`, `x-country`, `x-vercel-ip-country`).
   * Because Supabase Edge Functions without custom reverse proxies do not receive Cloudflare country headers from the client's direct connection, all fallback headers are null.
   * As a result, the server defaults the country to `'XX'`.
3. **Safety Guaranteed:** The v2.2 invariant ensures that unknown geography (`geo:unknown`, `XX`) is **never excluded** solely due to missing location data. However, reporting accuracy would benefit from higher resolution country acquisition.

---

## 2. Areas for Future Investigation & Architectural Improvements

### A. Platform-Native CDN & Proxy Country Headers
* **Investigation:** If client storefronts or landing pages proxy analytics requests through Cloudflare, Vercel, or AWS CloudFront, the CDN edge automatically appends validated geo headers:
  * Cloudflare: `CF-IPCountry`
  * Vercel: `x-vercel-ip-country`
  * AWS CloudFront: `CloudFront-Viewer-Country`
* **Objective:** Ensure incoming edge requests preserve and forward these proxy headers so the backend can ingest geographic data without requiring a third-party client-side API call.

---

### B. Server-Side Geo Derivation (MaxMind GeoLite2 / Cloudflare Worker)
* **Investigation:** Move geolocation lookup from the client browser to the edge function server layer.
* **Mechanism:**
  * When `track-analytics` receives an incoming POST request, it inspects the client's IP address (`x-forwarded-for` or socket remote address).
  * Resolve IP to country server-side using an embedded GeoIP database (e.g. MaxMind GeoLite2 MMDB in Deno / WebAssembly) or a dedicated edge middleware.
* **Benefits:** Eliminates client-side network calls, avoids ad-blocker / CORS issues, removes third-party rate limits, and reduces page payload latency.

---

### C. Client Tracker Fallback & Telemetry
* **Investigation:** Enhance the embedded JavaScript tracker in `track-analytics/index.ts`:
  * Add client-side timeout enforcement (e.g. 1,500ms abort controller) so geo lookup never delays page unload beacons.
  * Ingest failure telemetry (e.g. `geo_lookup_status: "rate_limited" | "blocked" | "timeout"`) to provide visibility into why geo resolution was skipped.

---

### D. Privacy & Compliance Considerations
* **Investigation:** Assess compliance implications (GDPR, CCPA) of IP-based geo derivation:
  * Ensure raw IP addresses continue to be masked/redacted in accordance with existing privacy standards (`192.168.1.xxx`).
  * Only persist country code, never high-resolution precision coordinates or personal identifiers.

---

## 3. Scope Boundaries

* **No Immediate Code Changes:** The current v2.2 system is certified for controlled client rollout with the existing observe/exclude model and unknown-geo safety guarantees intact.
* **No Third-Party Geo Providers:** Do not add secondary or tertiary client-side geo providers without architectural review.
