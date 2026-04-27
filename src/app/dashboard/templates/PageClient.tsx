'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface Template {
  id: string;
  name: string;
  label: string;
  created_at: string;
}

export default function TemplatesPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase.from('schedule_templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data);
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
    loadTemplates();
  }, [supabase, loadTemplates]);

  const resetForm = () => { setFormName(''); setFormLabel(''); setEditId(null); };

  const handleSave = async () => {
    if (!formName.trim() || !orgId) return;
    setSaving(true);
    const data = { org_id: orgId, name: formName.trim(), label: formLabel };
    if (editId) { await supabase.from('schedule_templates').update(data).eq('id', editId); }
    else { await supabase.from('schedule_templates').insert(data); }
    setSaving(false); setShowAdd(false); resetForm(); loadTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    await supabase.from('schedule_templates').delete().eq('id', id);
    loadTemplates();
  };

  const ROTATION_LABELS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 border-b border-border-light bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Schedule Templates</h1>
            <p className="text-sm text-text-secondary mt-0.5">{templates.length} template{templates.length !== 1 ? 's' : ''} · 4-week rotation</p>
          </div>
          <button onClick={() => { resetForm(); setShowAdd(true); }} className="btn-primary text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Template
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {/* 4-Week rotation grid */}
        {templates.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">4-Week Rotation</h2>
            <div className="grid grid-cols-4 gap-2">
              {ROTATION_LABELS.map((label) => {
                const match = templates.find((t) => t.label === label);
                return (
                  <div key={label} className={`rounded-xl p-3 text-center border ${match ? 'bg-primary-light border-primary-border' : 'bg-surface-elevated border-border-light'}`}>
                    <div className={`text-xs font-bold ${match ? 'text-primary' : 'text-text-tertiary'}`}>{label}</div>
                    <div className="text-xs mt-1 text-text-secondary truncate">{match?.name || '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="shimmer h-20 rounded-xl" />)}</div>
        ) : templates.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto mb-4 text-2xl">📋</div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">No templates yet</h3>
            <p className="text-xs text-text-tertiary max-w-[280px] mx-auto">Save your weekly schedules as templates for easy 4-week rotation management.</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {templates.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card p-4 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {t.label && (
                      <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {t.label}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{t.name}</h3>
                      <p className="text-xs text-text-tertiary mt-0.5">Created {new Date(t.created_at).toLocaleDateString('en-AU')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setFormName(t.name); setFormLabel(t.label); setEditId(t.id); setShowAdd(true); }} className="p-2 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors" title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-danger-light text-text-tertiary hover:text-danger transition-colors" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
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
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="card-elevated p-6 w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-text-primary mb-4">{editId ? 'Edit Template' : 'New Template'}</h2>
              <div className="space-y-4">
                <div><label className="block text-sm font-medium text-text-secondary mb-1.5">Template name</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="input-field" placeholder="e.g. Week A — Regular" autoFocus /></div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Rotation label</label>
                  <div className="flex flex-wrap gap-2">
                    {ROTATION_LABELS.map((label) => (
                      <button key={label} onClick={() => setFormLabel(formLabel === label ? '' : label)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${formLabel === label ? 'bg-primary text-white border-primary' : 'bg-surface-elevated text-text-secondary border-border-light hover:border-primary'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={handleSave} disabled={!formName.trim() || saving} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-40">{saving ? 'Saving...' : editId ? 'Save' : 'Create'}</button>
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
