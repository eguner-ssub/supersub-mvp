import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Force absolute path resolution for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
    // Ensure we read the JSON from the root folder
    const rawData = fs.readFileSync(path.resolve(__dirname, '../type_ids.json'), 'utf8');
    const types = JSON.parse(rawData);

    const rows = types.map(t => ({
        key: `type:${t.id}`,
        value: t,
        cached_at: new Date().toISOString()
    }));

    const { error } = await supabase
        .from('reference_cache')
        .upsert(rows, { onConflict: 'key' });

    if (error) console.error("Injection failed:", error);
    else console.log(`Successfully injected ${rows.length} Core Types into reference_cache.`);
}

seed();