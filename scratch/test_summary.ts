import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://mhuxrnxajtiwxauhlhlv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odXhybnhhanRpd3hhdWhsaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTM3MDcsImV4cCI6MjA4NzUyOTcwN30.aWETGhjGNrihD6OrKq-tctQnDFxu8XCjgsFmv77-m9E"; // Anon key

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Finding FFF client...");
    const { data: clients } = await supabase.from("clients").select("id, name").ilike("name", "%Father Figure%");
    
    if (!clients || clients.length === 0) {
        console.error("Client not found");
        return;
    }
    
    const fff = clients[0];
    console.log("Found client:", fff.name, fff.id);
    
    console.log("Invoking generate-analytics-summary for website type...");
    const { data, error } = await supabase.functions.invoke("generate-analytics-summary", {
        body: { clientId: fff.id, type: "website", dateRange: "7d" }
    });
    
    if (error) {
        console.error("Invocation error:", error);
    } else {
        console.log("Response:", JSON.stringify(data, null, 2));
    }
}

test();
