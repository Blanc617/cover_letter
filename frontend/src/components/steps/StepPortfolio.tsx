"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  FileText, Loader2, ChevronLeft, ChevronRight,
  X, BookMarked, Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  onBack: () => void;
  onComplete: (portfolioText: string | null) => void;
}

type Mode = "none" | "saved" | "upload";

type SavedPortfolio = {
  id: number;
  title: string;
  file_name: string | null;
  text_content: string | null;
  category: string | null;
  created_at: string;
};

export default function StepPortfolio({ onBack, onComplete }: Props) {
  const [mode, setMode] = useState<Mode>("none");

  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("전체");
  const [extraTabs, setExtraTabs] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("doc_extra_tabs_user_portfolios");
      if (stored) setExtraTabs(JSON.parse(stored));
    } catch {}
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "saved" && portfolios.length === 0 && !portfoliosLoading) {
      loadPortfolios();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const loadPortfolios = async () => {
    setPortfoliosLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPortfoliosLoading(false); return; }
    const { data } = await supabase
      .from("user_portfolios")
      .select("id, title, file_name, text_content, category, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPortfolios(data ?? []);
    setPortfoliosLoading(false);
  };

  const handleSelectSaved = (portfolio: SavedPortfolio) => {
    if (!portfolio.text_content) {
      setError("이 포트폴리오는 텍스트 내용이 없어 사용할 수 없습니다.");
      return;
    }
    onComplete(portfolio.text_content.slice(0, 3000));
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [] }, maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/resume/parse-text`, {
        method: "POST", body: form,
      });
      if (!res.ok) throw new Error("PDF 파싱에 실패했습니다.");
      const data = await res.json();
      onComplete((data.text as string)?.slice(0, 3000) || null);
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
          포트폴리오{" "}
          <span className="text-base font-normal" style={{ color: "var(--text-dim)" }}>(선택)</span>
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          포트폴리오를 추가하면 프로젝트 경험을 더 정확하게 반영합니다.
        </p>
      </div>

      {/* 모드 선택 */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: "none",   label: "건너뛰기",          icon: <X size={17} /> },
          { key: "saved",  label: "저장된 포트폴리오",  icon: <BookMarked size={17} /> },
          { key: "upload", label: "PDF 업로드",         icon: <Upload size={17} /> },
        ] as { key: Mode; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => { setMode(key); setFile(null); setError(null); }}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl transition-all duration-200"
            style={{
              background: mode === key ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--bg-card)",
              border: `1.5px solid ${mode === key ? "var(--accent)" : "var(--border)"}`,
              color: mode === key ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {icon}
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* 저장된 포트폴리오 목록 */}
      {mode === "saved" && (
        <div className="space-y-2">
          {portfoliosLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : portfolios.length === 0 ? (
            <div className="text-center py-10 space-y-3 rounded-2xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>저장된 포트폴리오가 없습니다.</p>
              <a href="/my/portfolios" className="inline-block text-xs" style={{ color: "var(--accent)" }}>
                포트폴리오 관리에서 추가하기 →
              </a>
            </div>
          ) : (
            <>
              {/* 카테고리 탭 */}
              {(() => {
                const itemCats = portfolios.map((p) => p.category ?? "일반").filter((c) => c !== "일반");
                const allCustomCats = Array.from(new Set([...extraTabs, ...itemCats]));
                if (allCustomCats.length === 0) return null;
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["전체", ...allCustomCats].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                        style={{
                          background: activeCategory === cat ? "var(--accent)" : "var(--bg-card)",
                          color: activeCategory === cat ? "var(--bg)" : "var(--text-muted)",
                          border: `1px solid ${activeCategory === cat ? "var(--accent)" : "var(--border)"}`,
                        }}
                      >
                        {cat}
                        <span className="ml-1 opacity-70">
                          {cat === "전체" ? portfolios.length : portfolios.filter((p) => (p.category ?? "일반") === cat).length}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}

              {portfolios
                .filter((p) => activeCategory === "전체" || (p.category ?? "일반") === activeCategory || (activeCategory === "일반" && !p.category))
                .map((p) => (
                  <button key={p.id} onClick={() => handleSelectSaved(p)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 hover:border-[var(--accent)]"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{p.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                        {p.category ?? "일반"} · {new Date(p.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <ChevronRight size={15} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
                  </button>
                ))}
            </>
          )}
        </div>
      )}

      {/* PDF 업로드 */}
      {mode === "upload" && (
        <div className="space-y-4">
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
              <button onClick={() => setFile(null)} className="ml-3 flex-shrink-0 transition-opacity hover:opacity-70"
                style={{ color: "var(--text-dim)" }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div {...getRootProps()}
              className="rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200"
              style={{
                border: `1.5px dashed ${isDragActive ? "var(--accent)" : "var(--border-light)"}`,
                background: isDragActive ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "var(--bg-card)",
                minHeight: "160px",
              }}>
              <input {...getInputProps()} />
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)" }}>
                <FileText size={20} />
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {isDragActive ? "여기에 놓으세요" : "PDF를 드래그하거나 클릭하여 업로드"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>PDF 파일만 지원</p>
            </div>
          )}
          {file && (
            <button onClick={handleUpload} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--bg)" }}>
              {loading
                ? <><Loader2 size={16} className="animate-spin" />분석 중...</>
                : <><Upload size={16} />포트폴리오 분석하기</>}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-center" style={{ color: "var(--error)" }}>{error}</p>}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack}
          className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <ChevronLeft size={15} /> 이전
        </button>
        {mode === "none" && (
          <button onClick={() => onComplete(null)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--bg)" }}>
            건너뛰고 다음 단계로 <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
