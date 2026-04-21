"use client";

import { useEffect, useState } from "react";
import { getHistory } from "@/lib/api";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Building2, Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface HistoryItem {
  id: number;
  job_posting: { company: string; position: string };
  content_json: { question: string; answer: string }[];
  created_at: string;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory().then((data) => {
      setItems(data.items ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <PageHeader pageTitle="생성 기록" />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              아직 생성한 자소서가 없어요.
            </p>
            <Link
              href="/generate"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              자소서 생성하기 <ChevronRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/history/${item.id}`}>
                  <div
                    className="flex items-center justify-between p-5 rounded-2xl transition-all duration-200 group hover:border-[var(--accent)]"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} style={{ color: "var(--accent)" }} />
                        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                          {item.job_posting?.company || "회사 미상"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                          {item.job_posting?.position || "직군 미상"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} style={{ color: "var(--text-dim)" }} />
                        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                          {new Date(item.created_at).toLocaleDateString("ko-KR", {
                            year: "numeric", month: "long", day: "numeric"
                          })}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                          · {item.content_json?.length ?? 0}개 문항
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-1"
                      style={{ color: "var(--text-dim)" }} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
