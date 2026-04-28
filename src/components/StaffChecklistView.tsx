'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface StaffChecklistViewProps {
  clientId: string;
  clientName: string;
  scheduleJobId?: string;
  onClose: () => void;
}

export default function StaffChecklistView({ clientId, clientName, scheduleJobId, onClose }: StaffChecklistViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const { user, profile } = useAuth();
  const orgId = profile?.org_id || null;

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  // Load client's checklist template
  const loadChecklist = useCallback(async () => {
    if (!orgId) return;

    // Get client's assigned checklist template
    const { data: client } = await supabase
      .from('clients')
      .select('checklist_template_id')
      .eq('id', clientId)
      .single();

    if (!client?.checklist_template_id) {
      setLoading(false);
      return;
    }

    setTemplateId(client.checklist_template_id);

    // Get template items
    const { data: template } = await supabase
      .from('checklist_templates')
      .select('name, items')
      .eq('id', client.checklist_template_id)
      .single();

    if (template) {
      setTemplateName(template.name);
      const templateItems = (template.items as { id: string; label: string }[]) || [];
      setItems(templateItems.map((item) => ({ ...item, checked: false })));
    }

    // Check if there's an existing completion for today
    if (scheduleJobId) {
      const { data: existing } = await supabase
        .from('checklist_completions')
        .select('items, notes')
        .eq('schedule_job_id', scheduleJobId)
        .maybeSingle();

      if (existing) {
        const savedItems = (existing.items as ChecklistItem[]) || [];
        setItems(savedItems);
        setNotes(existing.notes || '');
      }
    }

    setLoading(false);
  }, [supabase, orgId, clientId, scheduleJobId]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, checked: !item.checked } : item));
    setSaved(false);
  };

  const completedCount = items.filter((i) => i.checked).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleSave = async () => {
    if (!orgId || !templateId) return;
    setSaving(true);

    // Check for existing completion
    if (scheduleJobId) {
      const { data: existing } = await supabase
        .from('checklist_completions')
        .select('id')
        .eq('schedule_job_id', scheduleJobId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('checklist_completions')
          .update({
            items: items,
            notes,
            completed_at: new Date().toISOString(),
            completed_by: user?.id || null,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('checklist_completions')
          .insert({
            org_id: orgId,
            client_id: clientId,
            schedule_job_id: scheduleJobId || null,
            checklist_template_id: templateId,
            items: items,
            notes,
            completed_by: user?.id || null,
          });
      }
    } else {
      await supabase
        .from('checklist_completions')
        .insert({
          org_id: orgId,
          client_id: clientId,
          checklist_template_id: templateId,
          items: items,
          notes,
          completed_by: user?.id || null,
        });
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-[480px] max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 p-5 border-b border-border-light">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-text-primary">Checklist</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-elevated transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-text-secondary">{clientName}</p>
          {templateName && <p className="text-xs text-text-tertiary mt-0.5">Template: {templateName}</p>}

          {/* Progress bar */}
          {items.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-tertiary">{completedCount} of {items.length} complete</span>
                <span className={`font-semibold ${progress === 100 ? 'text-emerald-600' : 'text-primary'}`}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: progress === 100 ? '#059669' : '#4F46E5' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', damping: 20 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Checklist items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-text-tertiary text-sm">Loading checklist...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2">📋</div>
              <p className="text-sm text-text-tertiary">No checklist assigned to this client.</p>
              <p className="text-xs text-text-tertiary mt-1">Assign a template in the Clients page.</p>
            </div>
          ) : (
            items.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
                  item.checked
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-surface-elevated border border-border-light hover:border-primary'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                  item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                }`}>
                  {item.checked && (
                    <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </motion.svg>
                  )}
                </div>
                <span className={`text-sm font-medium flex-1 ${item.checked ? 'text-emerald-700 line-through' : 'text-text-primary'}`}>
                  {item.label}
                </span>
              </motion.button>
            ))
          )}

          {/* Notes */}
          {items.length > 0 && (
            <div className="pt-3">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                rows={2}
                className="input-field text-sm resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="shrink-0 p-5 border-t border-border-light">
            <button onClick={handleSave} disabled={saving}
              className="btn-primary w-full py-3 text-sm disabled:opacity-50">
              {saving ? 'Saving...' : saved ? '✓ Saved!' : progress === 100 ? '✓ Mark as Complete' : 'Save Progress'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
