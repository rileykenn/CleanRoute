'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

interface TemplateJob {
  id: string;
  template_id: string;
  team_id: string | null;
  day_of_week: number;
  client_id: string | null;
  position: number;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  duration_minutes: number;
  staff_count: number;
  is_locked: boolean;
  notes: string;
}

interface Template {
  id: string;
  name: string;
  label: string;
  created_at: string;
  jobs: TemplateJob[];
}

interface Team {
  id: string;
  name: string;
  color_index: number;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ROTATION_LABELS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

export default function TemplatesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useAuth();
  const orgId = profile?.org_id || null;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [savingFromSchedule, setSavingFromSchedule] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Load templates and their jobs
  const loadTemplates = useCallback(async () => {
    if (!orgId) return;
    const { data: tpls } = await supabase
      .from('schedule_templates')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at');

    if (!tpls) { setLoading(false); return; }

    // Load jobs for each template
    const withJobs: Template[] = [];
    for (const t of tpls) {
      const { data: jobs } = await supabase
        .from('template_jobs')
        .select('*')
        .eq('template_id', t.id)
        .order('day_of_week, position');
      withJobs.push({ ...t, label: t.label || '', jobs: jobs || [] });
    }
    setTemplates(withJobs);
    setLoading(false);
  }, [supabase, orgId]);

