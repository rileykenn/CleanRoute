'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

interface ChecklistItem {
  id: string;
  label: string;
  order: number;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  items: ChecklistItem[];
  created_at: string;
}

export default function ChecklistsPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formItems, setFormItems] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('checklist_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTemplates(data as ChecklistTemplate[]);
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

  const resetForm = () => {
    setFormName('');
    setFormItems(['']);
    setEditId(null);
  };

  const openEdit = (t: ChecklistTemplate) => {
    setFormName(t.name);
    setFormItems(t.items?.map((i) => i.label) || ['']);
    setEditId(t.id);
    setShowAdd(true);
  };

  const addItem = () => setFormItems([...formItems, '']);
  const removeItem = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };
  const updateItem = (index: number, value: string) => {
    const updated = [...formItems];
    updated[index] = value;
    setFormItems(updated);
  };

  const handleSave = async () => {
    if (!formName.trim() || !orgId) return;
    setSaving(true);

    const cleanItems = formItems
      .map((label, i) => label.trim())
      .filter((label) => label.length > 0)
      .map((label, i) => ({ id: `item-${Date.now()}-${i}`, label, order: i }));

    const data = {
      org_id: orgId,
      name: formName.trim(),
      items: cleanItems,
    };

    if (editId) {
      await supabase.from('checklist_templates').update(data).eq('id', editId);
    } else {
      await supabase.from('checklist_templates').insert(data);
    }

    setSaving(false);
    setShowAdd(false);
    resetForm();
    loadTemplates();
  };

  const handleDuplicate = async (t: ChecklistTemplate) => {
    if (!orgId) return;
    await supabase.from('checklist_templates').insert({
      org_id: orgId,
      name: `${t.name} (Copy)`,
      items: t.items,
    });
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this checklist template? This cannot be undone.')) return;
    await supabase.from('checklist_templates').delete().eq('id', id);
    loadTemplates();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 border-b border-border-light bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Checklists</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {templates.length} template{templates.length !== 1 ? 's' : ''} · Assign to clients for per-job tracking
            </p>
          </div>
          <button onClick={() => { resetForm(); setShowAdd(true); }} className="btn-primary text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Template
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="shimmer h-24 rounded-xl" />)}</div>
        ) : templates.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto mb-4 text-2xl">✅</div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">No checklist templates yet</h3>
            <p className="text-xs text-text-tertiary max-w-[300px] mx-auto">
              Create reusable checklist templates (e.g. kitchen, bathrooms, windows) and assign them to clients.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {templates.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card group"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center text-lg shrink-0">
                        ✅
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{t.name}</h3>
                        <p className="text-xs text-text-tertiary mt-0.5">
                          {t.items?.length || 0} item{(t.items?.length || 0) !== 1 ? 's' : ''} · Created {new Date(t.created_at).toLocaleDateString('en-AU')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Expand/collapse indicator */}
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-text-tertiary transition-transform ${expandedId === t.id ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      {/* Action buttons — only show on hover */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                          className="p-2 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(t); }}
                          className="p-2 rounded-lg hover:bg-surface-hover text-text-tertiary hover:text-text-primary transition-colors"
                          title="Duplicate"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                          className="p-2 rounded-lg hover:bg-danger-light text-text-tertiary hover:text-danger transition-colors"
                          title="Delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded checklist items */}
                <AnimatePresence>
                  {expandedId === t.id && t.items && t.items.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="border-t border-border-light pt-3 space-y-1.5">
                          {t.items.map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-2.5 text-sm">
                              <div className="w-5 h-5 rounded border-2 border-border shrink-0 flex items-center justify-center">
                                <span className="text-[10px] text-text-tertiary font-mono">{idx + 1}</span>
                              </div>
                              <span className="text-text-secondary">{item.label}</span>
                            </div>
                          ))}
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

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => { setShowAdd(false); resetForm(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card-elevated p-6 w-full max-w-[500px] max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-text-primary mb-4">
                {editId ? 'Edit Template' : 'New Checklist Template'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Template name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="input-field"
                    placeholder="e.g. Standard Residential Clean"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Checklist items</label>
                  <div className="space-y-2">
                    {formItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded border border-border-light bg-surface-elevated flex items-center justify-center text-xs text-text-tertiary shrink-0 font-mono">
                          {index + 1}
                        </div>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateItem(index, e.target.value)}
                          className="input-field flex-1"
                          placeholder={`e.g. ${['Kitchen cleaned', 'Bathrooms sanitised', 'Floors mopped', 'Windows wiped', 'Bins emptied', 'Surfaces dusted'][index] || 'Task item'}`}
                        />
                        {formItems.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            className="p-1.5 rounded-lg hover:bg-danger-light text-text-tertiary hover:text-danger transition-colors shrink-0"
                            title="Remove item"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addItem}
                    className="mt-2 text-sm text-primary hover:text-primary-hover font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add item
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={!formName.trim() || saving}
                    className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-40"
                  >
                    {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Template'}
                  </button>
                  <button onClick={() => { setShowAdd(false); resetForm(); }} className="btn-ghost text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
