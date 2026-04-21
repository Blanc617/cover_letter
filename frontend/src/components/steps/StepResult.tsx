"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Copy, CheckCheck, Loader2, Sparkles, BookOpen, ArrowRight } from "lucide-react";
import type { JobPosting, Profile } from "@/app/generate/page";
import { saveCoverLetter } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Props {
  jobPosting: JobPosting;
  profile: Profile;
  prevCoverLetter: string | null;
  refLetterIds: number[];
  onBack: () => void;
}

interface QuestionResult {
  question: string;
  answer: string;
  done: boolean;
}

export default function StepResult({ jobPosting, profile, prevCoverLetter, refLetterIds, onBack }: Props) {
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [results]);

  const generate = async () => {
    setGenerating(true);
    setDone(false);
    setError(null);
    setResults([]);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";

      const res = await fetch("http://localhost:8000/api/cover-letter/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          job_posting: jobPosting,
          profile,
          prev_cover_letter: prevCoverLetter,
          reference_letter_ids: refLetterIds.length > 0 ? refLetterIds : null,
        }),
      });

      if (!res.ok) throw new Error("자소서 생성에 실패했습니다.");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          try {
            const event = JSON.parse(json);

            if (event.type === "question_start") {
              setResults((prev) => [
                ...prev,
                { question: event.question, answer: "", done: false },
              ]);
            } else if (event.type === "text") {
              setResults((prev) =>
                prev.map((r, i) =>
                  i === event.index ? { ...r, answer: r.answer + event.content } : r
                )
              );
            } else if (event.type === "question_end") {
              setResults((prev) =>
                prev.map((r, i) => (i === event.index ? { ...r, done: true } : r))
              );
            } else if (event.type === "done") {
              setDone(true);
            }
          } catch {
            // skip malformed
          }
        }
      }

      // 생성 완료 후 자동 저장
      setResults((finalResults) => {
        saveCoverLetter({
          job_posting: jobPosting,
          content_json: finalResults.map((r) => ({ question: r.question, answer: r.answer })),
        }).then((saved) => { if (saved) setSaved(true); });
        return finalResults;
      });

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const copyAnswer = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    const all = results
      .map((r, i) => `[문항 ${i + 1}] ${r.question}\n\n${r.answer}`)
      .join("\n\n" + "─".repeat(40) + "\n\n");
    navigator.clipboard.writeText(all);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl mb-1" style={{ color: "var(--text)" }}>
            자소서 생성 결과
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {jobPosting.company} · {jobPosting.position}
          </p>
        </div>
        {done && (
          <div className="flex items-center gap-2">
            {saved && (
              <Link
                href="/history"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all"
                style={{ border: "1px solid var(--border-light)", color: "var(--text-muted)" }}
              >
                <BookOpen size={13} /> 히스토리
              </Link>
            )}
            <button
              onClick={copyAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all"
              style={{
                border: "1px solid var(--border-light)",
                color: copiedIndex === -1 ? "var(--success)" : "var(--text-muted)",
              }}
            >
              {copiedIndex === -1 ? <CheckCheck size={13} /> : <Copy size={13} />}
              전체 복사
            </button>
          </div>
        )}
      </div>

      {/* Generating indicator */}
      {generating && results.length === 0 && (
        <div
          className="flex items-center gap-3 p-6 rounded-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
          >
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
              자소서를 작성하고 있어요
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
              Claude Sonnet이 최적의 답변을 생성 중입니다...
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-5">
        {results.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            {/* Question header */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                문항 {i + 1}
              </p>
              {r.done && (
                <button
                  onClick={() => copyAnswer(r.answer, i)}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{
                    color: copiedIndex === i ? "var(--success)" : "var(--text-dim)",
                  }}
                >
                  {copiedIndex === i ? <CheckCheck size={12} /> : <Copy size={12} />}
                  복사
                </button>
              )}
            </div>

            {/* Question text */}
            <div
              className="px-5 py-3"
              style={{ background: "var(--bg-hover)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {r.question}
              </p>
            </div>

            {/* Answer */}
            <div className="px-5 py-4" style={{ background: "var(--bg)" }}>
              <p
                className={`text-sm leading-7 whitespace-pre-wrap ${!r.done ? "cursor-blink" : ""}`}
                style={{ color: "var(--text)", fontFamily: "'Noto Serif KR', serif" }}
              >
                {r.answer || (
                  <span style={{ color: "var(--text-dim)" }}>작성 중...</span>
                )}
              </p>
            </div>

            {/* Generating badge */}
            {!r.done && (
              <div
                className="flex items-center gap-2 px-5 py-2"
                style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}
              >
                <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                  작성 중
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}

      <div ref={bottomRef} />

      {/* Actions */}
      {(done || error) && (
        <div className="space-y-3 pt-2">
          {done && saved && (
            <div className="flex items-center justify-between p-4 rounded-2xl"
              style={{ background: "color-mix(in srgb, var(--accent) 6%, var(--bg-card))", border: "1px solid color-mix(in srgb, var(--accent) 20%, var(--border))" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>자소서가 저장되었습니다</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>생성 기록에서 언제든지 확인할 수 있습니다</p>
              </div>
              <Link href="/history"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--bg)" }}>
                기록 보기 <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onBack}
              className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <ChevronLeft size={15} /> 이전
            </button>
            {error && (
              <button onClick={generate}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--bg)" }}>
                다시 생성
              </button>
            )}
            {done && (
              <Link href="/generate"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                새 자소서 생성
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
