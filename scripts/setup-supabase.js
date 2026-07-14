require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupBucket() {
  console.log('Checking Supabase bucket...');
  
  // Try to create the bucket
  const { data, error } = await supabase.storage.createBucket('memories', {
    public: true,
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('Bucket "memories" already exists. Ensuring it is public...');
      await supabase.storage.updateBucket('memories', {
        public: true,
      });
      console.log('Bucket "memories" updated to public.');
    } else {
      console.error('Error creating bucket:', error);
    }
  } else {
    console.log('Bucket "memories" created successfully and set to public!');
  }
}

setupBucket();
