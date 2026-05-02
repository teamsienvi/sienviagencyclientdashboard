const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env" });

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
  
  const { data: roles } = await supabase.from("user_roles").select("*").eq("user_id", snarkyUser.id);
  console.log("Roles:", roles);
  
  const { data: mappings } = await supabase.from("client_users").select("client_id, clients(name)").eq("user_id", snarkyUser.id);
  console.log("Client Mappings:", JSON.stringify(mappings, null, 2));
}

run();
