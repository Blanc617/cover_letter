"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StepJobPosting from "@/components/steps/StepJobPosting";
import StepResume from "@/components/steps/StepResume";
import StepPortfolio from "@/components/steps/StepPortfolio";
import StepPrevCoverLetter from "@/components/steps/StepPrevCoverLetter";
import StepUserDrafts from "@/components/steps/StepUserDrafts";
import type { UserDraft } from "@/components/steps/StepUserDrafts";
import StepResult from "@/components/steps/StepResult";
import PageHeader from "@/components/PageHeader";

const STEPS = ["공고 분석", "이력서 업로드", "포트폴리오 업로드", "이전 자소서", "자소서 문항", "자소서 생성"];

export interface JobPosting {
  company: string;
  position: string;
  employment_type: string;
  requirements: string[];
  preferred: string[];
  job_description: string;
  questions: string[];
}

export interface Profile {
  name: string;
  contact: Record<string, string>;
  summary: string;
  skills: string[];
  experience: { company: string; position: string; period: string; description: string }[];
  education: { school: string; major: string; period: string; degree: string }[];
  projects: { name: string; period: string; tech_stack: string[]; description: string }[];
  certifications: string[];
  activities: string[];
  portfolio_text?: string;
}

const SESSION_KEY = "generate_wizard_state";

export default function GeneratePage() {
  const [step, setStep] = useState(0);
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolioText, setPortfolioText] = useState<string | null>(null);
  const [prevCoverLetter, setPrevCoverLetter] = useState<string | null>(null);
  const [refLetterIds, setRefLetterIds] = useState<number[]>([]);
  const [userDrafts, setUserDrafts] = useState<UserDraft[]>([]);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.step !== undefined) setStep(saved.step);
      if (saved.jobPosting) setJobPosting(saved.jobPosting);
      if (saved.profile) setProfile(saved.profile);
      if (saved.portfolioText !== undefined) setPortfolioText(saved.portfolioText);
      if (saved.prevCoverLetter !== undefined) setPrevCoverLetter(saved.prevCoverLetter);
      if (saved.refLetterIds) setRefLetterIds(saved.refLetterIds);
      if (saved.userDrafts) setUserDrafts(saved.userDrafts);
    } catch {}
  }, []);

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        step, jobPosting, profile, portfolioText, prevCoverLetter, refLetterIds, userDrafts,
      }));
    } catch {}
  }, [step, jobPosting, profile, portfolioText, prevCoverLetter, refLetterIds, userDrafts]);

  const goNext = () => setStep((s) => Math.min(s + 1, 5));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <main className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10">
        <PageHeader pageTitle="자소서 생성" />
      </div>

      {/* Step indicator */}
      <div className="relative z-10 flex items-center justify-center gap-0 py-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300"
                style={{
                  background: i <= step ? "var(--accent)" : "var(--bg-card)",
                  color: i <= step ? "var(--bg)" : "var(--text-dim)",
                  border: `1px solid ${i <= step ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {i + 1}
              </div>
              <span
                className="text-xs whitespace-nowrap"
                style={{ color: i === step ? "var(--accent)" : "var(--text-dim)" }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="w-16 h-px mx-3 mb-5 transition-all duration-500"
                style={{ background: i < step ? "var(--accent)" : "var(--border)" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 flex items-start justify-center px-6 pb-16">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepJobPosting
                  onComplete={(data) => { setJobPosting(data); goNext(); }}
                />
              </motion.div>
            )}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepResume
                  onBack={goPrev}
                  onComplete={(data) => { setProfile(data); goNext(); }}
                />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepPortfolio
                  onBack={goPrev}
                  onComplete={(text) => { setPortfolioText(text); goNext(); }}
                />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepPrevCoverLetter
                  onBack={goPrev}
                  onComplete={(text, refIds) => { setPrevCoverLetter(text); setRefLetterIds(refIds); goNext(); }}
                />
              </motion.div>
            )}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepUserDrafts
                  onBack={goPrev}
                  onComplete={(drafts) => { setUserDrafts(drafts); goNext(); }}
                />
              </motion.div>
            )}
            {step === 5 && jobPosting && profile && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepResult
                  jobPosting={jobPosting}
                  profile={portfolioText ? { ...profile, portfolio_text: portfolioText } : profile}
                  prevCoverLetter={prevCoverLetter}
                  refLetterIds={refLetterIds}
                  userDrafts={userDrafts}
                  onBack={goPrev}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
