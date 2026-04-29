"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, PenLine, Plus, Trash2, AlignLeft, ListChecks } from "lucide-react";

export type UserDraft = {
  question: string;
  draft: string;
  char_limit?: string; // 예: "500자 이내" | "300~500자" | ""
};

type Mode = "freeform" | "questions";

interface Props {
  initialQuestions?: string[];
  onBack: () => void;
  onComplete: (drafts: UserDraft[]) => void;
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  minRows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className="w-full resize-none rounded-xl px-4 py-3 text-sm leading-6 outline-none transition-all duration-200"
      style={{
        background: "var(--bg)",
        border: "1.5px solid var(--border)",
        color: "var(--text)",
        minHeight: `${minRows * 24 + 24}px`,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    />
  );
}

export default function StepUserDrafts({ initialQuestions = [], onBack, onComplete }: Props) {
  const normalizedInitialQuestions = initialQuestions.map((q) => q.trim()).filter(Boolean);
  const hasInitialQuestions = normalizedInitialQuestions.length > 0;
  const [mode, setMode] = useState<Mode | null>(hasInitialQuestions ? "questions" : null);

  // 자유형식 상태
  const [freeDraft, setFreeDraft] = useState("");

  // 질문 작성 상태
  const [questions, setQuestions] = useState<string[]>(hasInitialQuestions ? normalizedInitialQuestions : [""]);
  const [drafts, setDrafts] = useState<string[]>(hasInitialQuestions ? normalizedInitialQuestions.map(() => "") : [""]);
  const [charMins, setCharMins] = useState<string[]>(hasInitialQuestions ? normalizedInitialQuestions.map(() => "") : [""]);
  const [charMaxes, setCharMaxes] = useState<string[]>(hasInitialQuestions ? normalizedInitialQuestions.map(() => "") : [""]);

  const setQuestion = (i: number, val: string) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? val : q)));

  const setDraft = (i: number, val: string) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? val : d)));

  const setCharMin = (i: number, val: string) =>
    setCharMins((prev) => prev.map((v, idx) => (idx === i ? val : v)));

  const setCharMax = (i: number, val: string) =>
    setCharMaxes((prev) => prev.map((v, idx) => (idx === i ? val : v)));

  const buildCharLimit = (i: number): string => {
    const min = charMins[i]?.trim();
    const max = charMaxes[i]?.trim();
    if (min && max) return `${min}~${max}자`;
    if (max) return `${max}자 이내`;
    if (min) return `${min}자 이상`;
    return "";
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, ""]);
    setDrafts((prev) => [...prev, ""]);
    setCharMins((prev) => [...prev, ""]);
    setCharMaxes((prev) => [...prev, ""]);
  };

  const removeQuestion = (i: number) => {
    if (questions.length === 1) {
      setQuestions([""]);
      setDrafts([""]);
      setCharMins([""]);
      setCharMaxes([""]);
      return;
    }
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
    setCharMins((prev) => prev.filter((_, idx) => idx !== i));
    setCharMaxes((prev) => prev.filter((_, idx) => idx !== i));
  };

  const hasValidQuestion = questions.some((q) => q.trim().length > 0);

  const canProceed =
    mode === "freeform" ||
    (mode === "questions" && hasValidQuestion);

  const handleComplete = () => {
    if (mode === "freeform") {
      onComplete(freeDraft.trim() ? [{ question: "", draft: freeDraft.trim() }] : []);
      return;
    }
    const result: UserDraft[] = questions
      .map((q, i) => ({
        question: q.trim(),
        draft: drafts[i].trim(),
        char_limit: buildCharLimit(i),
      }))
      .filter((item) => item.question.length > 0);
    onComplete(result);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl mb-2" style={{ color: "var(--text)" }}>
          자소서 유형 선택
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          지원하는 기업의 자소서 형식을 선택해주세요.
        </p>
      </div>

      {/* 유형 선택 */}
      <div className="grid grid-cols-2 gap-3">
        <ModeCard
          selected={mode === "freeform"}
          onClick={() => setMode("freeform")}
          icon={<AlignLeft size={20} />}
          title="자유형식"
          desc="형식 없이 자유롭게 작성하는 자소서"
        />
        <ModeCard
          selected={mode === "questions"}
          onClick={() => setMode("questions")}
          icon={<ListChecks size={20} />}
          title="질문 작성"
          desc="기업이 제시한 문항별로 작성하는 자소서"
        />
      </div>

      {/* 자유형식 */}
      {mode === "freeform" && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="px-5 py-4" style={{ background: "var(--bg-card)" }}>
            <div className="flex items-center gap-1.5 mb-3">
              <PenLine size={13} style={{ color: "var(--text-dim)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                강조하고 싶은 경험 · 키워드
              </span>
              <span className="text-xs ml-1" style={{ color: "var(--text-dim)" }}>(선택)</span>
            </div>
            <AutoResizeTextarea
              value={freeDraft}
              onChange={setFreeDraft}
              placeholder={"강조하고 싶은 경험, 역량, 키워드 등을 자유롭게 적어주세요.\n비워두면 AI가 이력서를 바탕으로 알아서 작성합니다."}
              minRows={4}
            />
            {freeDraft.trim().length > 0 && (
              <p className="text-xs mt-1.5 text-right" style={{ color: "var(--text-dim)" }}>
                {freeDraft.length}자
              </p>
            )}
          </div>
        </div>
      )}

      {/* 질문 작성 */}
      {mode === "questions" && (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {/* 질문 입력 */}
              <div className="px-5 py-4 space-y-2" style={{ background: "var(--bg-card)" }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{
                        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                      자소서 문항
                    </span>
                  </div>
                  <button
                    onClick={() => removeQuestion(i)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--text-dim)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--error)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
                    title="문항 삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <textarea
                  value={q}
                  onChange={(e) => setQuestion(i, e.target.value)}
                  placeholder="문항을 입력하세요. 예) 지원 동기와 입사 후 포부를 작성해주세요."
                  rows={2}
                  className="w-full resize-none rounded-xl px-4 py-3 text-sm leading-6 outline-none transition-all duration-200"
                  style={{
                    background: "var(--bg)",
                    border: "1.5px solid var(--border)",
                    color: "var(--text)",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />

                {/* 글자 수 제한 */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs flex-shrink-0" style={{ color: "var(--text-dim)" }}>
                    글자 수 제한
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={charMins[i]}
                    onChange={(e) => setCharMin(i, e.target.value)}
                    placeholder="최소"
                    className="w-20 px-3 py-1.5 rounded-lg text-xs outline-none text-center"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>~</span>
                  <input
                    type="number"
                    min={0}
                    value={charMaxes[i]}
                    onChange={(e) => setCharMax(i, e.target.value)}
                    placeholder="최대"
                    className="w-20 px-3 py-1.5 rounded-lg text-xs outline-none text-center"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  />
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>자</span>
                  {buildCharLimit(i) && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-md ml-1"
                      style={{
                        background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      {buildCharLimit(i)}
                    </span>
                  )}
                </div>
              </div>

              {/* 초안 입력 (선택) */}
              <div className="px-5 py-4" style={{ background: "var(--bg-hover)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <PenLine size={12} style={{ color: "var(--text-dim)" }} />
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                    답변 키워드 · 초안{" "}
                    <span style={{ opacity: 0.6 }}>(선택 — 비워도 AI가 알아서 작성)</span>
                  </span>
                </div>
                <AutoResizeTextarea
                  value={drafts[i]}
                  onChange={(v) => setDraft(i, v)}
                  placeholder={"이 문항에 넣고 싶은 경험, 키워드, 방향 등을 간략히 적어주세요.\n예) MSA 전환 프로젝트 주도, 대용량 트래픽 처리 경험 강조"}
                  minRows={3}
                />
                {drafts[i].trim().length > 0 && (
                  <p className="text-xs mt-1.5 text-right" style={{ color: "var(--text-dim)" }}>
                    {drafts[i].length}자
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* 문항 추가 */}
          <button
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
            style={{
              border: "1.5px dashed var(--border-light)",
              color: "var(--text-dim)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-light)";
              e.currentTarget.style.color = "var(--text-dim)";
            }}
          >
            <Plus size={15} /> 문항 추가
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <ChevronLeft size={15} /> 이전
        </button>

        <button
          onClick={handleComplete}
          disabled={!canProceed}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--bg)" }}
        >
          {!mode
            ? "유형을 선택해주세요"
            : mode === "freeform" || drafts.some((d) => d.trim())
            ? "초안으로 생성하기"
            : "AI에게 맡기기"}
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

function ModeCard({
  selected,
  onClick,
  icon,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 p-4 rounded-2xl text-left transition-all duration-200"
      style={{
        background: selected
          ? "color-mix(in srgb, var(--accent) 8%, var(--bg-card))"
          : "var(--bg-card)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      <div className="flex items-center gap-3 w-full">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: selected
              ? "color-mix(in srgb, var(--accent) 15%, transparent)"
              : "var(--bg-hover)",
            color: selected ? "var(--accent)" : "var(--text-dim)",
          }}
        >
          {icon}
        </div>
        <div
          className="w-4 h-4 rounded-full border-2 ml-auto flex-shrink-0 flex items-center justify-center"
          style={{
            borderColor: selected ? "var(--accent)" : "var(--border)",
          }}
        >
          {selected && (
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text)" }}>
          {title}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {desc}
        </p>
      </div>
    </button>
  );
}
