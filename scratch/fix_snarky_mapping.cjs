const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mhuxrnxajtiwxauhlhlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) throw new Error("Need service role key");

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) throw userError;
  
  const snarkyUser = users.users.find(u => u.email === "snarky@sienvi.com");
  if (!snarkyUser) {
    console.log("User snarky@sienvi.com not found!");
    return;
  }
  
  console.log("Found User ID:", snarkyUser.id);

  // Get client IDs
  const { data: clients } = await supabase.from("clients").select("id, name").in("name", ["Snarky Humans", "Snarky Pets", "Snarky A$$ Humans", "BlingyBag"]);
  
  const blingyBag = clients.find(c => c.name === "BlingyBag");
  const snarkyAzz = clients.find(c => c.name === "Snarky A$$ Humans");

  if (blingyBag) {
    console.log("Removing BlingyBag mapping...");
    await supabase.from("client_users").delete().eq("user_id", snarkyUser.id).eq("client_id", blingyBag.id);
  }

  if (snarkyAzz) {
    console.log("Adding Snarky A$$ Humans mapping...");
    const { data: existing } = await supabase.from("client_users").select("id").eq("user_id", snarkyUser.id).eq("client_id", snarkyAzz.id).maybeSingle();
    if (!existing) {
      await supabase.from("client_users").insert({ user_id: snarkyUser.id, client_id: snarkyAzz.id });
    }
  }

  console.log("Done fixing mappings!");
}

run();
