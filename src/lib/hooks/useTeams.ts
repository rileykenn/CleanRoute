'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TeamSchedule, TEAM_COLORS, TravelSegment } from '@/lib/types';

interface DbTeam {
  id: string;
  org_id: string;
  name: string;
  color_index: number;
  base_address: string | null;
  base_lat: number | null;
  base_lng: number | null;
  base_place_id: string | null;
  day_start_time: string;
  hourly_rate: number;
  fuel_efficiency: number;
  fuel_price: number;
  per_km_rate: number;
  sort_order: number;
}

/**
 * Hook to load and manage teams from Supabase.
 * Returns the teams list and CRUD operations.
 */
export function useTeams() {
  const supabase = createClient();
  const [teams, setTeams] = useState<TeamSchedule[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user's org ID
  useEffect(() => {
    const loadOrg = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .single();
        if (profile) setOrgId(profile.org_id);
      }
    };
    loadOrg();
  }, [supabase]);

  // Convert DB row to TeamSchedule
  const dbToTeam = useCallback((row: DbTeam): TeamSchedule => ({
    id: row.id,
    name: row.name,
    color: TEAM_COLORS[row.color_index % TEAM_COLORS.length],
    baseAddress: row.base_address ? {
      address: row.base_address,
      lat: row.base_lat || 0,
      lng: row.base_lng || 0,
      placeId: row.base_place_id || undefined,
    } : null,
    clients: [],
    travelSegments: new Map<string, TravelSegment>(),
    dayStartTime: row.day_start_time || '08:00',
    breaks: [],
    hourlyRate: Number(row.hourly_rate) || 38,
    fuelEfficiency: Number(row.fuel_efficiency) || 10,
    fuelPrice: Number(row.fuel_price) || 1.85,
    perKmRate: Number(row.per_km_rate) || 0,
  }), []);

  // Load teams from Supabase
  const loadTeams = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order');
    if (data && data.length > 0) {
      setTeams(data.map(dbToTeam));
    }
    setLoading(false);
  }, [supabase, orgId, dbToTeam]);

  useEffect(() => {
    if (orgId) loadTeams();
  }, [orgId, loadTeams]);

  // Add a new team
  const addTeam = useCallback(async () => {
    if (!orgId) return null;
    const colorIndex = teams.length % TEAM_COLORS.length;
    const { data, error } = await supabase
      .from('teams')
      .insert({
        org_id: orgId,
        name: `Team ${teams.length + 1}`,
        color_index: colorIndex,
        sort_order: teams.length,
        // Copy base address from first team
        ...(teams[0]?.baseAddress ? {
          base_address: teams[0].baseAddress.address,
          base_lat: teams[0].baseAddress.lat,
          base_lng: teams[0].baseAddress.lng,
          base_place_id: teams[0].baseAddress.placeId || null,
        } : {}),
      })
      .select()
      .single();
    if (data && !error) {
      const newTeam = dbToTeam(data);
      setTeams((prev) => [...prev, newTeam]);
      return newTeam;
    }
    return null;
  }, [supabase, orgId, teams, dbToTeam]);

  // Remove a team
  const removeTeam = useCallback(async (teamId: string) => {
    if (teams.length <= 1) return;
    await supabase.from('teams').delete().eq('id', teamId);
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  }, [supabase, teams.length]);

  // Update team settings (debounced save to Supabase)
  const updateTeam = useCallback(async (teamId: string, updates: Partial<TeamSchedule>) => {
    // Update local state immediately
    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, ...updates } : t));

    // Build DB update
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.dayStartTime !== undefined) dbUpdates.day_start_time = updates.dayStartTime;
    if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
    if (updates.fuelEfficiency !== undefined) dbUpdates.fuel_efficiency = updates.fuelEfficiency;
    if (updates.fuelPrice !== undefined) dbUpdates.fuel_price = updates.fuelPrice;
    if (updates.perKmRate !== undefined) dbUpdates.per_km_rate = updates.perKmRate;
    if (updates.baseAddress !== undefined) {
      if (updates.baseAddress) {
        dbUpdates.base_address = updates.baseAddress.address;
        dbUpdates.base_lat = updates.baseAddress.lat;
        dbUpdates.base_lng = updates.baseAddress.lng;
        dbUpdates.base_place_id = updates.baseAddress.placeId || null;
      } else {
        dbUpdates.base_address = null;
        dbUpdates.base_lat = null;
        dbUpdates.base_lng = null;
        dbUpdates.base_place_id = null;
      }
    }

    if (Object.keys(dbUpdates).length > 0) {
      await supabase.from('teams').update(dbUpdates).eq('id', teamId);
    }
  }, [supabase]);

  return {
    teams,
    setTeams,
    orgId,
    loading,
    addTeam,
    removeTeam,
    updateTeam,
    reloadTeams: loadTeams,
  };
}
