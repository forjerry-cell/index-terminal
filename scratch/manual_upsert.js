const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://nnoazshcucwjlccjqtkl.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjcwODM3NiwiZXhwIjoyMDkyMjg0Mzc2fQ.I8a52o8zRHAgTD4l143dGemh0Xm16IsYIAQ2t9LR9sMz6g";

async function run() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error } = await supabase.from('indices').upsert({ 
    id: 'system_config_strategies', 
    name: '系統管理配置', 
    description: 'B02,C01,C05,D01,D02,D04,D042,E02,E03,E031,F06,F061,G01,X04,X041,X05,Y02,Z01,Z06,Z061' 
  });
  if (error) console.error(error);
  else console.log('Success');
}
run();
