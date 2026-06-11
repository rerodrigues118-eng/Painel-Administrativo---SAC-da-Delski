const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pcejljmykywpkrztiwpb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjZWpsam15a3l3cGtyenRpd3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDI2ODQ2MywiZXhwIjoyMDk1ODQ0NDYzfQ.ROUBEHT1cA1GsMG5PTW8k_Qp2JI5PVkc7eEFNy0lDj8'
);

async function check() {
  console.log("Checking leads_site table...");
  const { data, error } = await supabase.from('leads_site').select('*').limit(1);
  if (error) {
    console.error("Error fetching leads_site:", error);
  } else {
    console.log("leads_site data:", data);
  }
}

check();
