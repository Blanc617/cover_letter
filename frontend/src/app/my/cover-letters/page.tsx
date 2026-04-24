"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Loader2, Trash2, PenLine, FileText,
  CheckCircle2, Plus, X, ChevronDown, ChevronUp, Download, FolderPlus, Square, CheckSquare, Upload, Pencil,
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

  // 선택 삭제
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 직무 이동
  const [movingItemId, setMovingItemId] = useState<number | null>(null);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<string>("전체");
  const [tabEditMode, setTabEditMode] = useState(false);
  const [showNewTab, setShowNewTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const newTabInputRef = useRef<HTMLInputElement>(null);
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editingTabRef = useRef<HTMLInputElement>(null);

  // 폼 상태
  const [inputTab, setInputTab] = useState<"text" | "pdf">("pdf");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF 업로드 상태
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const onDrop = useCallback((files: File[]) => {
    if (!files.length) return;
    setPdfFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...files.filter((f) => !existingNames.has(f.name))];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [] }, multiple: true,
  });

  const uploadPdf = async () => {
    if (!pdfFiles.length) return;
    setUploading(true);
    setError(null);
    setUploadProgress({ done: 0, total: pdfFiles.length });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/resume/parse-text`, {
          method: "POST", body: form,
        });
        if (!res.ok) throw new Error(`${file.name} 파싱에 실패했습니다.`);
        const data = await res.json();

        const { error: dbErr } = await supabase.from("user_cover_letters").insert({
          user_id: user.id,
          title: file.name.replace(/\.pdf$/i, ""),
          company: null,
          position: null,
          category: (activeTab !== "전체" ? activeTab : category) || DEFAULT_CATEGORY,
          content: (data.text as string) || "",
        });
        if (dbErr) throw dbErr;
        setUploadProgress({ done: i + 1, total: pdfFiles.length });
      }

      setPdfFiles([]);
      setShowForm(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // 카테고리 목록 (items에서 추출 + 사용자가 추가한 빈 탭 포함)
  const STORAGE_KEY = "cover_letter_extra_tabs";
  const [extraTabs, setExtraTabs] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setExtraTabs(JSON.parse(stored));
    } catch {}
  }, []);

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

  useEffect(() => {
    if (movingItemId === null) return;
    const close = () => setMovingItemId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [movingItemId]);

  // 새 탭 추가
  const addTab = () => {
    const name = newTabName.trim();
    if (!name || categories.includes(name)) {
      setShowNewTab(false);
      setNewTabName("");
      return;
    }
    setExtraTabs((prev) => {
      const next = [...prev, name];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setActiveTab(name);
    setShowNewTab(false);
    setNewTabName("");
  };

  useEffect(() => {
    if (showNewTab) newTabInputRef.current?.focus();
  }, [showNewTab]);

  useEffect(() => {
    if (editingTab) editingTabRef.current?.focus();
  }, [editingTab]);

  const startEditTab = (cat: string) => {
    setEditingTab(cat);
    setEditingName(cat);
  };

  const confirmEditTab = async () => {
    if (!editingTab) return;
    const newName = editingName.trim();
    if (!newName || newName === editingTab) { setEditingTab(null); return; }
    if (categories.includes(newName)) { setEditingTab(null); return; }

    setExtraTabs((prev) => {
      const next = prev.map((t) => t === editingTab ? newName : t);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_cover_letters").update({ category: newName })
        .eq("user_id", user.id).eq("category", editingTab);
    }
    if (activeTab === editingTab) setActiveTab(newName);
    setEditingTab(null);
    load();
  };

  const deleteTab = async (cat: string) => {
    if (!confirm(`"${cat}" 직무를 삭제하시겠습니까?\n해당 직무의 자소서는 "일반"으로 이동됩니다.`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_cover_letters").update({ category: "일반" })
        .eq("user_id", user.id).eq("category", cat);
    }
    setExtraTabs((prev) => {
      const next = prev.filter((t) => t !== cat);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    if (activeTab === cat) setActiveTab("전체");
    load();
  };

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
        category: (activeTab !== "전체" ? activeTab : category) || DEFAULT_CATEGORY,
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

  // ── Move category ─────────────────────────────────────────
  const moveItemCategory = async (itemId: number, newCat: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_cover_letters").update({ category: newCat }).eq("id", itemId).eq("user_id", user.id);
    setMovingItemId(null);
    load();
  };

  // ── Delete ────────────────────────────────────────────────
  const deleteItem = async (item: CoverLetter) => {
    if (!confirm(`"${item.title}"을(를) 삭제하시겠습니까?`)) return;
    await supabase.from("user_cover_letters").delete().eq("id", item.id);
    load();
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개를 삭제하시겠습니까?`)) return;
    await supabase.from("user_cover_letters").delete().in("id", Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectionMode(false);
    load();
  };

  const deleteAll = async () => {
    if (!confirm(`${filteredItems.length}개를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    await supabase.from("user_cover_letters").delete().in("id", filteredItems.map((i) => i.id));
    setSelectedIds(new Set());
    setSelectionMode(false);
    load();
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const openForm = () => {
    setTitle(""); setCompany(""); setPosition(""); setContent("");
    setPdfFiles([]);
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
          {categories.filter((c) => c !== DEFAULT_CATEGORY).map((cat) => {
            const count = items.filter((i) => (i.category ?? DEFAULT_CATEGORY) === cat).length;
            const isActive = activeTab === cat;
            const isCustom = cat !== DEFAULT_CATEGORY;

            if (editingTab === cat) {
              return (
                <div key={cat} className="flex items-center gap-1 px-2 py-1 rounded-full"
                  style={{ border: "1px solid var(--accent)", background: "var(--bg-card)" }}>
                  <input
                    ref={editingTabRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEditTab();
                      if (e.key === "Escape") setEditingTab(null);
                    }}
                    onBlur={confirmEditTab}
                    className="text-sm outline-none w-20 bg-transparent"
                    style={{ color: "var(--text)" }}
                  />
                  <button onMouseDown={(e) => e.preventDefault()} onClick={confirmEditTab} style={{ color: "var(--accent)" }}>
                    <CheckCircle2 size={14} />
                  </button>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingTab(null)} style={{ color: "var(--text-dim)" }}>
                    <X size={13} />
                  </button>
                </div>
              );
            }

            return (
              <div key={cat} className="flex items-center"
                style={{
                  background: isActive ? "var(--accent)" : "var(--bg-card)",
                  border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "9999px",
                  overflow: "hidden",
                }}>
                <button
                  onClick={() => setActiveTab(cat)}
                  className="px-4 py-1.5 text-sm font-medium transition-all duration-150"
                  style={{
                    color: isActive ? "var(--bg)" : "var(--text-muted)",
                    background: "transparent",
                  }}
                >
                  {cat}
                  <span className="ml-1.5 text-xs" style={{ opacity: 0.7 }}>{count}</span>
                </button>
                {tabEditMode && isCustom && (
                  <>
                    <button
                      onClick={() => startEditTab(cat)}
                      className="p-1.5 transition-colors"
                      style={{ color: isActive ? "var(--bg)" : "var(--text-dim)" }}
                      title="이름 수정">
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => deleteTab(cat)}
                      className="p-1.5 transition-colors"
                      style={{ color: isActive ? "var(--bg)" : "var(--text-dim)" }}
                      title="직무 삭제">
                      <X size={11} />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {/* 편집 모드: 새 직무 추가 */}
          {tabEditMode && (showNewTab ? (
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
                onBlur={addTab}
                placeholder="직무명 입력"
                className="text-sm outline-none w-24 bg-transparent"
                style={{ color: "var(--text)" }}
              />
              <button onMouseDown={(e) => e.preventDefault()} onClick={addTab} style={{ color: "var(--accent)" }}>
                <CheckCircle2 size={15} />
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowNewTab(false); setNewTabName(""); }} style={{ color: "var(--text-dim)" }}>
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
          ))}

          <button
            onClick={() => {
              setTabEditMode((v) => !v);
              setShowNewTab(false);
              setNewTabName("");
              setEditingTab(null);
            }}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              border: `1px solid ${tabEditMode ? "var(--accent)" : "var(--border)"}`,
              color: tabEditMode ? "var(--accent)" : "var(--text-dim)",
              background: tabEditMode ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
            }}
          >
            {tabEditMode ? "완료" : "편집"}
          </button>
        </div>

        {/* ── 액션 바 ── */}
        {!showForm && (
          <div className="space-y-3">
            {/* 버튼 행 */}
            <div className="flex items-center justify-between gap-2">
              {selectionMode ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ border: "1px solid var(--border)", color: "var(--text-muted)", background: "var(--bg-card)" }}
                  >
                    {selectedIds.size === filteredItems.length
                      ? <CheckSquare size={15} style={{ color: "var(--accent)" }} />
                      : <Square size={15} />}
                    전체 선택
                  </button>
                  <button
                    onClick={deleteSelected}
                    disabled={selectedIds.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                    style={{ background: "var(--error)", color: "#fff" }}
                  >
                    <Trash2 size={15} />
                    {selectedIds.size > 0 ? `${selectedIds.size}개 삭제` : "삭제"}
                  </button>
                  <button
                    onClick={exitSelectionMode}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm transition-all"
                    style={{ color: "var(--text-dim)" }}
                  >
                    <X size={15} /> 취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={openForm}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                  style={{ background: "var(--accent)", color: "var(--bg)" }}
                >
                  <Plus size={15} /> 자소서 추가
                </button>
              )}

              {!selectionMode && items.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ border: "1px solid var(--border)", color: "var(--text-muted)", background: "var(--bg-card)" }}
                  >
                    <CheckSquare size={15} /> 선택 삭제
                  </button>
                  <button
                    onClick={deleteAll}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ border: "1px solid var(--error)", color: "var(--error)", background: "transparent" }}
                  >
                    <Trash2 size={15} /> 전체 삭제
                  </button>
                </div>
              )}
            </div>

            {/* 선택 모드 안내 배너 */}
            {selectionMode && (
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
                style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}
              >
                <CheckSquare size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <span style={{ color: "var(--accent)" }}>삭제할 항목을 선택하세요</span>
                {selectedIds.size > 0 && (
                  <span className="ml-auto font-medium" style={{ color: "var(--accent)" }}>
                    {selectedIds.size}개 선택됨
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 입력 폼 ── */}
        {showForm && (
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              {/* 입력 방식 탭 */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {(["pdf", "text"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setInputTab(t); setError(null); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors"
                    style={{
                      background: inputTab === t ? "var(--accent)" : "var(--bg-card)",
                      color: inputTab === t ? "var(--bg)" : "var(--text-muted)",
                    }}
                  >
                    {t === "pdf" ? <><Upload size={12} /> PDF 업로드</> : <><PenLine size={12} /> 직접 작성</>}
                  </button>
                ))}
              </div>
              {items.length > 0 && (
                <button onClick={() => setShowForm(false)} style={{ color: "var(--text-dim)" }}>
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 직무 카테고리 선택 */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>
                직무 분야
              </label>
              {activeTab !== "전체" ? (
                <div className="flex items-center gap-2">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: "var(--accent)", color: "var(--bg)" }}
                  >
                    {activeTab}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                    현재 탭에 자동 저장됩니다
                  </span>
                </div>
              ) : (
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
              )}
            </div>

            {/* 직접 작성 */}
            {inputTab === "text" && (
              <>
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
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "'Noto Serif KR', serif" }}
                  />
                </div>

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
              </>
            )}

            {/* PDF 업로드 */}
            {inputTab === "pdf" && (
              <>
                <div
                  {...getRootProps()}
                  className="rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200"
                  style={{
                    border: `1.5px dashed ${isDragActive || pdfFiles.length > 0 ? "var(--accent)" : "var(--border-light)"}`,
                    background: pdfFiles.length > 0 ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "var(--bg)",
                  }}
                >
                  <input {...getInputProps()} />
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                    <FileText size={20} />
                  </div>
                  {pdfFiles.length > 0 ? (
                    <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                      {pdfFiles.length}개 파일 선택됨 · 클릭하여 추가
                    </p>
                  ) : (
                    <>
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                        {isDragActive ? "여기에 놓으세요" : "PDF를 드래그하거나 클릭하여 업로드"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-dim)" }}>여러 파일 동시 선택 가능</p>
                    </>
                  )}
                </div>

                {/* 선택된 파일 목록 */}
                {pdfFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {pdfFiles.map((f, i) => (
                      <div key={f.name} className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ background: "var(--bg-hover)" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
                          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{f.name}</span>
                        </div>
                        <button onClick={() => setPdfFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-2 flex-shrink-0" style={{ color: "var(--text-dim)" }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {pdfFiles.length > 0 && (
                  <button
                    onClick={uploadPdf}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--bg)" }}
                  >
                    {uploading && uploadProgress
                      ? <><Loader2 size={15} className="animate-spin" /> {uploadProgress.done}/{uploadProgress.total} 업로드 중...</>
                      : <><Upload size={15} /> {pdfFiles.length}개 저장하기</>}
                  </button>
                )}
              </>
            )}

            {error && (
              <p className="text-xs" style={{ color: "var(--error)" }}>{error}</p>
            )}
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
            {filteredItems.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
              <div
                key={item.id}
                className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  boxShadow: isSelected ? "0 0 0 1px var(--accent)" : "none",
                }}
              >
                {/* 카드 헤더 */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer"
                  onClick={() => selectionMode ? toggleSelect(item.id) : setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {selectionMode && (
                      <div className="flex-shrink-0" style={{ color: isSelected ? "var(--accent)" : "var(--text-dim)" }}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                    )}
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
                        {/* 직무 분야 배지 — 클릭하여 이동 */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMovingItemId(movingItemId === item.id ? null : item.id);
                            }}
                            className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded transition-all"
                            style={{
                              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                              color: "var(--accent)",
                              border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                            }}
                            title="클릭하여 직무 변경"
                          >
                            {item.category ?? DEFAULT_CATEGORY}
                            <span style={{ fontSize: "9px", opacity: 0.7 }}>▾</span>
                          </button>
                          {movingItemId === item.id && (
                            <div
                              className="absolute top-full left-0 mt-1 z-50 rounded-xl p-1.5 flex flex-col gap-0.5"
                              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", minWidth: "110px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
                            >
                              {categories.map((cat) => (
                                <button
                                  key={cat}
                                  onClick={(e) => { e.stopPropagation(); moveItemCategory(item.id, cat); }}
                                  className="text-xs px-3 py-1.5 rounded-lg text-left transition-colors"
                                  style={{
                                    background: (item.category ?? DEFAULT_CATEGORY) === cat ? "var(--accent)" : "transparent",
                                    color: (item.category ?? DEFAULT_CATEGORY) === cat ? "var(--bg)" : "var(--text)",
                                  }}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
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
                    {!selectionMode && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                {/* 펼쳐진 내용 */}
                {!selectionMode && expandedId === item.id && (
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
            );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
