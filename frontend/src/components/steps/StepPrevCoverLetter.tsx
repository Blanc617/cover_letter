"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Type, ChevronLeft, ChevronRight, X, BookMarked, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  onBack: () => void;
  onComplete: (text: string | null, refIds: number[]) => void;
}

type Mode = "none" | "saved" | "pdf" | "text";

type SavedLetter = {
  id: number;
  title: string;
  company: string | null;
  position: string | null;
  content: string;
  created_at: string;
};

const MAX_SELECT = 7;

export default function StepPrevCoverLetter({ onBack, onComplete }: Props) {
  const [mode, setMode] = useState<Mode>("none");

  // saved mode
  const [letters, setLetters] = useState<SavedLetter[]>([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  // pdf mode
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // text mode
  const [text, setText] = useState("");

  useEffect(() => {
    if (mode === "saved" && letters.length === 0 && !lettersLoading) {
      loadLetters();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const loadLetters = async () => {
    setLettersLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLettersLoading(false); return; }
    const { data } = await supabase
      .from("user_cover_letters")
      .select("id, title, company, position, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLetters(data ?? []);
    setLettersLoading(false);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, id];
    });
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

  const handleNext = async () => {
    if (mode === "none") {
      onComplete(null, []);
      return;
    }
    if (mode === "saved") {
      onComplete(null, selected);
      return;
    }
    if (mode === "text") {
      onComplete(text.trim() || null, []);
      return;
    }
    if (mode === "pdf" && file) {
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("http://localhost:8000/api/resume/parse-text", {
          method: "POST", body: form,
        });
        if (!res.ok) throw new Error("PDF 파싱에 실패했습니다.");
        const data = await res.json();
        onComplete(data.text, []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
  };

  const canNext =
    mode === "none" ||
    mode === "text" ||
    (mode === "pdf" && !!file) ||
    (mode === "saved" && selected.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl mb-2" style={{ color: "var(--text)" }}>
          참고 자소서 <span className="text-base font-normal" style={{ color: "var(--text-dim)" }}>(선택)</span>
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          참고할 자소서를 지정하면 문체·강점 방향성을 반영해 작성됩니다.
        </p>
      </div>

      {/* 입력 방식 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "none",  label: "건너뛰기",     icon: <X size={17} /> },
          { key: "saved", label: "저장된 자소서", icon: <BookMarked size={17} /> },
          { key: "pdf",   label: "PDF 업로드",   icon: <FileText size={17} /> },
          { key: "text",  label: "직접 입력",    icon: <Type size={17} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => { setMode(key as Mode); setFile(null); setText(""); setError(null); setSelected([]); }}
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

      {/* 저장된 자소서 선택 */}
      {mode === "saved" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              최대 {MAX_SELECT}개 선택 가능
            </p>
            <p className="text-xs font-medium" style={{ color: selected.length > 0 ? "var(--accent)" : "var(--text-dim)" }}>
              {selected.length} / {MAX_SELECT} 선택됨
            </p>
          </div>

          {lettersLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
            </div>
          ) : letters.length === 0 ? (
            <div className="text-center py-8 rounded-2xl space-y-2"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>저장된 자소서가 없습니다.</p>
              <a href="/my/cover-letters" className="text-xs" style={{ color: "var(--accent)" }}>
                자소서 관리에서 추가하기 →
              </a>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {letters.map((letter) => {
                const isSelected = selected.includes(letter.id);
                const isDisabled = !isSelected && selected.length >= MAX_SELECT;
                return (
                  <button
                    key={letter.id}
                    onClick={() => toggleSelect(letter.id)}
                    disabled={isDisabled}
                    className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-200 disabled:opacity-40"
                    style={{
                      background: isSelected ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--bg-card)",
                      border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {/* 체크박스 */}
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: isSelected ? "var(--accent)" : "var(--bg-hover)",
                        border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      }}
                    >
                      {isSelected && <Check size={12} style={{ color: "var(--bg)" }} />}
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {letter.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                        {[letter.company, letter.position].filter(Boolean).join(" · ")}
                        {letter.company || letter.position ? " · " : ""}
                        {new Date(letter.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PDF 업로드 */}
      {mode === "pdf" && (
        <div
          {...getRootProps()}
          className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200"
          style={{
            border: `1.5px dashed ${isDragActive || file ? "var(--accent)" : "var(--border-light)"}`,
            background: file ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "var(--bg-card)",
            minHeight: "160px",
          }}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)" }}>
            <FileText size={22} />
          </div>
          {file ? (
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{file.name}</p>
          ) : (
            <>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {isDragActive ? "여기에 놓으세요" : "PDF를 드래그하거나 클릭하여 업로드"}
              </p>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>PDF 파일만 지원</p>
            </>
          )}
        </div>
      )}

      {/* 텍스트 직접 입력 */}
      {mode === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="이전에 작성한 자소서 내용을 붙여넣어 주세요..."
          rows={10}
          className="w-full px-4 py-3 rounded-2xl text-sm outline-none resize-none leading-relaxed"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            color: "var(--text)",
          }}
        />
      )}

      {error && (
        <p className="text-sm text-center" style={{ color: "var(--error)" }}>{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onBack}
          className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <ChevronLeft size={15} /> 이전
        </button>
        <button
          onClick={handleNext}
          disabled={loading || !canNext}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--bg)" }}
        >
          {loading ? "PDF 파싱 중..." : mode === "none" ? "건너뛰고 생성하기" : "다음 단계로"}
          {!loading && <ChevronRight size={15} />}
        </button>
      </div>
    </div>
  );
}
