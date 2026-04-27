'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 'welcome', title: 'Welcome to CleanRoute Pro', icon: '🚀' },
  { id: 'overview', title: 'Quick Overview', icon: '📋' },
  { id: 'ready', title: 'You\'re All Set', icon: '✅' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      router.push('/dashboard/schedule');
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    router.push('/dashboard/schedule');
  };

  return (
    <div className="h-full flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[560px]"
      >
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className="flex-1 h-1.5 rounded-full transition-all duration-500"
              style={{
                backgroundColor: i <= step ? '#4F46E5' : '#E5E7EB',
              }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="card-elevated p-8"
          >
            {/* Step icon */}
            <div className="w-16 h-16 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-6 text-3xl">
              {currentStep.icon}
            </div>

            {step === 0 && (
              <>
                <h1 className="text-2xl font-bold text-text-primary text-center mb-3">
                  Welcome to CleanRoute Pro
                </h1>
                <p className="text-sm text-text-secondary text-center mb-6 max-w-[400px] mx-auto leading-relaxed">
                  Smart route scheduling for cleaning companies. Let&apos;s get you set up so you can start
                  optimising your teams&apos; daily routes.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-sm">📍</div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">Set your base address</div>
                      <div className="text-xs text-text-tertiary">Where your teams start and end each day</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">👥</div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">Add your clients</div>
                      <div className="text-xs text-text-tertiary">Build your client database for quick scheduling</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-sm">🗺️</div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">Optimise your routes</div>
                      <div className="text-xs text-text-tertiary">One click to find the most efficient driving order</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-xl font-bold text-text-primary text-center mb-3">
                  Here&apos;s What You Can Do
                </h2>
                <p className="text-sm text-text-secondary text-center mb-6 max-w-[400px] mx-auto">
                  A quick look at the key features available from your dashboard.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: '📅', label: 'Schedule', desc: 'Build daily routes with live travel times' },
                    { icon: '👤', label: 'Clients', desc: 'Saved database for quick scheduling' },
                    { icon: '📋', label: 'Templates', desc: '4-week rotation schedule templates' },
                    { icon: '✅', label: 'Checklists', desc: 'Per-client cleaning checklists' },
                    { icon: '👥', label: 'Staff', desc: 'Roster and team assignments' },
                    { icon: '💰', label: 'Financials', desc: 'Wages, fuel costs, and CSV export' },
                  ].map((feat) => (
                    <div key={feat.label} className="p-3 rounded-xl bg-surface-elevated">
                      <div className="text-lg mb-1">{feat.icon}</div>
                      <div className="text-sm font-medium text-text-primary">{feat.label}</div>
                      <div className="text-xs text-text-tertiary mt-0.5">{feat.desc}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-xl font-bold text-text-primary text-center mb-3">
                  You&apos;re Ready to Go!
                </h2>
                <p className="text-sm text-text-secondary text-center mb-6 max-w-[400px] mx-auto leading-relaxed">
                  Head to the Schedule page to set your base address and start adding clients.
                  The map will update in real time as you build your route.
                </p>
                <div className="p-4 rounded-xl bg-primary-light border border-primary-border text-center">
                  <div className="text-sm font-medium text-primary mb-1">💡 Pro Tip</div>
                  <div className="text-xs text-text-secondary">
                    Use the <strong>Optimize Route Order</strong> button after adding 2+ clients to find the most
                    efficient driving sequence. Lock specific clients in place if they have a fixed time slot.
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={handleNext}
                className="btn-primary flex-1 py-3 text-sm"
              >
                {isLast ? 'Go to Schedule →' : 'Continue'}
              </button>
              {!isLast && (
                <button onClick={handleSkip} className="btn-ghost text-sm">
                  Skip
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Step indicator */}
        <p className="text-center text-xs text-text-tertiary mt-4">
          Step {step + 1} of {STEPS.length}
        </p>
      </motion.div>
    </div>
  );
}
