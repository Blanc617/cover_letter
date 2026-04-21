"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const features = [
  {
    step: "01",
    title: "공고 분석",
    desc: "채용 공고 캡처 이미지를 올리면 AI가 직무·요건·자소서 문항을 자동으로 파악합니다.",
    label: "Vision AI",
  },
  {
    step: "02",
    title: "이력서 파싱",
    desc: "PDF 이력서를 업로드하면 경력·기술스택·프로젝트를 정밀하게 구조화합니다.",
    label: "PDF Parsing",
  },
  {
    step: "03",
    title: "맞춤 자소서 생성",
    desc: "Claude Sonnet이 지원자의 경험과 공고를 분석해 최적화된 자소서를 실시간으로 작성합니다.",
    label: "Claude Sonnet",
  },
  {
    step: "04",
    title: "합격 자소서 RAG",
    desc: "실제 합격자들의 자소서 패턴을 벡터 검색으로 참고하여 완성도를 높입니다.",
    label: "RAG",
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
            "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <PageHeader />
      </div>

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
      <section className="relative z-10 px-6 py-24" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-5xl mx-auto">

          {/* 섹션 헤더 */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4 mb-14"
          >
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
            <span className="text-xs tracking-widest uppercase" style={{ color: "var(--accent)", letterSpacing: "0.2em" }}>
              How it works
            </span>
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          </motion.div>

          {/* 카드 목록 */}
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {features.map((f, i) => (
              <motion.div key={i} variants={item}>
                <div
                  className="relative flex gap-6 p-7 rounded-2xl overflow-hidden"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* 스텝 번호 */}
                  <div className="shrink-0 pt-0.5">
                    <span
                      className="font-display text-3xl leading-none select-none"
                      style={{ color: "color-mix(in srgb, var(--accent) 20%, transparent)" }}
                    >
                      {f.step}
                    </span>
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-base" style={{ color: "var(--text)" }}>
                        {f.title}
                      </h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                          color: "var(--accent)",
                          border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                        }}
                      >
                        {f.label}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
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
        © 2026 Coverly. AI가 작성한 자소서는 지원자의 경험을 기반으로 합니다.
      </footer>
    </main>
  );
}
