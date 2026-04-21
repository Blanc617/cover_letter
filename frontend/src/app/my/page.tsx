"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, Briefcase, PenLine, Sparkles, ChevronRight, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";

interface Stats {
  resumes: number;
  portfolios: number;
  coverLetters: number;
  generated: number;
}

interface UserInfo {
  name: string;
  email: string;
}

const cards = [
  {
    href: "/my/resumes",
    icon: FileText,
    title: "이력서 관리",
    desc: "PDF 업로드 또는 직접 작성으로 이력서를 저장하고 관리합니다.",
    key: "resumes" as keyof Stats,
    unit: "개",
  },
  {
    href: "/my/portfolios",
    icon: Briefcase,
    title: "포트폴리오 관리",
    desc: "포트폴리오 문서를 업로드하고 자소서 생성 시 활용합니다.",
    key: "portfolios" as keyof Stats,
    unit: "개",
  },
  {
    href: "/my/cover-letters",
    icon: PenLine,
    title: "자소서 관리",
    desc: "작성하거나 저장한 자기소개서를 관리합니다.",
    key: "coverLetters" as keyof Stats,
    unit: "개",
  },
  {
    href: "/history",
    icon: Sparkles,
    title: "AI 생성 기록",
    desc: "AI가 작성한 자소서 기록을 열람하고 다운로드합니다.",
    key: "generated" as keyof Stats,
    unit: "건",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function MyPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<Stats>({ resumes: 0, portfolios: 0, coverLetters: 0, generated: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      setUserInfo({
        name: user.user_metadata?.full_name ?? user.email ?? "사용자",
        email: user.email ?? "",
      });

      const [r, p, cl, g] = await Promise.all([
        supabase.from("user_resumes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("user_portfolios").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("user_cover_letters").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("cover_letters").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setStats({
        resumes: r.count ?? 0,
        portfolios: p.count ?? 0,
        coverLetters: cl.count ?? 0,
        generated: g.count ?? 0,
      });
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <PageHeader pageTitle="마이페이지" />

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* 프로필 섹션 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-5 p-6 rounded-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              border: "1.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}
          >
            <User size={24} style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            {loading ? (
              <div className="space-y-2">
                <div className="h-4 w-32 rounded shimmer" />
                <div className="h-3 w-48 rounded shimmer" />
              </div>
            ) : (
              <>
                <p className="font-display text-xl" style={{ color: "var(--text)" }}>
                  {userInfo?.name}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {userInfo?.email}
                </p>
              </>
            )}
          </div>
        </motion.div>

        {/* 카드 그리드 */}
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-xs tracking-widest uppercase mb-5"
            style={{ color: "var(--text-dim)", letterSpacing: "0.15em" }}
          >
            내 문서 & 기록
          </motion.p>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {cards.map((card) => {
              const Icon = card.icon;
              const count = stats[card.key];
              return (
                <motion.div key={card.href} variants={item}>
                  <Link href={card.href} className="group block">
                    <div
                      className="h-full flex flex-col gap-4 p-6 rounded-2xl transition-all duration-200 group-hover:border-[var(--accent)]"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                            color: "var(--accent)",
                          }}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="text-right">
                          {loading ? (
                            <div className="h-6 w-10 rounded shimmer" />
                          ) : (
                            <span className="font-display text-2xl" style={{ color: "var(--accent)" }}>
                              {count}
                            </span>
                          )}
                          <span className="text-xs ml-0.5" style={{ color: "var(--text-dim)" }}>
                            {card.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
                          {card.title}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                          {card.desc}
                        </p>
                      </div>

                      <div
                        className="flex items-center gap-1 text-xs transition-colors group-hover:text-[var(--accent)]"
                        style={{ color: "var(--text-dim)" }}
                      >
                        관리하기
                        <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* 자소서 생성 CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          <Link
            href="/generate"
            className="group flex items-center justify-between p-6 rounded-2xl transition-all duration-200 hover:border-[var(--accent)]"
            style={{
              background: "color-mix(in srgb, var(--accent) 6%, var(--bg-card))",
              border: "1px solid color-mix(in srgb, var(--accent) 20%, var(--border))",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  새 자소서 생성하기
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  공고 이미지와 이력서로 AI 맞춤형 자소서를 작성합니다
                </p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="flex-shrink-0 transition-transform group-hover:translate-x-1"
              style={{ color: "var(--accent)" }}
            />
          </Link>
        </motion.div>

      </div>
    </main>
  );
}
