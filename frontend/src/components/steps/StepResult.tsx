"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft, Copy, CheckCheck, Loader2, Sparkles, BookOpen, ArrowRight,
  Download, MessageSquarePlus, Send, RotateCcw, FileText, TrendingUp,
  ThumbsUp, AlertCircle, X,
} from "lucide-react";
import type { JobPosting, Profile } from "@/app/generate/page";
import type { UserDraft } from "@/components/steps/StepUserDrafts";
import { saveCoverLetter, API_BASE } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Props {
  jobPosting: JobPosting;
  profile: Profile;
  prevCoverLetter: string | null;
  refLetterIds: number[];
  userDrafts: UserDraft[];
  onBack: () => void;
}

interface QuestionResult {
  question: string;
  answer: string;
  done: boolean;
}

interface EvaluationCriterion {
  name: string;
  score: number;
  good: string;
  weak: string;
}
interface Evaluation {
  criteria: EvaluationCriterion[];
}

export default function StepResult({ jobPosting, profile, prevCoverLetter, refLetterIds, userDrafts, onBack }: Props) {
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [stageMessage, setStageMessage] = useState<string>("준비 중...");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isFreeform, setIsFreeform] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<QuestionResult[]>([]);
  const userScrolledUpRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll only when user hasn't manually scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [results]);

  // Track user scroll intent
  useEffect(() => {
    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
      userScrolledUpRef.current = !nearBottom;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const processStream = async (res: Response, onStage?: (msg: string) => void) => {
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
          if (event.type === "error") {
            throw new Error(event.message ?? "생성 중 오류가 발생했습니다.");
          } else if (event.type === "meta") {
            if (event.is_freeform) setIsFreeform(true);
          } else if (event.type === "stage" && onStage) {
            onStage(event.message);
          } else if (event.type === "question_start") {
            setResults((prev) => {
              const next = [...prev, { question: event.question, answer: "", done: false }];
              resultsRef.current = next;
              return next;
            });
          } else if (event.type === "text") {
            setResults((prev) => {
              const next = prev.map((r, i) =>
                i === event.index ? { ...r, answer: r.answer + event.content } : r
              );
              resultsRef.current = next;
              return next;
            });
          } else if (event.type === "question_end") {
            setResults((prev) => {
              const next = prev.map((r, i) => (i === event.index ? { ...r, done: true } : r));
              resultsRef.current = next;
              return next;
            });
          } else if (event.type === "done") {
            // Force-mark all results as done before setting done=true
            setResults((prev) => {
              const next = prev.map((r) => ({ ...r, done: true }));
              resultsRef.current = next;
              return next;
            });
            setDone(true);
          }
        } catch {
          // skip malformed
        }
      }
    }
  };

  const evaluateCoverLetter = async (currentResults: QuestionResult[]) => {
    if (currentResults.length === 0) return;
    setEvaluating(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";

      const res = await fetch(`${API_BASE}/api/cover-letter/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          results: currentResults.map((r) => ({ question: r.question, answer: r.answer })),
          job_posting: jobPosting,
        }),
      });
      if (!res.ok) throw new Error(`evaluate failed: ${res.status}`);
      const evalData = await res.json();
      setEvaluation(evalData);
    } catch {
      setEvaluationError(true);
    } finally {
      setEvaluating(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setDone(false);
    setError(null);
    setResults([]);
    setEvaluation(null);
    setEvaluationError(false);
    setIsFreeform(false);
    userScrolledUpRef.current = false;

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";

      const abortCtrl = new AbortController();
      abortControllerRef.current = abortCtrl;

      const res = await fetch(`${API_BASE}/api/cover-letter/generate`, {
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
          user_drafts: userDrafts.length > 0 ? userDrafts : null,
        }),
        signal: abortCtrl.signal,
      });

      if (!res.ok) throw new Error("자소서 생성에 실패했습니다.");
      await processStream(res, setStageMessage);

      evaluateCoverLetter(resultsRef.current);

      saveCoverLetter({
        job_posting: jobPosting,
        content_json: resultsRef.current.map((r) => ({ question: r.question, answer: r.answer })),
      }).then(() => setSaved(true)).catch(() => setSaveError(true));

    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return; // user cancelled
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      abortControllerRef.current = null;
      setGenerating(false);
    }
  };

  const revise = async () => {
    if (!feedback.trim()) return;
    setRevising(true);
    setDone(false);
    setError(null);
    setResults([]);
    setEvaluation(null);
    setEvaluationError(false);
    userScrolledUpRef.current = false;

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";

      const abortCtrl = new AbortController();
      abortControllerRef.current = abortCtrl;

      const res = await fetch(`${API_BASE}/api/cover-letter/revise`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          results: resultsRef.current.map((r) => ({ question: r.question, answer: r.answer })),
          feedback: feedback.trim(),
          job_posting: jobPosting,
          profile,
        }),
        signal: abortCtrl.signal,
      });

      if (!res.ok) throw new Error("수정에 실패했습니다.");
      await processStream(res);
      setFeedback("");

      evaluateCoverLetter(resultsRef.current);

    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return; // user cancelled
      setError(e instanceof Error ? e.message : "수정 중 오류가 발생했습니다.");
    } finally {
      abortControllerRef.current = null;
      setRevising(false);
    }
  };

  const copyAnswer = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    const all = isFreeform
      ? results.map((r) => r.answer).join("\n\n")
      : results.map((r, i) => `[문항 ${i + 1}] ${r.question}\n\n${r.answer}`).join("\n\n" + "─".repeat(40) + "\n\n");
    navigator.clipboard.writeText(all);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadAsWord = () => {
    const body = isFreeform
      ? `<div style="font-size:11pt;line-height:2;white-space:pre-wrap;">${results[0]?.answer.replace(/</g, "&lt;").replace(/>/g, "&gt;") ?? ""}</div>`
      : results.map((r, i) => `
        <div style="margin-bottom:28pt;">
          <div style="font-size:10pt;color:#666;margin-bottom:6pt;padding-bottom:6pt;border-bottom:1px solid #e0e0e0;">
            문항 ${i + 1}. ${r.question}
          </div>
          <div style="font-size:11pt;line-height:2;white-space:pre-wrap;">${r.answer.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
      `).join('<div style="border-top:1px solid #ddd;margin:20pt 0;"></div>');

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'>
      <style>
        body { font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; margin: 2.5cm; color: #1a1a1a; }
        h1 { font-size: 16pt; font-weight: bold; margin-bottom: 4pt; }
        .sub { font-size: 10pt; color: #555; margin-bottom: 28pt; padding-bottom: 12pt; border-bottom: 2px solid #333; }
      </style>
      </head>
      <body>
        <h1>${jobPosting.company} · ${jobPosting.position} 자기소개서</h1>
        <div class="sub">${new Date().toLocaleDateString("ko-KR")} 작성</div>
        ${body}
      </body></html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${jobPosting.company}_${jobPosting.position}_자소서.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPDF = () => {
    const body = isFreeform
      ? `<div class="a">${results[0]?.answer.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") ?? ""}</div>`
      : results.map((r, i) => `
        <div class="item">
          <div class="q">문항 ${i + 1}. ${r.question.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <div class="a">${r.answer.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
        </div>
      `).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Noto Serif KR', '맑은 고딕', serif; padding: 2.5cm; color: #1a1a1a; font-size: 10.5pt; }
        h1 { font-size: 15pt; font-weight: 700; margin-bottom: 3pt; }
        .meta { font-size: 9pt; color: #666; margin-bottom: 2cm; padding-bottom: 10pt; border-bottom: 1.5pt solid #1a1a1a; }
        .item { margin-bottom: 1.6cm; page-break-inside: avoid; }
        .q { font-size: 9pt; color: #555; margin-bottom: 8pt; padding-bottom: 6pt; border-bottom: 0.5pt solid #ddd; }
        .a { font-size: 10.5pt; line-height: 2; }
        @media print { body { padding: 1cm; } }
      </style>
      </head><body>
        <h1>${jobPosting.company} · ${jobPosting.position} 자기소개서</h1>
        <div class="meta">${new Date().toLocaleDateString("ko-KR")} 작성</div>
        ${body}
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "var(--success, #22c55e)";
    if (score >= 6) return "#f59e0b";
    return "var(--error, #ef4444)";
  };

  const avgScore = evaluation
    ? Math.round((evaluation.criteria.reduce((sum, c) => sum + c.score, 0) / evaluation.criteria.length) * 10) / 10
    : null;

  const isStreaming = generating || revising;

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
        {isStreaming && results.length > 0 && (
          <button
            onClick={() => { abortControllerRef.current?.abort(); setGenerating(false); setRevising(false); setDone(true); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <X size={12} /> 중단
          </button>
        )}
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
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{stageMessage}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
              Claude Sonnet이 최적의 답변을 준비 중입니다...
            </p>
          </div>
          <button
            onClick={() => { abortControllerRef.current?.abort(); setGenerating(false); setDone(false); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <X size={12} /> 취소
          </button>
        </div>
      )}

      {/* Revising indicator */}
      {revising && results.length === 0 && (
        <div
          className="flex items-center gap-3 p-6 rounded-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
          >
            <RotateCcw size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>피드백을 반영하여 수정 중...</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>요청하신 내용을 반영하고 있습니다</p>
          </div>
          <button
            onClick={() => { abortControllerRef.current?.abort(); setRevising(false); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <X size={12} /> 취소
          </button>
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
            {/* Header: hidden for freeform */}
            {!isFreeform && (
              <>
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>문항 {i + 1}</p>
                  {r.done && (
                    <button
                      onClick={() => copyAnswer(r.answer, i)}
                      className="flex items-center gap-1 text-xs transition-colors"
                      style={{ color: copiedIndex === i ? "var(--success)" : "var(--text-dim)" }}
                    >
                      {copiedIndex === i ? <CheckCheck size={12} /> : <Copy size={12} />}
                      복사
                    </button>
                  )}
                </div>
                <div className="px-5 py-3" style={{ background: "var(--bg-hover)" }}>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{r.question}</p>
                </div>
              </>
            )}

            {/* Freeform: copy button in top-right of answer area */}
            {isFreeform && r.done && (
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
              >
                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>자유 형식 자기소개서</p>
                <button
                  onClick={() => copyAnswer(r.answer, i)}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{ color: copiedIndex === i ? "var(--success)" : "var(--text-dim)" }}
                >
                  {copiedIndex === i ? <CheckCheck size={12} /> : <Copy size={12} />}
                  복사
                </button>
              </div>
            )}

            {/* Answer */}
            <div className="px-5 py-4" style={{ background: "var(--bg)" }}>
              <p
                className={`text-sm leading-7 whitespace-pre-wrap ${!r.done ? "cursor-blink" : ""}`}
                style={{ color: "var(--text)", fontFamily: "'Noto Serif KR', serif" }}
              >
                {r.answer || <span style={{ color: "var(--text-dim)" }}>작성 중...</span>}
              </p>
            </div>

            {/* Footer: char count or generating badge */}
            <div
              className="flex items-center justify-between px-5 py-2"
              style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}
            >
              {!r.done ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {revising ? "수정 중" : "작성 중"}
                  </span>
                </div>
              ) : <div />}
              <span className="text-xs tabular-nums" style={{ color: "var(--text-dim)" }}>
                {r.answer.length.toLocaleString()}자
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--error)" }}>{error}</p>
      )}

      <div ref={bottomRef} />

      {/* ── 완료 후 영역 ── */}
      {done && (
        <div className="space-y-4 pt-1">

          {/* AI 평가 섹션 */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={15} style={{ color: "var(--accent)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>AI 자소서 평가</p>
              </div>
              {evaluating && (
                <div className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>평가 중...</span>
                </div>
              )}
              {avgScore !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>총점</span>
                  <span
                    className="text-sm font-bold px-2.5 py-0.5 rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${getScoreColor(avgScore)} 12%, transparent)`,
                      color: getScoreColor(avgScore),
                    }}
                  >
                    {avgScore} / 10
                  </span>
                </div>
              )}
            </div>

            {evaluating && !evaluation && (
              <div className="flex justify-center py-8">
                <div className="space-y-3 w-full px-6">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="flex items-center gap-3 animate-pulse">
                      <div className="h-3 rounded flex-1" style={{ background: "var(--border)" }} />
                      <div className="h-3 w-10 rounded" style={{ background: "var(--border)" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!evaluating && !evaluation && evaluationError && (
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>평가를 불러오지 못했습니다.</p>
                <button
                  onClick={() => evaluateCoverLetter(resultsRef.current)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                >
                  다시 시도
                </button>
              </div>
            )}

            {evaluation && (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {evaluation.criteria.map((c, i) => (
                  <div key={i} className="px-5 py-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.name}</span>
                      <span
                        className="text-sm font-bold tabular-nums px-2.5 py-0.5 rounded-lg"
                        style={{
                          background: `color-mix(in srgb, ${getScoreColor(c.score)} 12%, transparent)`,
                          color: getScoreColor(c.score),
                        }}
                      >
                        {c.score} / 10
                      </span>
                    </div>
                    {/* Score bar */}
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${c.score * 10}%`, background: getScoreColor(c.score) }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="flex gap-2">
                        <ThumbsUp size={12} className="shrink-0 mt-0.5" style={{ color: "#22c55e" }} />
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{c.good}</p>
                      </div>
                      <div className="flex gap-2">
                        <AlertCircle size={12} className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{c.weak}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 다운로드 버튼 */}
          <div
            className="rounded-2xl p-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>
              자소서 다운로드
            </p>
            <div className="flex gap-2">
              <button
                onClick={downloadAsWord}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" }}
              >
                <FileText size={15} />
                Word (.doc)
              </button>
              <button
                onClick={downloadAsPDF}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" }}
              >
                <Download size={15} />
                PDF
              </button>
            </div>
          </div>

          {/* 피드백 섹션 */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <MessageSquarePlus size={15} style={{ color: "var(--accent)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                AI에게 수정 요청
              </p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              수정하고 싶은 부분을 자유롭게 말씀해 주세요. AI가 피드백을 반영하여 다시 작성합니다.
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) revise();
              }}
              placeholder={"예) 2번 문항에서 KPMG 경험을 더 강조해줘.\n전체적으로 문장을 더 간결하게 줄여줘.\n지원 동기를 좀 더 구체적으로 써줘."}
              rows={3}
              className="w-full resize-none rounded-xl px-4 py-3 text-sm leading-6 outline-none transition-all"
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border)",
                color: "var(--text)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                Ctrl+Enter로 빠르게 제출
              </p>
              <button
                onClick={revise}
                disabled={!feedback.trim() || isStreaming}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                {revising
                  ? <><Loader2 size={14} className="animate-spin" /> 수정 중...</>
                  : <><Send size={14} /> 수정 요청</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 하단 액션 ── */}
      {(done || error) && (
        <div className="space-y-3 pt-1">
          {done && saved && (
            <div
              className="flex items-center justify-between p-4 rounded-2xl"
              style={{ background: "color-mix(in srgb, var(--accent) 6%, var(--bg-card))", border: "1px solid color-mix(in srgb, var(--accent) 20%, var(--border))" }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>자소서가 저장되었습니다</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>생성 기록에서 언제든지 확인할 수 있습니다</p>
              </div>
              <Link
                href="/history"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                기록 보기 <ArrowRight size={14} />
              </Link>
            </div>
          )}
          {done && saveError && (
            <div
              className="flex items-center justify-between p-4 rounded-2xl"
              style={{ background: "color-mix(in srgb, var(--error, #ef4444) 6%, var(--bg-card))", border: "1px solid color-mix(in srgb, var(--error, #ef4444) 20%, var(--border))" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>자동 저장에 실패했습니다.</p>
              <button
                onClick={() => {
                  setSaveError(false);
                  saveCoverLetter({
                    job_posting: jobPosting,
                    content_json: resultsRef.current.map((r) => ({ question: r.question, answer: r.answer })),
                  }).then(() => setSaved(true)).catch(() => setSaveError(true));
                }}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
              >
                다시 저장
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <ChevronLeft size={15} /> 이전
            </button>
            {error && (
              <button
                onClick={generate}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                다시 생성
              </button>
            )}
            {done && (
              <Link
                href="/generate"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
              >
                새 자소서 생성
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
