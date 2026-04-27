'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Client } from '@/lib/types';

interface DbJob {
  id: string;
  schedule_id: string;
  org_id: string;
  client_id: string | null;
  position: number;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  duration_minutes: number;
  staff_count: number;
  is_locked: boolean;
  is_break: boolean;
  break_label: string;
  notes: string;
  start_time: string | null;
  end_time: string | null;
}

/**
 * Hook to load and persist schedule jobs for a given team + date.
 * Handles auto-save with debouncing.
 */
export function useScheduleJobs(teamId: string | null, scheduleDate: string, orgId: string | null) {
  const supabase = createClient();
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialClients, setInitialClients] = useState<Client[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Convert DB job to Client
  const dbToClient = useCallback((row: DbJob): Client => ({
    id: row.id,
    name: row.name,
    location: {
      address: row.address || '',
      lat: row.lat || 0,
      lng: row.lng || 0,
      placeId: row.place_id || undefined,
    },
    jobDurationMinutes: Number(row.duration_minutes) || 90,
    staffCount: row.staff_count || 1,
    isLocked: row.is_locked || false,
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    notes: row.notes || undefined,
    savedClientId: row.client_id || undefined,
  }), []);

  // Get or create schedule for this team+date
  const ensureSchedule = useCallback(async (): Promise<string | null> => {
    if (!teamId || !orgId) return null;

    // Check if schedule already exists
    const { data: existing } = await supabase
      .from('schedules')
      .select('id')
      .eq('team_id', teamId)
      .eq('schedule_date', scheduleDate)
      .single();

    if (existing) return existing.id;

    // Create new schedule
    const { data: created } = await supabase
      .from('schedules')
      .insert({
        org_id: orgId,
        team_id: teamId,
        schedule_date: scheduleDate,
      })
      .select('id')
      .single();

    return created?.id || null;
  }, [supabase, teamId, orgId, scheduleDate]);

  // Load jobs for this schedule
  const loadJobs = useCallback(async () => {
    if (!teamId || !orgId) { setLoading(false); return; }

    const sid = await ensureSchedule();
    setScheduleId(sid);

    if (!sid) { setLoading(false); return; }

    const { data } = await supabase
      .from('schedule_jobs')
      .select('*')
      .eq('schedule_id', sid)
      .order('position');

    if (data) {
      setInitialClients(data.filter((j: DbJob) => !j.is_break).map(dbToClient));
    }
    setLoading(false);
  }, [supabase, teamId, orgId, ensureSchedule, dbToClient]);

  useEffect(() => {
    setLoading(true);
    loadJobs();
  }, [loadJobs]);

  // Save clients to Supabase (debounced)
  const saveClients = useCallback(async (clients: Client[]) => {
    if (!scheduleId || !orgId) return;

    // Cancel previous pending save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      // Delete existing jobs and re-insert
      await supabase
        .from('schedule_jobs')
        .delete()
        .eq('schedule_id', scheduleId);

      if (clients.length === 0) return;

      const rows = clients.map((c, i) => ({
        schedule_id: scheduleId,
        org_id: orgId,
        client_id: c.savedClientId || null,
        position: i,
        name: c.name,
        address: c.location.address,
        lat: c.location.lat,
        lng: c.location.lng,
        place_id: c.location.placeId || null,
        duration_minutes: c.jobDurationMinutes,
        staff_count: c.staffCount || 1,
        is_locked: c.isLocked || false,
        is_break: false,
        notes: c.notes || '',
        start_time: c.startTime || null,
        end_time: c.endTime || null,
      }));

      await supabase.from('schedule_jobs').insert(rows);

      // Update schedule timestamp
      await supabase
        .from('schedules')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', scheduleId);
    }, 1500); // 1.5s debounce
  }, [supabase, scheduleId, orgId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return {
    scheduleId,
    initialClients,
    loading,
    saveClients,
    reloadJobs: loadJobs,
  };
}
