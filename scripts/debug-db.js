
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDB() {
    console.log('--- 1. Testing Project Creation (Insert) ---');
    const testId = `debug-${Date.now()}`;
    const { data: insertData, error: insertError } = await supabase
        .from('projects')
        .insert({
            id: testId,
            title: 'Debug Project',
            description: 'Testing RLS',
            status: 'planning'
        })
        .select();

    if (insertError) {
        console.error('❌ Insert Failed:', insertError.message);
        if (insertError.code === '42501') console.error('   -> RLS Policy violation (Permission denied)');
    } else {
        console.log('✅ Insert Successful:', insertData);
    }

    console.log('\n--- 2. Testing Project Fetch (Select Simple) ---');
    const { data: selectData, error: selectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', testId);

    if (selectError) {
        console.error('❌ Select Simple Failed:', selectError.message);
    } else {
        console.log(`✅ Select Simple Successful. Found: ${selectData.length}`);
    }

    console.log('\n--- 3. Testing Project Fetch (Select Join) ---');
    // This matches the query used in getProject
    const { data: joinData, error: joinError } = await supabase
        .from('projects')
        .select(`
        *,
        personas (*),
        studies (
            *,
            interviews: sessions (
                *,
                insights (*)
            )
        )
    `)
        .eq('id', testId)
        .single();

    if (joinError) {
        console.error('❌ Select Join Failed:', joinError.message);
        console.error('   -> Hint: Check Foreign Keys definitions in Supabase.');
    } else {
        console.log('✅ Select Join Successful.');
    }

    // Cleanup
    if (!insertError) {
        await supabase.from('projects').delete().eq('id', testId);
    }
}

debugDB();
