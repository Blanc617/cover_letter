"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const features = [
  {
    step: "01",
    title: "공고 파싱",
    desc: "채용 공고 이미지를 올리면 Vision AI가 직무·자격요건·자소서 문항을 자동으로 추출합니다. 이미지가 없으면 직접 입력도 가능합니다.",
    label: "Vision AI",
  },
  {
    step: "02",
    title: "회사 맞춤 분석",
    desc: "지원 회사를 실시간 웹 검색해 인재상·핵심 가치·최근 사업 방향을 파악하고, 어떤 방향으로 써야 하는지 전략을 수립합니다.",
    label: "Web Research",
  },
  {
    step: "03",
    title: "이력서 + 포트폴리오",
    desc: "PDF 이력서와 포트폴리오를 함께 업로드하면 경력·프로젝트·기술 스택을 구조화하고, 회사 분석 결과를 바탕으로 가장 어필될 경험을 선별합니다.",
    label: "PDF Parsing",
  },
  {
    step: "04",
    title: "나만의 문체 반영",
    desc: "기존에 작성한 자소서를 제공하면 AI가 문장 어미 패턴·어휘 습관·문단 호흡을 분석해 내 글쓰기 스타일 그대로 자소서를 씁니다.",
    label: "문체 학습",
  },
  {
    step: "05",
    title: "문항별 초안 작성",
    desc: "각 자소서 문항에 쓰고 싶은 경험과 내용을 직접 입력할 수 있습니다. AI는 초안의 내용과 표현을 그대로 살려 완성하며 없는 경험은 만들어내지 않습니다.",
    label: "초안 기반 생성",
  },
  {
    step: "06",
    title: "AI 자소서 생성",
    desc: "합격자 자소서 패턴을 벡터 검색으로 참고하고 AI 특유 표현은 철저히 배제합니다. 내 말투와 실제 경험만으로 문항별 자소서를 실시간으로 완성하고 자동 저장합니다.",
    label: "RAG + Claude Sonnet",
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
            공고 이미지, 이력서, 내 초안만 있으면
            <br />
            AI가 내 말투로 기업 맞춤형 자소서를 실시간으로 완성합니다.
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
