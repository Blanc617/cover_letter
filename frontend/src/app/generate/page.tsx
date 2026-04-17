"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StepJobPosting from "@/components/steps/StepJobPosting";
import StepResume from "@/components/steps/StepResume";
import StepResult from "@/components/steps/StepResult";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const STEPS = ["공고 분석", "이력서 업로드", "자소서 생성"];

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
}

export default function GeneratePage() {
  const [step, setStep] = useState(0);
  const [jobPosting, setJobPosting] = useState<JobPosting | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const goNext = () => setStep((s) => Math.min(s + 1, 2));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <main className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,169,110,0.08) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-sm transition-colors hover:text-[var(--accent)]"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={16} />
          홈
        </Link>
        <span className="font-display text-lg" style={{ color: "var(--text)" }}>
          Letter<span style={{ color: "var(--accent)" }}>craft</span>
        </span>
        <div className="w-16" />
      </header>

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
                  onComplete={(data) => {
                    setJobPosting(data);
                    goNext();
                  }}
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
                  onComplete={(data) => {
                    setProfile(data);
                    goNext();
                  }}
                />
              </motion.div>
            )}
            {step === 2 && jobPosting && profile && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StepResult
                  jobPosting={jobPosting}
                  profile={profile}
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
