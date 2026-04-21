"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  FileText, Loader2, CheckCircle2, ChevronLeft, ChevronRight,
  X, BookMarked, Upload,
} from "lucide-react";
import type { Profile } from "@/app/generate/page";
import { createClient } from "@/lib/supabase/client";
import type { ResumeFormData } from "@/components/my/ResumeFormEditor";

interface Props {
  onBack: () => void;
  onComplete: (data: Profile) => void;
}

type SavedResume = {
  id: number;
  title: string;
  file_name: string | null;
  file_data: string | null;
  text_content: string | null;
  created_at: string;
};

function tryParseFormJson(text: string): ResumeFormData | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.name === "string") return parsed as ResumeFormData;
    return null;
  } catch { return null; }
}

function formDataToProfile(d: ResumeFormData): Profile {
  return {
    name: d.name,
    contact: { email: d.email, phone: d.phone },
    summary: d.introduction,
    skills: d.skills,
    experience: d.experience.map((e) => ({
      company: e.company,
      position: e.position,
      period: `${e.start} - ${e.current ? "현재" : e.end}`,
      description: e.description,
    })),
    education: d.education.map((e) => ({
      school: e.school,
      major: e.major,
      period: `${e.start} - ${e.end}`,
      degree: e.degree,
    })),
    projects: [],
    certifications: d.certifications.map((c) => c.name),
    activities: [],
  };
}


function DropArea({
  label, hint, required, file, onFile,
}: {
  label: string; hint: string; required: boolean;
  file: File | null; onFile: (f: File | null) => void;
}) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => { if (acceptedFiles[0]) onFile(acceptedFiles[0]); },
    [onFile]
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [] }, maxFiles: 1,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</p>
        {required ? (
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
            필수
          </span>
        ) : (
          <span className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg-hover)", color: "var(--text-dim)" }}>
            선택
          </span>
        )}
      </div>

      {file ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{
            background: "color-mix(in srgb, var(--accent) 6%, transparent)",
            border: "1.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          }}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span className="text-sm truncate" style={{ color: "var(--accent)" }}>{file.name}</span>
          </div>
          <button onClick={() => onFile(null)} className="ml-3 flex-shrink-0 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-dim)" }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div {...getRootProps()}
          className="rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200"
          style={{
            border: `1.5px dashed ${isDragActive ? "var(--accent)" : "var(--border-light)"}`,
            background: isDragActive ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "var(--bg-card)",
            minHeight: "120px",
          }}>
          <input {...getInputProps()} />
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)" }}>
            <FileText size={18} />
          </div>
          <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
            {isDragActive ? "여기에 놓으세요" : hint}
          </p>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>PDF 파일만 지원</p>
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

