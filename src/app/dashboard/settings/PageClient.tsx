'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [subTier, setSubTier] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email || '');
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, organizations(id, name, subscription_status, subscription_tier)')
        .eq('id', user.id)
        .single();
      if (profile) {
        const org = profile.organizations as unknown as { id: string; name: string; subscription_status: string; subscription_tier: string } | null;
        if (org) {
          setOrgId(org.id);
          setOrgName(org.name);
          setSubStatus(org.subscription_status);
          setSubTier(org.subscription_tier);
        }
      }
    };
    load();
  }, [supabase]);

  const handleSaveOrg = async () => {
    if (!orgId || !orgName.trim()) return;
    setSaving(true);
    await supabase.from('organizations').update({ name: orgName.trim() }).eq('id', orgId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const statusColors: Record<string, string> = {
    trialing: 'bg-blue-100 text-blue-700 border-blue-200',
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    past_due: 'bg-amber-100 text-amber-700 border-amber-200',
    canceled: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background">
      <div className="max-w-[640px] mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage your account and subscription</p>
        </div>

        {/* Business Info */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-elevated p-6">
          <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            Business Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Business name</label>
              <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Admin email</label>
              <input type="email" value={userEmail} disabled className="input-field opacity-60 cursor-not-allowed" />
            </div>
            <button onClick={handleSaveOrg} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </motion.div>

        {/* Subscription */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-elevated p-6">
          <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            Subscription
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border capitalize ${statusColors[subStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              {subStatus || 'Loading...'}
            </span>
            <span className="text-sm font-medium text-text-primary capitalize">{subTier || '—'} Plan</span>
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Manage your subscription, update payment methods, and view invoices through the Stripe Customer Portal.
          </p>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/billing/portal', { method: 'POST' });
                const data = await res.json();
                if (data.url) {
                  window.open(data.url, '_blank');
                }
              } catch (err) {
                console.error('Billing portal error:', err);
              }
            }}
            className="btn-secondary text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            Manage Billing
          </button>
        </motion.div>

        {/* Footer */}
        <div className="text-center text-xs text-text-tertiary pt-4 pb-8">
          <p>CleanRoute Pro v1.0 · Built by <span className="font-medium text-text-secondary">Riley Tech Studio</span></p>
        </div>
      </div>
    </div>
  );
}
