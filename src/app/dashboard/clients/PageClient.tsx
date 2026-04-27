'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface SavedClient {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  default_duration_minutes: number;
  default_staff_count: number;
  notes: string;
  created_at: string;
}

export default function ClientsPage() {
  const supabase = createClient();
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDuration, setFormDuration] = useState(1.5);
  const [formStaff, setFormStaff] = useState(1);
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) setClients(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
        if (p) setOrgId(p.org_id);
      }
    };
    init();
    loadClients();
  }, [supabase, loadClients]);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.phone && c.phone.includes(search))
  );

  const resetForm = () => { setFormName(''); setFormAddress(''); setFormEmail(''); setFormPhone(''); setFormDuration(1.5); setFormStaff(1); setFormNotes(''); setEditId(null); };

  const openEdit = (c: SavedClient) => {
    setFormName(c.name);
    setFormAddress(c.address);
    setFormEmail(c.email || '');
    setFormPhone(c.phone || '');
    setFormDuration(c.default_duration_minutes / 60);
    setFormStaff(c.default_staff_count);
    setFormNotes(c.notes || '');
    setEditId(c.id);
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !orgId) return;
    setSaving(true);
    const data = {
      org_id: orgId, name: formName.trim(), address: formAddress,
      email: formEmail, phone: formPhone,
      default_duration_minutes: Math.round(formDuration * 60),
      default_staff_count: formStaff, notes: formNotes,
    };
    if (editId) { await supabase.from('clients').update(data).eq('id', editId); }
    else { await supabase.from('clients').insert(data); }
    setSaving(false); setShowAdd(false); resetForm(); loadClients();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this client?')) return;
    await supabase.from('clients').delete().eq('id', id);
    loadClients();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 border-b border-border-light bg-white px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Client Database</h1>
            <p className="text-sm text-text-secondary mt-0.5">{clients.length} saved client{clients.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => { resetForm(); setShowAdd(true); }} className="btn-primary text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Client
          </button>
        </div>
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients by name, address, email, or phone..." className="input-field pl-10" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="shimmer h-20 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto mb-4 text-2xl">👥</div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">{search ? 'No matches' : 'No clients yet'}</h3>
            <p className="text-xs text-text-tertiary max-w-[280px] mx-auto">{search ? 'Try a different term' : 'Add clients to quickly schedule them.'}</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card p-4 group">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary">{c.name}</h3>
                    <p className="text-xs text-text-secondary truncate mt-0.5">{c.address || 'No address'}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-text-tertiary">{(c.default_duration_minutes / 60).toFixed(c.default_duration_minutes % 60 === 0 ? 0 : 1)}h</span>
                      <span className="text-xs text-text-tertiary">{c.default_staff_count} staff</span>
                      {c.email && (
                        <span className="text-xs text-text-tertiary flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                          {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="text-xs text-text-tertiary flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                          {c.phone}
                        </span>
                      )}
                      {c.notes && <span className="text-xs text-text-tertiary truncate max-w-[200px]">📝 {c.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors" title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-danger-light text-text-tertiary hover:text-danger transition-colors" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowAdd(false); resetForm(); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="card-elevated p-6 w-full max-w-[460px]" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-text-primary mb-4">{editId ? 'Edit Client' : 'Add New Client'}</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="input-field" placeholder="e.g. Smith Family" autoFocus /></div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Address</label><input type="text" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="input-field" placeholder="123 Main St, Shellharbour" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label><input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="input-field" placeholder="client@email.com" /></div>
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Phone</label><input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="input-field" placeholder="0400 000 000" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Duration (hours)</label><input type="number" value={formDuration} onChange={(e) => setFormDuration(parseFloat(e.target.value) || 0)} className="input-field" min={0.25} step={0.25} /></div>
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Staff</label><select value={formStaff} onChange={(e) => setFormStaff(Number(e.target.value))} className="input-field"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4+</option></select></div>
                </div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Notes</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="input-field resize-none" rows={2} placeholder="Access codes, special instructions..." /></div>
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={handleSave} disabled={!formName.trim() || saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-40">{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Client'}</button>
                  <button onClick={() => { setShowAdd(false); resetForm(); }} className="btn-ghost text-sm">Cancel</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
