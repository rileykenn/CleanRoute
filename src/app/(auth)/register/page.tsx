'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          business_name: businessName || fullName + "'s Business",
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Auto-login after signup (Supabase handles this via email confirmation settings)
    router.push('/dashboard/schedule');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px]"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ boxShadow: '0 0 30px rgba(79, 70, 229, 0.2)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">CleanRoute Pro</h1>
          <p className="text-sm text-text-secondary mt-1">Start optimising your routes</p>
        </div>

        {/* Register Card */}
        <div className="card-elevated p-8">
          <h2 className="text-lg font-bold text-text-primary mb-1">Create your account</h2>
          <p className="text-sm text-text-secondary mb-6">Set up your business in seconds</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-text-secondary mb-1.5">
                Full name
              </label>
              <input
                id="reg-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                placeholder="Sarah O'Connell"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="reg-business" className="block text-sm font-medium text-text-secondary mb-1.5">
                Business name
              </label>
              <input
                id="reg-business"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="input-field"
                placeholder="The Cleaning Co Shellharbour"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Email address
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Min. 6 characters"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-text-secondary mb-1.5">
                Confirm password
              </label>
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-danger bg-danger-light rounded-lg px-4 py-3 border border-red-200"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              Already have an account?{' '}
              <a href="/login" className="font-medium text-primary hover:text-primary-hover transition-colors">
                Sign in
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-text-tertiary mt-6">
          Powered by <span className="font-medium text-text-secondary">Riley Tech Studio</span>
        </p>
      </motion.div>
    </div>
  );
}
