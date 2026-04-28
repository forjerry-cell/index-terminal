const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkConfig() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('indices')
    .select('*')
    .eq('id', 'system_config_strategies')
    .single();

  if (error) {
    console.error('Error fetching config:', error.message);
  } else {
    console.log('Config found:', data);
  }
}

checkConfig();
