import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is master
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Allow masters OR users with admin.database / admin.system permission
    const { data: isMaster } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'master' });
    const { data: hasDbPerm } = await supabase.rpc('has_permission', { _user_id: user.id, _permission: 'admin.database' });
    const { data: hasSysPerm } = await supabase.rpc('has_permission', { _user_id: user.id, _permission: 'admin.system' });
    if (!isMaster && !hasDbPerm && !hasSysPerm) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const issues: Array<{ table: string; issue: string; severity: 'warning' | 'error'; count: number }> = [];

    // 1. Orders referencing non-existent projects
    const { data: orphanedOrders } = await supabase.rpc('check_orphaned_orders').catch(() => ({ data: null }));
    // Fallback: manual check
    const { data: orders } = await supabase.from('measurement_orders').select('id, project_id');
    const { data: projects } = await supabase.from('projects').select('id');
    if (orders && projects) {
      const projectIds = new Set(projects.map(p => p.id));
      const orphaned = orders.filter(o => !projectIds.has(o.project_id));
      if (orphaned.length > 0) {
        issues.push({ table: 'measurement_orders', issue: 'Aufträge ohne gültiges Projekt', severity: 'error', count: orphaned.length });
      }
    }

    // 2. Measurements referencing non-existent orders
    const { data: measurements } = await supabase.from('order_measurements').select('id, order_id');
    if (measurements && orders) {
      const orderIds = new Set(orders.map(o => o.id));
      const orphaned = measurements.filter(m => !orderIds.has(m.order_id));
      if (orphaned.length > 0) {
        issues.push({ table: 'order_measurements', issue: 'Messungen ohne gültigen Auftrag', severity: 'error', count: orphaned.length });
      }
    }

    // 3. Samples referencing non-existent projects
    const { data: samples } = await supabase.from('samples').select('id, project_id');
    if (samples && projects) {
      const projectIds = new Set(projects.map(p => p.id));
      const orphaned = samples.filter(s => !projectIds.has(s.project_id));
      if (orphaned.length > 0) {
        issues.push({ table: 'samples', issue: 'Proben ohne gültiges Projekt', severity: 'error', count: orphaned.length });
      }
    }

    // 4. Profiles without user_roles
    const { data: profiles } = await supabase.from('profiles').select('user_id');
    const { data: userRoles } = await supabase.from('user_roles').select('user_id');
    if (profiles && userRoles) {
      const roleUserIds = new Set(userRoles.map(r => r.user_id));
      const missing = profiles.filter(p => !roleUserIds.has(p.user_id));
      if (missing.length > 0) {
        issues.push({ table: 'profiles', issue: 'Benutzer ohne Rollenzuweisung', severity: 'warning', count: missing.length });
      }
    }

    // 5. Work logs referencing non-existent measurements
    const { data: workLogs } = await supabase.from('work_logs').select('id, order_measurement_id');
    if (workLogs && measurements) {
      const measurementIds = new Set(measurements.map(m => m.id));
      const orphaned = workLogs.filter(w => !measurementIds.has(w.order_measurement_id));
      if (orphaned.length > 0) {
        issues.push({ table: 'work_logs', issue: 'Arbeitsprotokolle ohne gültige Messung', severity: 'error', count: orphaned.length });
      }
    }

    // 6. Table row counts
    const tableCounts: Record<string, number> = {
      projects: projects?.length ?? 0,
      measurement_orders: orders?.length ?? 0,
      order_measurements: measurements?.length ?? 0,
      samples: samples?.length ?? 0,
      profiles: profiles?.length ?? 0,
      work_logs: workLogs?.length ?? 0,
    };

    // Additional counts
    const { data: services } = await supabase.from('measurement_services').select('id');
    const { data: templates } = await supabase.from('measurement_templates').select('id');
    const { data: rawMaterials } = await supabase.from('raw_materials').select('id');
    const { data: consumables } = await supabase.from('consumables').select('id');
    const { data: workstations } = await supabase.from('workstations').select('id');
    const { data: results } = await supabase.from('measurement_results').select('id');

    tableCounts.measurement_services = services?.length ?? 0;
    tableCounts.measurement_templates = templates?.length ?? 0;
    tableCounts.raw_materials = rawMaterials?.length ?? 0;
    tableCounts.consumables = consumables?.length ?? 0;
    tableCounts.workstations = workstations?.length ?? 0;
    tableCounts.measurement_results = results?.length ?? 0;

    const response = {
      checked_at: new Date().toISOString(),
      issues,
      table_counts: tableCounts,
      total_issues: issues.length,
      total_errors: issues.filter(i => i.severity === 'error').length,
      total_warnings: issues.filter(i => i.severity === 'warning').length,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
