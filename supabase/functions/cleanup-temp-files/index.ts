// Supabase Edge Function: cleanup-temp-files
// Schedule via pg_cron or Supabase Cron every 1 minute (* * * * *) to enforce
// mandatory 5-minute physical deletion from Supabase Storage and Postgres records.
// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase server credentials' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();

  // 1. Find expired temporary files
  const { data: expiredFiles, error: fetchError } = await admin
    .from('zone_temp_files')
    .select('id, storage_path')
    .lte('expires_at', nowIso);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  let removedCount = 0;
  if (expiredFiles && expiredFiles.length > 0) {
    const paths = expiredFiles.map((f) => f.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await admin.storage.from('zone-temp-files').remove(paths);
    }

    const ids = expiredFiles.map((f) => f.id);
    await admin
      .from('zone_messages')
      .update({ file_expired: true, temp_file_id: null })
      .in('temp_file_id', ids);

    await admin.from('zone_temp_files').delete().in('id', ids);
    removedCount = ids.length;
  }

  // 2. Clean expired temporary text messages according to room retention
  await admin.from('zone_messages').delete().lte('expires_at', nowIso);

  return new Response(
    JSON.stringify({ ok: true, removedFiles: removedCount, cleanedAt: nowIso }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