export default function StepResume({ onBack, onComplete }: Props) {
  const [mode, setMode] = useState<"upload" | "saved">("saved");

  // Upload mode
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);

  // Saved mode
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  // Common
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "saved" && savedResumes.length === 0 && !savedLoading) {
      loadSaved();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const loadSaved = async () => {
    setSavedLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavedLoading(false); return; }
    const { data } = await supabase
      .from("user_resumes")
      .select("id, title, file_name, file_data, text_content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSavedResumes(data ?? []);
    setSavedLoading(false);
  };

  const handleSelectSaved = async (resume: SavedResume) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // 1. 폼 JSON 이력서 → 직접 변환 (API 불필요)
      if (resume.text_content) {
        const formData = tryParseFormJson(resume.text_content);
        if (formData) {
          setResult(formDataToProfile(formData));
          return;
        }
      }

      // 2. 추출된 텍스트 → structure-text API (PDF 재업로드 없이)
      if (resume.text_content) {
        const res = await fetch("http://localhost:8000/api/resume/structure-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: resume.text_content }),
        });
        if (!res.ok) throw new Error("이력서 분석에 실패했습니다.");
        const data = await res.json();
        setResult(data.profile);
        return;
      }

      throw new Error("이 이력서는 불러올 수 없습니다. (저장된 텍스트가 없습니다)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const parseUpload = async () => {
    if (!resumeFile) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("resume", resumeFile);
      if (portfolioFile) form.append("portfolio", portfolioFile);
      const res = await fetch("http://localhost:8000/api/resume/parse", {
        method: "POST", body: form,
      });
      if (!res.ok) throw new Error("이력서 파싱에 실패했습니다.");
      const data = await res.json();
      setResult(data.profile);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const resetResult = () => { setResult(null); setError(null); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl mb-2" style={{ color: "var(--text)" }}>이력서 업로드</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          이력서는 필수, 포트폴리오는 선택입니다. 함께 업로드하면 더 정확한 자소서가 생성됩니다.
        </p>
      </div>

      {/* 모드 탭 */}
      {!result && (
        <div className="flex gap-2 p-1 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <button
            onClick={() => { setMode("saved"); resetResult(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all duration-200"
            style={{
              background: mode === "saved" ? "var(--bg)" : "transparent",
              color: mode === "saved" ? "var(--text)" : "var(--text-dim)",
              fontWeight: mode === "saved" ? 500 : 400,
              boxShadow: mode === "saved" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <BookMarked size={14} /> 저장된 이력서
          </button>
          <button
            onClick={() => { setMode("upload"); resetResult(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all duration-200"
            style={{
              background: mode === "upload" ? "var(--bg)" : "transparent",
              color: mode === "upload" ? "var(--text)" : "var(--text-dim)",
              fontWeight: mode === "upload" ? 500 : 400,
              boxShadow: mode === "upload" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Upload size={14} /> 직접 업로드
          </button>
        </div>
      )}

      {/* 업로드 모드 */}
      {mode === "upload" && !result && (
        <div className="space-y-4">
          <DropArea label="이력서" hint="PDF를 드래그하거나 클릭하여 업로드" required={true}
            file={resumeFile} onFile={(f) => { setResumeFile(f); resetResult(); }} />
          <DropArea label="포트폴리오" hint="PDF를 드래그하거나 클릭하여 업로드" required={false}
            file={portfolioFile} onFile={(f) => { setPortfolioFile(f); resetResult(); }} />
          {resumeFile && (
            <button onClick={parseUpload} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--bg)" }}>
              {loading ? (
                <><Loader2 size={16} className="animate-spin" />분석 중...</>
              ) : (
                <><FileText size={16} />{portfolioFile ? "이력서 + 포트폴리오 분석하기" : "이력서 분석하기"}</>
              )}
            </button>
          )}
        </div>
      )}

      {/* 저장된 이력서 모드 */}
      {mode === "saved" && !result && (
        <div className="space-y-3">
          {savedLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : savedResumes.length === 0 ? (
            <div className="text-center py-10 space-y-3 rounded-2xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>저장된 이력서가 없습니다.</p>
              <a href="/my/resumes" className="inline-block text-xs"
                style={{ color: "var(--accent)" }}>
                이력서 관리에서 추가하기 →
              </a>
            </div>
          ) : (
            savedResumes.map((r) => (
              <button key={r.id} onClick={() => handleSelectSaved(r)} disabled={loading}
                className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 hover:border-[var(--accent)] disabled:opacity-50"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{r.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                    {r.file_name ? "PDF 이력서" : "직접 작성 이력서"} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <ChevronRight size={15} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
              </button>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--error)" }}>{error}</p>
      )}

      {/* 결과 */}
      {result && (
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--success)" }}>분석 완료</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="이름" value={result.name} />
            {result.skills.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>기술 스택</p>
                <div className="flex flex-wrap gap-1">
                  {result.skills.slice(0, 8).map((s, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
                      {s}
                    </span>
                  ))}
                  {result.skills.length > 8 && (
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>+{result.skills.length - 8}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {result.experience.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>경력 ({result.experience.length}건)</p>
              <ul className="space-y-1">
                {result.experience.map((e, i) => (
                  <li key={i} className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                    {e.company} · {e.position} · {e.period}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setResult(null); setResumeFile(null); setPortfolioFile(null); setError(null); }}
              className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <ChevronLeft size={15} /> 다시 선택
            </button>
            <button onClick={() => onComplete(result)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--bg)" }}>
              다음 단계로 <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {!result && (
        <button onClick={onBack} className="flex items-center gap-1 text-sm transition-colors"
          style={{ color: "var(--text-dim)" }}>
          <ChevronLeft size={14} /> 이전 단계로
        </button>
      )}
    </div>
  );
}
