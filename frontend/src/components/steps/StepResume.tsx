"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import type { Profile } from "@/app/generate/page";

interface Props {
  onBack: () => void;
  onComplete: (data: Profile) => void;
}

export default function StepResume({ onBack, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [] },
    maxFiles: 1,
  });

  const parse = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("http://localhost:8000/api/resume/parse", {
        method: "POST",
        body: form,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl mb-2" style={{ color: "var(--text)" }}>
          이력서 업로드
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          PDF 형식의 이력서 또는 포트폴리오를 올려주세요.
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200"
        style={{
          border: `1.5px dashed ${isDragActive || file ? "var(--accent)" : "var(--border-light)"}`,
          background: file ? "rgba(201,169,110,0.04)" : "var(--bg-card)",
          minHeight: "180px",
        }}
      >
        <input {...getInputProps()} />
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: file ? "rgba(201,169,110,0.15)" : "rgba(201,169,110,0.08)",
            color: "var(--accent)",
          }}
        >
          <FileText size={22} />
        </div>
        {file ? (
          <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            {file.name}
          </p>
        ) : (
          <>
            <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
              {isDragActive ? "여기에 놓으세요" : "PDF를 드래그하거나 클릭하여 업로드"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              PDF 파일만 지원
            </p>
          </>
        )}
      </div>

      {file && !result && (
        <button
          onClick={parse}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--bg)" }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              이력서 분석 중...
            </>
          ) : (
            <>
              <FileText size={16} />
              이력서 분석하기
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}

      {/* Result */}
      {result && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--success)" }}>
              이력서 분석 완료
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="이름" value={result.name} />
            {result.skills.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>기술 스택</p>
                <div className="flex flex-wrap gap-1">
                  {result.skills.slice(0, 8).map((s, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(201,169,110,0.12)",
                        color: "var(--accent)",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                  {result.skills.length > 8 && (
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                      +{result.skills.length - 8}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {result.experience.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>
                경력 ({result.experience.length}건)
              </p>
              <ul className="space-y-1">
                {result.experience.map((e, i) => (
                  <li
                    key={i}
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                  >
                    {e.company} · {e.position} · {e.period}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onBack}
              className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              <ChevronLeft size={15} /> 이전
            </button>
            <button
              onClick={() => onComplete(result)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              자소서 생성하기 <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {!result && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm transition-colors"
          style={{ color: "var(--text-dim)" }}
        >
          <ChevronLeft size={14} /> 이전 단계로
        </button>
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
