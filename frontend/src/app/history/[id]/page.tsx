"use client";

import { useEffect, useState } from "react";
import { getCoverLetter } from "@/lib/api";
import { useParams } from "next/navigation";
import { Copy, CheckCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface CoverLetter {
  id: number;
  job_posting: { company: string; position: string };
  content_json: { question: string; answer: string }[];
  created_at: string;
}

export default function CoverLetterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CoverLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    getCoverLetter(Number(id)).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [id]);

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <PageHeader
        backHref="/history"
        backLabel="생성 기록"
        pageTitle={data ? `${data.job_posting?.company} · ${data.job_posting?.position}` : ""}
      />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : !data ? (
          <p className="text-center py-20 text-sm" style={{ color: "var(--text-dim)" }}>
            자소서를 찾을 수 없습니다.
          </p>
        ) : (
          <div className="space-y-5">
            {data.content_json.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid var(--border)" }}
              >
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
                >
                  <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                    문항 {i + 1}
                  </span>
                  <button
                    onClick={() => copy(item.answer, i)}
                    className="flex items-center gap-1 text-xs transition-colors"
                    style={{ color: copiedIndex === i ? "var(--success)" : "var(--text-dim)" }}
                  >
                    {copiedIndex === i ? <CheckCheck size={12} /> : <Copy size={12} />}
                    복사
                  </button>
                </div>
                <div className="px-5 py-3" style={{ background: "var(--bg-hover)" }}>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{item.question}</p>
                </div>
                <div className="px-5 py-5" style={{ background: "var(--bg)" }}>
                  <p className="text-sm leading-7 whitespace-pre-wrap"
                    style={{ color: "var(--text)", fontFamily: "'Noto Serif KR', serif" }}>
                    {item.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
