'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  staff_role: string;
  is_active: boolean;
  team_assignment: string;
  availability: Record<string, boolean>; // { "monday": true, "tuesday": false, ... }
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export default function StaffPage() {
  const supabase = createClient();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('cleaner');
  const [formTeam, setFormTeam] = useState('');
  const [formAvailability, setFormAvailability] = useState<Record<string, boolean>>(
    Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, true]))
  );
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from('staff_members').select('*').order('name');
    if (data) setStaff(data as StaffMember[]);
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
    loadStaff();
  }, [supabase, loadStaff]);

  const resetForm = () => {
    setFormName(''); setFormEmail(''); setFormPhone(''); setFormRole('cleaner'); setFormTeam('');
    setFormAvailability(Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, true])));
    setEditId(null);
  };

  const openEdit = (s: StaffMember) => {
    setFormName(s.name); setFormEmail(s.email); setFormPhone(s.phone); setFormRole(s.staff_role);
    setFormTeam(s.team_assignment || '');
    setFormAvailability(s.availability || Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, true])));
    setEditId(s.id); setShowAdd(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !orgId) return;
    setSaving(true);
    const data = {
      org_id: orgId, name: formName.trim(), email: formEmail, phone: formPhone,
      staff_role: formRole, team_assignment: formTeam, availability: formAvailability,
    };
    if (editId) { await supabase.from('staff_members').update(data).eq('id', editId); }
    else { await supabase.from('staff_members').insert(data); }
    setSaving(false); setShowAdd(false); resetForm(); loadStaff();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('staff_members').update({ is_active: !current }).eq('id', id);
    loadStaff();
  };

  const toggleDayAvailability = async (staffId: string, day: string, currentAvail: Record<string, boolean>) => {
    const updated = { ...currentAvail, [day]: !currentAvail[day] };
    await supabase.from('staff_members').update({ availability: updated }).eq('id', staffId);
    loadStaff();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this staff member?')) return;
    await supabase.from('staff_members').delete().eq('id', id);
    loadStaff();
  };

  const active = staff.filter((s) => s.is_active);
  const inactive = staff.filter((s) => !s.is_active);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 border-b border-border-light bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Staff Roster</h1>
            <p className="text-sm text-text-secondary mt-0.5">{active.length} active · {inactive.length} inactive</p>
          </div>
          <button onClick={() => { resetForm(); setShowAdd(true); }} className="btn-primary text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Staff
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="shimmer h-20 rounded-xl" />)}</div>
        ) : staff.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto mb-4 text-2xl">🧑‍🤝‍🧑</div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">No staff yet</h3>
            <p className="text-xs text-text-tertiary max-w-[280px] mx-auto">Add your team members to assign them to teams and track availability.</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {[...active, ...inactive].map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={`card group ${!s.is_active ? 'opacity-50' : ''}`}>
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${s.is_active ? 'bg-primary' : 'bg-text-tertiary'}`}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-text-primary">{s.name}</h3>
                          {s.team_assignment && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-light text-primary font-medium">
                              {s.team_assignment}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-text-tertiary capitalize">{s.staff_role.replace('_', ' ')}</span>
                          {s.email && <span className="text-xs text-text-tertiary">· {s.email}</span>}
                          {s.phone && <span className="text-xs text-text-tertiary">· {s.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-text-tertiary transition-transform ${expandedId === s.id ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button onClick={(e) => { e.stopPropagation(); toggleActive(s.id, s.is_active); }} className="p-2 rounded-lg hover:bg-surface-hover text-text-tertiary transition-colors text-xs" title={s.is_active ? 'Deactivate' : 'Activate'}>
                          {s.is_active ? '⏸' : '▶️'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-2 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors" title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="p-2 rounded-lg hover:bg-danger-light text-text-tertiary hover:text-danger transition-colors" title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded availability view */}
                <AnimatePresence>
                  {expandedId === s.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="border-t border-border-light pt-3">
                          <div className="text-xs font-semibold text-text-secondary mb-2">Weekly Availability</div>
                          <div className="flex gap-1.5">
                            {DAYS_OF_WEEK.map((day) => {
                              const avail = s.availability?.[day] ?? true;
                              return (
                                <button
                                  key={day}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDayAvailability(s.id, day, s.availability || Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, true])));
                                  }}
                                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                                    avail
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-red-50 text-red-400 border border-red-100'
                                  }`}
                                  title={`${DAY_LABELS[day]}: ${avail ? 'Available' : 'Unavailable'}`}
                                >
                                  {DAY_LABELS[day]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowAdd(false); resetForm(); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="card-elevated p-6 w-full max-w-[460px]" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-text-primary mb-4">{editId ? 'Edit Staff' : 'Add Staff Member'}</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="input-field" placeholder="Full name" autoFocus /></div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label><input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="input-field" placeholder="email@example.com" /></div>
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Phone</label><input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="input-field" placeholder="0400 000 000" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Role</label>
                    <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="input-field">
                      <option value="cleaner">Cleaner</option><option value="team_lead">Team Lead</option><option value="supervisor">Supervisor</option>
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Team Assignment</label>
                    <input type="text" value={formTeam} onChange={(e) => setFormTeam(e.target.value)} className="input-field" placeholder="e.g. Team 1" />
                  </div>
                </div>

                {/* Availability toggles */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Weekly Availability</label>
                  <div className="flex gap-1.5">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setFormAvailability({ ...formAvailability, [day]: !formAvailability[day] })}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          formAvailability[day]
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-400 border border-red-100'
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button onClick={handleSave} disabled={!formName.trim() || saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-40">{saving ? 'Saving...' : editId ? 'Save' : 'Add'}</button>
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
