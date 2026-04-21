"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, Trash2, PenLine,
  CheckCircle2, Plus, X, ChevronDown, ChevronUp, Download, FolderPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";

type CoverLetter = {
  id: number;
  title: string;
  company: string | null;
  position: string | null;
  category: string;
  content: string;
  created_at: string;
};

const DEFAULT_CATEGORY = "일반";

export default function MyCoverLettersPage() {
  const supabase = createClient();

  const [items, setItems] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<string>("전체");
  const [showNewTab, setShowNewTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const newTabInputRef = useRef<HTMLInputElement>(null);

  // 폼 상태
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 카테고리 목록 (items에서 추출 + 사용자가 추가한 빈 탭 포함)
  const [extraTabs, setExtraTabs] = useState<string[]>([]);

  const categories = Array.from(
    new Set([
      DEFAULT_CATEGORY,
      ...extraTabs,
      ...items.map((i) => i.category ?? DEFAULT_CATEGORY),
    ])
  );

  const filteredItems =
    activeTab === "전체"
      ? items
      : items.filter((i) => (i.category ?? DEFAULT_CATEGORY) === activeTab);

  // ── Load ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("user_cover_letters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const fetched = (data as CoverLetter[]) ?? [];
    setItems(fetched);
    if (fetched.length === 0) setShowForm(true);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // 새 탭 추가
  const addTab = () => {
    const name = newTabName.trim();
    if (!name || categories.includes(name)) {
      setShowNewTab(false);
      setNewTabName("");
      return;
    }
    setExtraTabs((prev) => [...prev, name]);
    setActiveTab(name);
    setShowNewTab(false);
    setNewTabName("");
  };

  useEffect(() => {
    if (showNewTab) newTabInputRef.current?.focus();
  }, [showNewTab]);

  // ── Save ──────────────────────────────────────────────────
  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const { error: dbErr } = await supabase.from("user_cover_letters").insert({
        user_id: user.id,
        title: title.trim(),
        company: company.trim() || null,
        position: position.trim() || null,
        category: category || DEFAULT_CATEGORY,
        content: content.trim(),
      });
      if (dbErr) throw dbErr;

      setTitle(""); setCompany(""); setPosition(""); setContent("");
      setCategory(activeTab !== "전체" ? activeTab : DEFAULT_CATEGORY);
      setShowForm(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ── Download ──────────────────────────────────────────────
  const downloadItem = (item: CoverLetter) => {
    const lines = [
      item.title,
      item.company || item.position ? `${item.company ?? ""}${item.position ? ` · ${item.position}` : ""}` : "",
      "",
      item.content,
    ].filter((l, i) => i !== 1 || l);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Delete ────────────────────────────────────────────────
  const deleteItem = async (item: CoverLetter) => {
    if (!confirm(`"${item.title}"을(를) 삭제하시겠습니까?`)) return;
    await supabase.from("user_cover_letters").delete().eq("id", item.id);
    load();
  };

  const openForm = () => {
    setTitle(""); setCompany(""); setPosition(""); setContent("");
    setCategory(activeTab !== "전체" ? activeTab : DEFAULT_CATEGORY);
    setError(null);
    setShowForm(true);
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <PageHeader pageTitle="내 자소서 관리" />

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* ── 직무 탭 바 ── */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* 전체 탭 */}
          <button
            onClick={() => setActiveTab("전체")}
            className="px-4 py-1.5 rounded-full text-sm transition-all duration-150 font-medium"
            style={{
              background: activeTab === "전체" ? "var(--accent)" : "var(--bg-card)",
              color: activeTab === "전체" ? "var(--bg)" : "var(--text-muted)",
              border: `1px solid ${activeTab === "전체" ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            전체
            <span
              className="ml-1.5 text-xs"
              style={{ opacity: 0.7 }}
            >
              {items.length}
            </span>
          </button>

          {/* 카테고리 탭들 */}
          {categories.filter((c) => c !== "일반" || extraTabs.includes("일반") || items.some((i) => (i.category ?? DEFAULT_CATEGORY) === "일반")).map((cat) => {
            const count = items.filter((i) => (i.category ?? DEFAULT_CATEGORY) === cat).length;
            const isActive = activeTab === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className="px-4 py-1.5 rounded-full text-sm transition-all duration-150 font-medium"
                style={{
                  background: isActive ? "var(--accent)" : "var(--bg-card)",
                  color: isActive ? "var(--bg)" : "var(--text-muted)",
                  border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {cat}
                <span className="ml-1.5 text-xs" style={{ opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}

          {/* 새 직무 추가 */}
          {showNewTab ? (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ border: "1px solid var(--accent)", background: "var(--bg-card)" }}
            >
              <input
                ref={newTabInputRef}
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTab();
                  if (e.key === "Escape") { setShowNewTab(false); setNewTabName(""); }
                }}
                placeholder="직무명 입력"
                className="text-sm outline-none w-24 bg-transparent"
                style={{ color: "var(--text)" }}
              />
              <button onClick={addTab} style={{ color: "var(--accent)" }}>
                <CheckCircle2 size={15} />
              </button>
              <button onClick={() => { setShowNewTab(false); setNewTabName(""); }} style={{ color: "var(--text-dim)" }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewTab(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
              style={{
                border: "1px dashed var(--border-light)",
                color: "var(--text-dim)",
                background: "transparent",
              }}
            >
              <FolderPlus size={13} /> 새 직무
            </button>
          )}
        </div>

        {/* ── 추가 버튼 ── */}
        {!showForm && (
          <button
            onClick={openForm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            <Plus size={15} /> 자소서 추가
          </button>
        )}

        {/* ── 입력 폼 ── */}
        {showForm && (
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                새 자소서 작성
              </span>
              <button onClick={() => setShowForm(false)} style={{ color: "var(--text-dim)" }}>
                <X size={18} />
              </button>
            </div>

            {/* 직무 카테고리 선택 */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>
                직무 분야
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className="px-3 py-1 rounded-full text-xs transition-all"
                    style={{
                      background: category === cat ? "var(--accent)" : "color-mix(in srgb, var(--accent) 8%, transparent)",
                      color: category === cat ? "var(--bg)" : "var(--accent)",
                      border: `1px solid ${category === cat ? "var(--accent)" : "color-mix(in srgb, var(--accent) 25%, transparent)"}`,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>
                제목 <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 카카오 2025 상반기 자소서"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>회사명</label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="예: 카카오"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>직무</label>
                <input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="예: 해외 영업"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>
                자소서 내용 <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                placeholder="자소서 내용을 입력하세요..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y leading-relaxed"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontFamily: "'Noto Serif KR', serif",
                }}
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: "var(--error)" }}>{error}</p>
            )}

            <button
              onClick={save}
              disabled={saving || !title.trim() || !content.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--bg)" }}
            >
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> 저장 중...</>
                : <><CheckCircle2 size={15} /> 저장하기</>}
            </button>
          </div>
        )}

        {/* ── 목록 ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              {activeTab === "전체"
                ? "아직 저장된 자소서가 없습니다."
                : `"${activeTab}" 직무의 자소서가 없습니다.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {/* 카드 헤더 */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      <PenLine size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {/* 직무 분야 배지 */}
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                            color: "var(--accent)",
                            border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                          }}
                        >
                          {item.category ?? DEFAULT_CATEGORY}
                        </span>
                        {item.company && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {item.company}{item.position ? ` · ${item.position}` : ""}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                          {new Date(item.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadItem(item); }}
                      className="p-2 rounded-lg transition-colors hover:text-[var(--accent)]"
                      style={{ color: "var(--text-dim)" }}
                      title="다운로드"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
                      className="p-2 rounded-lg transition-colors hover:text-[var(--error)]"
                      style={{ color: "var(--text-dim)" }}
                    >
                      <Trash2 size={15} />
                    </button>
                    <span style={{ color: "var(--text-dim)" }}>
                      {expandedId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </div>
                </div>

                {/* 펼쳐진 내용 */}
                {expandedId === item.id && (
                  <div
                    className="px-5 pb-5"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <p
                      className="text-sm leading-8 whitespace-pre-wrap pt-4"
                      style={{
                        color: "var(--text)",
                        fontFamily: "'Noto Serif KR', serif",
                      }}
                    >
                      {item.content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
