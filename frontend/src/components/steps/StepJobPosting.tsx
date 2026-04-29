"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, ImageIcon, Loader2, CheckCircle2, ChevronRight, Plus, Trash2, Link } from "lucide-react";
import type { JobPosting } from "@/app/generate/page";

interface Props {
  onComplete: (data: JobPosting) => void;
}

type Mode = "image" | "url" | "manual";

const EMPTY_FORM: JobPosting = {
  company: "",
  position: "",
  employment_type: "",
  requirements: [""],
  preferred: [""],
  job_description: "",
  questions: [],
};

export default function StepJobPosting({ onComplete }: Props) {
  const [mode, setMode] = useState<Mode>("image");

  // ── 이미지 모드 상태 ──────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobPosting | null>(null);
  const [editResult, setEditResult] = useState<JobPosting | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── URL 모드 상태 ─────────────────────────────────────────────
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // ── 직접 입력 모드 상태 ───────────────────────────────────────
  const [form, setForm] = useState<JobPosting>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // ── 이미지 모드 핸들러 ────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
  });

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/job-posting/analyze`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("분석에 실패했습니다.");
      const data = await res.json();
      setResult(data);
      setEditResult({ ...data, requirements: data.requirements.length ? data.requirements : [""], preferred: data.preferred.length ? data.preferred : [""] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ── URL 모드 핸들러 ───────────────────────────────────────────
  const analyzeUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/job-posting/from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "분석에 실패했습니다.");
      }
      const data = await res.json();
      setResult(data);
      setEditResult({ ...data, requirements: data.requirements.length ? data.requirements : [""], preferred: data.preferred.length ? data.preferred : [""] });
    } catch (e: unknown) {
      setUrlError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setUrlLoading(false);
    }
  };

  // ── 직접 입력 모드 핸들러 ─────────────────────────────────────
  const setField = (key: keyof JobPosting, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setListItem = (key: "requirements" | "preferred", index: number, value: string) => {
    setForm((prev) => {
      const arr = [...prev[key]];
      arr[index] = value;
      return { ...prev, [key]: arr };
    });
  };

  const addListItem = (key: "requirements" | "preferred") => {
    setForm((prev) => ({ ...prev, [key]: [...prev[key], ""] }));
  };

  const removeListItem = (key: "requirements" | "preferred", index: number) => {
    setForm((prev) => {
      const arr = prev[key].filter((_, i) => i !== index);
      return { ...prev, [key]: arr.length > 0 ? arr : [""] };
    });
  };

  const submitManual = () => {
    setFormError(null);
    if (!form.company.trim()) return setFormError("회사명을 입력해주세요.");
    if (!form.position.trim()) return setFormError("직군/직무를 입력해주세요.");
    if (!form.job_description.trim()) return setFormError("주요 업무를 입력해주세요.");
    const validReqs = form.requirements.filter((r) => r.trim());
    if (validReqs.length === 0) return setFormError("자격 요건을 최소 1개 입력해주세요.");

    onComplete({
      ...form,
      requirements: validReqs,
      preferred: form.preferred.filter((p) => p.trim()),
      questions: form.questions.filter((q) => q.trim()),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl mb-2" style={{ color: "var(--text)" }}>
          채용 공고 입력
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          공고 이미지를 업로드하거나 직접 입력하세요.
        </p>
      </div>

      {/* 모드 탭 */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {(["image", "url", "manual"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setResult(null); setEditResult(null); setError(null); setUrlError(null); }}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: mode === m ? "var(--accent)" : "transparent",
              color: mode === m ? "var(--bg)" : "var(--text-muted)",
            }}
          >
            {m === "image" ? "이미지 업로드" : m === "url" ? "URL 입력" : "직접 입력"}
          </button>
        ))}
      </div>

      {/* ── 이미지 모드 ────────────────────────────────────────── */}
      {mode === "image" && (
        <>
          <div
            {...getRootProps()}
            className="dropzone rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200"
            style={{
              border: `1.5px dashed ${isDragActive ? "var(--accent)" : "var(--border-light)"}`,
              background: isDragActive ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "var(--bg-card)",
              minHeight: "200px",
            }}
          >
            <input {...getInputProps()} />
            {preview ? (
              <img src={preview} alt="공고 미리보기" className="max-h-48 rounded-xl object-contain" />
            ) : (
              <>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                >
                  <ImageIcon size={22} />
                </div>
                <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
                  {isDragActive ? "여기에 놓으세요" : "이미지를 드래그하거나 클릭하여 업로드"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>PNG, JPG, WEBP 지원</p>
              </>
            )}
          </div>

          {file && !result && (
            <button
              onClick={analyze}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" />공고 분석 중...</> : <><Upload size={16} />공고 분석하기</>}
            </button>
          )}

          {error && <p className="text-sm text-center" style={{ color: "var(--error)" }}>{error}</p>}
        </>
      )}

      {/* ── URL 모드 ───────────────────────────────────────────── */}
      {mode === "url" && !result && (
        <div className="space-y-3">
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Link size={14} style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>채용 공고 URL</span>
            </div>
            <input
              type="url"
              placeholder="https://www.saramin.co.kr/..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyzeUrl()}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "var(--bg)", border: "1.5px solid var(--border)", color: "var(--text)" }}
            />
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              사람인, 잡코리아, 링크드인, 회사 공식 채용 페이지 등 지원
            </p>
          </div>
          {urlError && <p className="text-sm text-center" style={{ color: "var(--error)" }}>{urlError}</p>}
          <button
            onClick={analyzeUrl}
            disabled={urlLoading || !urlInput.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            {urlLoading ? <><Loader2 size={16} className="animate-spin" />공고 분석 중...</> : <><Upload size={16} />공고 분석하기</>}
          </button>
        </div>
      )}

      {/* ── 이미지/URL 분석 결과 공통 편집 UI ─────────────────── */}
      {(mode === "image" || mode === "url") && result && editResult && (
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--success)" }}>공고 분석 완료 — 수정 후 다음으로</span>
              </div>

              {/* 기본 정보 편집 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>회사명</p>
                  <input value={editResult.company} onChange={(e) => setEditResult({ ...editResult, company: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>직무</p>
                  <input value={editResult.position} onChange={(e) => setEditResult({ ...editResult, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>고용 형태</p>
                  <input value={editResult.employment_type} onChange={(e) => setEditResult({ ...editResult, employment_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)" }} />
                </div>
              </div>

              {/* 주요 업무 */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>주요 업무</p>
                <textarea value={editResult.job_description} onChange={(e) => setEditResult({ ...editResult, job_description: e.target.value })}
                  rows={3} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                  style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text)" }} />
              </div>

              {/* 자격 요건 */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>자격 요건</p>
                <ListInput
                  items={editResult.requirements}
                  placeholder="자격 요건"
                  onChange={(i, v) => { const arr = [...editResult.requirements]; arr[i] = v; setEditResult({ ...editResult, requirements: arr }); }}
                  onAdd={() => setEditResult({ ...editResult, requirements: [...editResult.requirements, ""] })}
                  onRemove={(i) => { const arr = editResult.requirements.filter((_, idx) => idx !== i); setEditResult({ ...editResult, requirements: arr.length ? arr : [""] }); }}
                />
              </div>

              {/* 우대 사항 */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>우대 사항</p>
                <ListInput
                  items={editResult.preferred}
                  placeholder="우대 사항"
                  onChange={(i, v) => { const arr = [...editResult.preferred]; arr[i] = v; setEditResult({ ...editResult, preferred: arr }); }}
                  onAdd={() => setEditResult({ ...editResult, preferred: [...editResult.preferred, ""] })}
                  onRemove={(i) => { const arr = editResult.preferred.filter((_, idx) => idx !== i); setEditResult({ ...editResult, preferred: arr.length ? arr : [""] }); }}
                />
              </div>

              {/* 자소서 문항 */}
              <div>
                <p className="text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>자소서 문항 <span style={{ opacity: 0.6 }}>(선택)</span></p>
                <ListInput
                  items={editResult.questions.length > 0 ? editResult.questions : [""]}
                  placeholder="예) 지원 동기와 입사 후 포부를 작성해주세요."
                  multiline
                  onChange={(i, v) => { const arr = [...(editResult.questions.length > 0 ? editResult.questions : [""])]; arr[i] = v; setEditResult({ ...editResult, questions: arr }); }}
                  onAdd={() => setEditResult({ ...editResult, questions: [...(editResult.questions.length > 0 ? editResult.questions : [""]), ""] })}
                  onRemove={(i) => { const arr = (editResult.questions.length > 0 ? editResult.questions : [""]).filter((_, idx) => idx !== i); setEditResult({ ...editResult, questions: arr }); }}
                />
              </div>

              <button
                onClick={() => onComplete({
                  ...editResult,
                  requirements: editResult.requirements.filter(r => r.trim()),
                  preferred: editResult.preferred.filter(p => p.trim()),
                  questions: (editResult.questions ?? []).filter(q => q.trim()),
                })}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                다음 단계로 <ChevronRight size={16} />
              </button>
            </div>
      )}

      {/* ── 직접 입력 모드 ─────────────────────────────────────── */}
      {mode === "manual" && (
        <div className="space-y-5">
          {/* 회사명 + 직군 */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="회사명" required>
              <input
                type="text"
                placeholder="예) 카카오"
                value={form.company}
                onChange={(e) => setField("company", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </FormField>
            <FormField label="직군 / 직무" required>
              <input
                type="text"
                placeholder="예) 백엔드 개발자"
                value={form.position}
                onChange={(e) => setField("position", e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </FormField>
          </div>

          {/* 주요 업무 */}
          <FormField label="주요 업무" required hint="어떤 일을 하는 직무인지 구체적일수록 좋아요">
            <textarea
              placeholder="예) 서버 API 개발 및 운영, 대용량 트래픽 처리, MSA 설계..."
              value={form.job_description}
              onChange={(e) => setField("job_description", e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </FormField>

          {/* 자격 요건 */}
          <FormField label="자격 요건" required hint="공고에 적힌 필수 요건을 항목별로 입력하세요">
            <ListInput
              items={form.requirements}
              placeholder="예) Java/Spring 경험 3년 이상"
              onChange={(i, v) => setListItem("requirements", i, v)}
              onAdd={() => addListItem("requirements")}
              onRemove={(i) => removeListItem("requirements", i)}
            />
          </FormField>

          {/* 우대 사항 */}
          <FormField label="우대 사항" hint="선택 사항이지만 있으면 더 정확해요">
            <ListInput
              items={form.preferred}
              placeholder="예) Kubernetes 경험자"
              onChange={(i, v) => setListItem("preferred", i, v)}
              onAdd={() => addListItem("preferred")}
              onRemove={(i) => removeListItem("preferred", i)}
            />
          </FormField>

          {formError && (
            <p className="text-sm" style={{ color: "var(--error)" }}>{formError}</p>
          )}

          <button
            onClick={submitManual}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            다음 단계로 <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{value}</p>
    </div>
  );
}

function FormField({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</label>
        {required && <span className="text-xs" style={{ color: "var(--accent)" }}>*</span>}
      </div>
      {hint && <p className="text-xs" style={{ color: "var(--text-dim)" }}>{hint}</p>}
      {children}
    </div>
  );
}

function ListInput({
  items, placeholder, onChange, onAdd, onRemove, multiline = false,
}: {
  items: string[];
  placeholder: string;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          {multiline ? (
            <textarea
              value={item}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder={placeholder}
              rows={2}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          ) : (
            <input
              type="text"
              value={item}
              onChange={(e) => onChange(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          )}
          {items.length > 1 && (
            <button
              onClick={() => onRemove(i)}
              className="px-2 rounded-xl transition-colors shrink-0"
              style={{ color: "var(--text-dim)" }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors"
        style={{ color: "var(--accent)", border: "1px dashed color-mix(in srgb, var(--accent) 40%, transparent)" }}
      >
        <Plus size={13} /> 항목 추가
      </button>
    </div>
  );
}
