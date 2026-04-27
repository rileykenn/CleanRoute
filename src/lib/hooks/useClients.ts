'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface SavedClient {
  id: string;
  org_id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  default_duration_minutes: number;
  default_staff_count: number;
  notes: string;
  created_at: string;
}

/**
 * Hook for CRUD operations on the saved clients database.
 */
export function useClients(orgId: string | null) {
  const supabase = createClient();
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClients = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('org_id', orgId)
      .order('name');
    if (data) setClients(data);
    setLoading(false);
  }, [supabase, orgId]);

  useEffect(() => {
    if (orgId) loadClients();
  }, [orgId, loadClients]);

  const addClient = useCallback(async (client: Omit<SavedClient, 'id' | 'org_id' | 'created_at'>) => {
    if (!orgId) return null;
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...client, org_id: orgId })
      .select()
      .single();
    if (data && !error) {
      setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    }
    return null;
  }, [supabase, orgId]);

  const updateClient = useCallback(async (id: string, updates: Partial<SavedClient>) => {
    const { error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id);
    if (!error) {
      setClients((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
    }
  }, [supabase]);

  const deleteClient = useCallback(async (id: string) => {
    await supabase.from('clients').delete().eq('id', id);
    setClients((prev) => prev.filter((c) => c.id !== id));
  }, [supabase]);

  const searchClients = useCallback((query: string) => {
    if (!query.trim()) return clients;
    const q = query.toLowerCase();
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  }, [clients]);

  return {
    clients,
    loading,
    addClient,
    updateClient,
    deleteClient,
    searchClients,
    reloadClients: loadClients,
  };
}