  // Load teams
  const loadTeams = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('teams')
      .select('id, name, color_index')
      .eq('org_id', orgId)
      .order('sort_order');
    if (data) setTeams(data);
  }, [supabase, orgId]);

  useEffect(() => {
    if (orgId) { loadTemplates(); loadTeams(); }
  }, [orgId, loadTemplates, loadTeams]);

  // Create a new template
  const handleCreate = async () => {
    if (!orgId || !newName.trim()) return;
    const { data } = await supabase
      .from('schedule_templates')
      .insert({ org_id: orgId, name: newName.trim(), label: newLabel })
      .select()
      .single();
    if (data) {
      setTemplates((prev) => [...prev, { ...data, label: data.label || '', jobs: [] }]);
      setNewName('');
      setNewLabel('');
      setIsCreating(false);
    }
  };

  // Save current schedule as template
  const saveScheduleToTemplate = async (templateId: string) => {
    if (!orgId) return;
    setSavingFromSchedule(true);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay(); // 0=Sun, adjust to 0=Mon
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Delete existing jobs for this day in the template
    await supabase
      .from('template_jobs')
      .delete()
      .eq('template_id', templateId)
      .eq('day_of_week', adjustedDay);

    // Get all schedules for today across all teams
    for (const team of teams) {
      const { data: schedule } = await supabase
        .from('schedules')
        .select('id')
        .eq('team_id', team.id)
        .eq('schedule_date', today)
        .maybeSingle();

      if (!schedule) continue;

      const { data: jobs } = await supabase
        .from('schedule_jobs')
        .select('*')
        .eq('schedule_id', schedule.id)
        .order('position');

      if (!jobs || jobs.length === 0) continue;

      const templateJobs = jobs.map((j: Record<string, unknown>, i: number) => ({
        template_id: templateId,
        org_id: orgId,
        team_id: team.id,
        day_of_week: adjustedDay,
        client_id: j.client_id || null,
        position: i,
        name: j.name || '',
        address: j.address || '',
        lat: j.lat || null,
        lng: j.lng || null,
        duration_minutes: j.duration_minutes || 90,
        staff_count: j.staff_count || 1,
        is_locked: j.is_locked || false,
        notes: j.notes || '',
      }));

      await supabase.from('template_jobs').insert(templateJobs);
    }

    setSavingFromSchedule(false);
    setSuccessMsg('Today\'s schedule saved to template!');
    setTimeout(() => setSuccessMsg(''), 3000);
    loadTemplates();
  };

  // Load template into today's schedule
  const loadTemplateIntoSchedule = async (templateId: string) => {
    if (!orgId) return;
    setLoadingTemplate(templateId);

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().getDay();
    const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Get template jobs for today's day of week
    const { data: templateJobs } = await supabase
      .from('template_jobs')
      .select('*')
      .eq('template_id', templateId)
      .eq('day_of_week', adjustedDay)
      .order('position');

    if (!templateJobs || templateJobs.length === 0) {
      setLoadingTemplate(null);
      setSuccessMsg(`No ${DAY_NAMES[adjustedDay]} jobs in this template.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      return;
    }

    // Group by team
    const byTeam = new Map<string, typeof templateJobs>();
    for (const j of templateJobs) {
      const tid = j.team_id || teams[0]?.id;
      if (!tid) continue;
      if (!byTeam.has(tid)) byTeam.set(tid, []);
      byTeam.get(tid)!.push(j);
    }

    // For each team, create/update schedule and insert jobs
    for (const [teamId, jobs] of byTeam) {
      // Get or create schedule
      let scheduleId: string;
      const { data: existing } = await supabase
        .from('schedules')
        .select('id')
        .eq('team_id', teamId)
        .eq('schedule_date', today)
        .maybeSingle();

      if (existing) {
        scheduleId = existing.id;
        // Clear existing jobs
        await supabase.from('schedule_jobs').delete().eq('schedule_id', scheduleId);
      } else {
        const { data: created } = await supabase
          .from('schedules')
          .insert({ org_id: orgId, team_id: teamId, schedule_date: today })
          .select('id')
          .single();
        if (!created) continue;
        scheduleId = created.id;
      }

      // Insert template jobs as schedule jobs
      const scheduleJobs = jobs.map((j: Record<string, unknown>, i: number) => ({
        schedule_id: scheduleId,
        org_id: orgId,
        client_id: j.client_id || null,
        position: i,
        name: j.name || '',
        address: j.address || '',
        lat: j.lat || null,
        lng: j.lng || null,
        duration_minutes: j.duration_minutes || 90,
        staff_count: j.staff_count || 1,
        is_locked: j.is_locked || false,
        is_break: false,
        notes: j.notes || '',
      }));

      await supabase.from('schedule_jobs').insert(scheduleJobs);
    }

    setLoadingTemplate(null);
    setSuccessMsg('Template loaded! Refresh the Schedule page to see changes.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Delete template
  const deleteTemplate = async (id: string) => {
    await supabase.from('template_jobs').delete().eq('template_id', id);
    await supabase.from('schedule_templates').delete().eq('id', id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // Get current week rotation label suggestion
  const getWeekRotation = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return ROTATION_LABELS[(weekNumber - 1) % 8];
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background">
      <div className="max-w-[720px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Schedule Templates</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Save and load weekly schedules · Current rotation: <span className="font-semibold text-primary">{getWeekRotation()}</span>
            </p>
          </div>
          <button onClick={() => setIsCreating(true)} className="btn-primary text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Template
          </button>
        </div>

        {/* Success message */}
        <AnimatePresence>
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-medium">
              ✓ {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create form */}
        <AnimatePresence>
          {isCreating && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="card-elevated p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-primary">Create Template</h3>
              <div className="flex gap-3">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Template name (e.g. Week A)" className="input-field flex-1 text-sm" autoFocus />
                <select value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  className="input-field w-24 text-sm">
                  <option value="">Label</option>
                  {ROTATION_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={!newName.trim()} className="btn-primary text-sm disabled:opacity-50">Create</button>
                <button onClick={() => { setIsCreating(false); setNewName(''); setNewLabel(''); }} className="btn-ghost text-sm">Cancel</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Templates list */}
        {loading ? (
          <div className="text-center py-12 text-text-tertiary text-sm">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto mb-4 text-2xl">📋</div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">No templates yet</h3>
            <p className="text-xs text-text-tertiary max-w-[280px] mx-auto">
              Create a template, then save your current schedule into it to quickly load it on future days.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => {
              const isExpanded = expandedId === template.id;
              const jobsByDay = new Map<number, TemplateJob[]>();
              template.jobs.forEach((j) => {
                if (!jobsByDay.has(j.day_of_week)) jobsByDay.set(j.day_of_week, []);
                jobsByDay.get(j.day_of_week)!.push(j);
              });

              return (
                <motion.div key={template.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="card-elevated overflow-hidden">
                  {/* Header */}
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-hover transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : template.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center text-lg">📋</div>
                      <div>
                        <h3 className="text-sm font-bold text-text-primary">{template.name}</h3>
                        <p className="text-xs text-text-tertiary">
                          {template.label && <span className="font-semibold text-primary mr-2">{template.label}</span>}
                          {template.jobs.length} job{template.jobs.length !== 1 ? 's' : ''} across {jobsByDay.size} day{jobsByDay.size !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 space-y-3 border-t border-border-light pt-3">
                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => saveScheduleToTemplate(template.id)} disabled={savingFromSchedule}
                              className="btn-secondary text-xs disabled:opacity-50">
                              {savingFromSchedule ? 'Saving...' : '💾 Save Today\'s Schedule Here'}
                            </button>
                            <button onClick={() => loadTemplateIntoSchedule(template.id)}
                              disabled={loadingTemplate === template.id}
                              className="btn-primary text-xs disabled:opacity-50">
                              {loadingTemplate === template.id ? 'Loading...' : '📥 Load Into Today'}
                            </button>
                            <button onClick={() => deleteTemplate(template.id)} className="btn-ghost text-xs text-danger hover:bg-danger-light">
                              🗑 Delete
                            </button>
                          </div>

                          {/* Jobs by day */}
                          {template.jobs.length === 0 ? (
                            <p className="text-xs text-text-tertiary italic py-2">
                              No jobs saved yet. Use "Save Today&apos;s Schedule Here" to snapshot your current route.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {Array.from(jobsByDay.entries()).sort(([a], [b]) => a - b).map(([day, jobs]) => (
                                <div key={day} className="bg-surface-elevated rounded-xl p-3">
                                  <div className="text-xs font-semibold text-text-primary mb-2">{DAY_NAMES[day]}</div>
                                  {jobs.map((j, idx) => {
                                    const teamName = teams.find((t) => t.id === j.team_id)?.name || 'Unassigned';
                                    return (
                                      <div key={j.id} className="flex items-center gap-2 py-1 text-xs">
                                        <span className="w-5 h-5 rounded bg-primary-light text-primary font-bold flex items-center justify-center text-[10px]">
                                          {idx + 1}
                                        </span>
                                        <span className="font-medium text-text-primary flex-1 truncate">{j.name || 'Unnamed'}</span>
                                        <span className="text-text-tertiary truncate max-w-[140px]">{j.address}</span>
                                        <span className="text-text-tertiary">{j.duration_minutes}m</span>
                                        <span className="text-text-tertiary">· {teamName}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* 4-Week Rotation Grid */}
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            4-Week Rotation Overview
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {ROTATION_LABELS.map((label) => {
              const template = templates.find((t) => t.label === label);
              const isCurrent = label === getWeekRotation();
              return (
                <div key={label}
                  className={`p-3 rounded-xl text-center transition-all ${isCurrent ? 'bg-primary-light border-2 border-primary' : 'bg-surface-elevated border border-border-light'}`}>
                  <div className={`text-xs font-bold mb-1 ${isCurrent ? 'text-primary' : 'text-text-secondary'}`}>{label}</div>
                  <div className="text-[10px] text-text-tertiary truncate">
                    {template ? template.name : '—'}
                  </div>
                  {isCurrent && <div className="text-[9px] text-primary font-semibold mt-1">THIS WEEK</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
