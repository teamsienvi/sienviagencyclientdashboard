
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E"; // Anon key

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    console.log("Fetching FFF...");
    const { data: clients } = await supabase.from("clients").select("id, name").ilike("name", "%Father Figure%");
    if (!clients || clients.length === 0) {
        console.log("Client not found");
        return;
    }
    const fffId = clients[0].id;
    console.log("FFF ID:", fffId);

    console.log("Checking Substack Config...");
    const { data: substack } = await supabase.from("client_substack_config").select("*").eq("client_id", fffId);
    console.log("Substack Config:", JSON.stringify(substack, null, 2));

    console.log("Checking Web Page Views (last 30 days)...");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: views, count: viewsCount } = await supabase
        .from("web_analytics_page_views")
        .select("*", { count: 'exact', head: true })
        .eq("client_id", fffId)
        .gte("viewed_at", thirtyDaysAgo.toISOString());
    console.log("Web Views Count:", viewsCount);

    console.log("Checking Sessions...");
    const { data: sessions, count: sessionsCount } = await supabase
        .from("web_analytics_sessions")
        .select("*", { count: 'exact', head: true })
        .eq("client_id", fffId)
        .gte("created_at", thirtyDaysAgo.toISOString());
    console.log("Sessions Count:", sessionsCount);
}

debug();
