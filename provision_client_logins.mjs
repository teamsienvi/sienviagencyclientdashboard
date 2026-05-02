/**
 * Provision client logins for the SIENVI Agency Dashboard.
 *
 * Creates 3 Supabase auth users and maps them to the correct clients:
 *   1. snarky@sienvi.com       → Snarky Humans, Snarky Pets, BlingyBag
 *   2. serenityscrolls@sienvi.com → Serenity Scrolls
 *   3. oxisuretech@sienvi.com     → OxiSure Tech
 *
 * Usage:  node provision_client_logins.mjs
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ── Config ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Generate a random 12-char password
const genPassword = () => crypto.randomBytes(9).toString("base64url").slice(0, 12);

// ── Login definitions ───────────────────────────────────────────────
// Each entry: { email, password, clientNames[] }
const logins = [
    {
        email: "snarky@sienvi.com",
        password: genPassword(),
        clientNames: ["Snarky Humans", "Snarky Pets", "Snarky A$$ Humans"],
    },
    {
        email: "serenityscrolls@sienvi.com",
        password: genPassword(),
        clientNames: ["Serenity Scrolls"],
    },
    {
        email: "oxisuretech@sienvi.com",
        password: genPassword(),
        clientNames: ["OxiSure Tech"],
    },
];

// ── Main ────────────────────────────────────────────────────────────
async function main() {
    console.log("🔍  Looking up client IDs...\n");

    // Get all client names we need
    const allNames = logins.flatMap((l) => l.clientNames);
    const { data: clients, error: clientErr } = await supabase
        .from("clients")
        .select("id, name")
        .in("name", allNames);

    if (clientErr) {
        console.error("❌  Error fetching clients:", clientErr.message);
        process.exit(1);
    }

    // Build name → id map
    const nameToId = {};
    for (const c of clients) {
        nameToId[c.name] = c.id;
    }

    // Verify all clients found
    const missing = allNames.filter((n) => !nameToId[n]);
    if (missing.length > 0) {
        console.error("❌  Could not find these clients in the database:", missing);
        process.exit(1);
    }

    console.log("✅  All clients found:\n");
    for (const [name, id] of Object.entries(nameToId)) {
        console.log(`   ${name} → ${id}`);
    }

    // Build the users payload for the edge function
    // For a shared login, we send multiple entries with the same email/password
    const users = [];
    for (const login of logins) {
        for (const clientName of login.clientNames) {
            users.push({
                email: login.email,
                password: login.password,
                clientId: nameToId[clientName],
                clientName,
            });
        }
    }

    console.log(`\n🚀  Creating ${logins.length} logins (${users.length} user-client mappings)...\n`);

    const { data, error } = await supabase.functions.invoke("create-client-users", {
        body: { users },
    });

    if (error) {
        console.error("❌  Edge function error:", error.message);
        process.exit(1);
    }

    // Print results
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  RESULTS");
    console.log("═══════════════════════════════════════════════════════════════");

    if (data?.results) {
        for (const r of data.results) {
            const icon = r.status === "created" || r.status === "exists" ? "✅" : "❌";
            console.log(`  ${icon}  ${r.email.padEnd(30)} → ${r.status}${r.error ? ` (${r.error})` : ""}`);
        }
    } else {
        console.log("  Raw response:", JSON.stringify(data, null, 2));
    }

    // Print credential summary
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  LOGIN CREDENTIALS (save these!)");
    console.log("═══════════════════════════════════════════════════════════════");
    for (const login of logins) {
        console.log(`\n  📧  Email:    ${login.email}`);
        console.log(`  🔑  Password: ${login.password}`);
        console.log(`  👥  Clients:  ${login.clientNames.join(", ")}`);
    }
    console.log("\n═══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
