"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, FileText, ImageIcon, Sparkles, Zap } from "lucide-react";

const features = [
  {
    icon: <ImageIcon size={20} />,
    title: "공고 분석",
    desc: "채용 공고 캡처 이미지를 올리면 AI가 직무·요건을 자동으로 파악합니다.",
  },
  {
    icon: <FileText size={20} />,
    title: "이력서 파싱",
    desc: "PDF 이력서를 업로드하면 경력·기술스택·프로젝트를 구조화합니다.",
  },
  {
    icon: <Sparkles size={20} />,
    title: "맞춤 자소서 생성",
    desc: "Claude Sonnet이 지원자의 경험을 공고에 최적화된 자소서로 작성합니다.",
  },
  {
    icon: <Zap size={20} />,
    title: "합격 자소서 RAG",
    desc: "실제 합격자들의 자소서 패턴을 학습하여 완성도 높은 글을 만듭니다.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,169,110,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Nav */}
      <nav
        className="relative z-10 flex items-center justify-between px-8 py-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="font-display text-xl tracking-tight" style={{ color: "var(--text)" }}>
          Letter<span style={{ color: "var(--accent)" }}>craft</span>
        </span>
        <Link
          href="/generate"
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-full transition-colors duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            color: "var(--text-muted)",
          }}
        >
          시작하기 <ArrowRight size={14} />
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-3xl mx-auto"
        >
          <motion.p
            variants={item}
            className="text-sm tracking-widest uppercase mb-6"
            style={{ color: "var(--accent)", letterSpacing: "0.2em" }}
          >
            AI-Powered Cover Letter
          </motion.p>

          <motion.h1
            variants={item}
            className="font-display text-5xl md:text-7xl leading-tight mb-8"
            style={{ color: "var(--text)", fontWeight: 600 }}
          >
            당신의 경험을
            <br />
            <em style={{ color: "var(--accent)", fontStyle: "italic" }}>합격 자소서</em>로
          </motion.h1>

          <motion.p
            variants={item}
            className="text-lg mb-12 leading-relaxed max-w-xl mx-auto"
            style={{ color: "var(--text-muted)" }}
          >
            공고 이미지와 이력서 PDF만 올리면,
            <br />
            AI가 기업 맞춤형 자기소개서를 실시간으로 작성합니다.
          </motion.p>

          <motion.div variants={item}>
            <Link
              href="/generate"
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              자소서 생성하기
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Decorative divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-96"
          style={{
            background:
              "linear-gradient(to right, transparent, var(--accent), transparent)",
          }}
        />
      </section>

      {/* Features */}
      <section
        className="relative z-10 px-6 py-20"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={item}
                className="p-6 rounded-2xl transition-all duration-300 cursor-default hover:border-[var(--border-light)]"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: "rgba(201,169,110,0.12)",
                    color: "var(--accent)",
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  className="text-sm font-medium mb-2"
                  style={{ color: "var(--text)" }}
                >
                  {f.title}
                </h3>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-dim)" }}
                >
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 px-8 py-6 text-xs text-center"
        style={{ borderTop: "1px solid var(--border)", color: "var(--text-dim)" }}
      >
        © 2026 Lettercraft. AI가 작성한 자소서는 지원자의 경험을 기반으로 합니다.
      </footer>
    </main>
  );
}
