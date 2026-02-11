
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUpload() {
    console.log('--- Testing File Upload to "uploads" ---');

    const fileName = `test-${Date.now()}.txt`;
    const { data, error } = await supabase
        .storage
        .from('uploads')
        .upload(fileName, 'Hello world', {
            upsert: true
        });

    if (error) {
        console.error('❌ Upload Failed:', error.message);
        if (error.message.includes('row-level security policy')) {
            console.log('👉 Hint: The bucket might exist, but the Policy "Allow All" is not set correctly.');
        } else if (error.message.includes('Bucket not found')) {
            console.log('👉 Hint: The bucket name might be wrong or it does not exist.');
        }
    } else {
        console.log('✅ Upload Successful!', data);
        console.log('Cleaning up...');
        await supabase.storage.from('uploads').remove([fileName]);
        console.log('✅ Cleanup Successful');
    }
}

checkUpload();
