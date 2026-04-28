const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://nnoazshcucwjlccjqtkl.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDgzNzYsImV4cCI6MjA5MjI4NDM3Nn0.FE-onwhqZNBWWdUBoqD1lR-n5So9PbQ9BvjB9pWCz6g";

async function run() {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await supabase.from('indices').select('*').limit(1);
  if (error) console.error(error);
  else console.log('Success, data found:', data);
}
run();
