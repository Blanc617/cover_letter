"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, ImageIcon, Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import type { JobPosting } from "@/app/generate/page";

interface Props {
  onComplete: (data: JobPosting) => void;
}

export default function StepJobPosting({ onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobPosting | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch("http://localhost:8000/api/job-posting/analyze", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("분석에 실패했습니다.");
      const data = await res.json();
      setResult(data);
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
          채용 공고 업로드
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          지원하려는 채용 공고의 스크린샷 또는 이미지를 올려주세요.
        </p>
      </div>

      {/* Dropzone */}
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
          <img
            src={preview}
            alt="공고 미리보기"
            className="max-h-48 rounded-xl object-contain"
          />
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
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              PNG, JPG, WEBP 지원
            </p>
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
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              공고 분석 중...
            </>
          ) : (
            <>
              <Upload size={16} />
              공고 분석하기
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}

      {/* Result preview */}
      {result && (
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--success)" }}>
              공고 분석 완료
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="회사명" value={result.company} />
            <Field label="직무" value={result.position} />
            <Field label="고용 형태" value={result.employment_type} />
          </div>

          {result.questions.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>
                자소서 문항 ({result.questions.length}개)
              </p>
              <ul className="space-y-1">
                {result.questions.map((q, i) => (
                  <li
                    key={i}
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: "var(--bg-hover)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {i + 1}. {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => onComplete(result)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90 mt-2"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            다음 단계로
            <ChevronRight size={16} />
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
