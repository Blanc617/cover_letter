"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  FileText, Loader2, Trash2,
  PenLine, Upload, CheckCircle2, Plus, X,
  ChevronDown, ChevronUp, Download, FolderPlus, Pencil,
  CheckSquare, Square,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { extractTextFromPdf } from "@/lib/pdfExtract";
import ResumeFormEditor, { type ResumeFormData, resumeFormToText } from "@/components/my/ResumeFormEditor";
import PageHeader from "@/components/PageHeader";

function PdfViewerFrame({ fileData }: { fileData: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const base64 = fileData.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [fileData]);

  if (!blobUrl) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 rounded-full animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
    </div>
  );

  return (
    <iframe src={blobUrl} className="w-full" style={{ height: "75vh", border: "none" }} />
  );
}

type DocItem = {
  id: number;
  title: string;
  file_name: string | null;
  file_data: string | null;
  text_content: string | null;
  category: string | null;
  created_at: string;
};

type Table = "user_resumes" | "user_portfolios";
type InputTab = "pdf" | "text";

const DEFAULT_CATEGORY = "일반";

interface Props {
  pageTitle: string;
  table: Table;
  useResumeForm?: boolean;
}

export default function DocumentManagePage({ pageTitle, table, useResumeForm = false }: Props) {
  const supabase = createClient();

  const [items, setItems] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputTab, setInputTab] = useState<InputTab>("pdf");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 선택 삭제
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 카테고리 탭
  const [activeCategory, setActiveCategory] = useState<string>("전체");
  const STORAGE_KEY = `doc_extra_tabs_${table}`;
  const [extraTabs, setExtraTabs] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setExtraTabs(JSON.parse(stored));
    } catch {}
  }, [STORAGE_KEY]);
  const [tabEditMode, setTabEditMode] = useState(false);
  const [showNewTab, setShowNewTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const newTabRef = useRef<HTMLInputElement>(null);
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const editingTabRef = useRef<string | null>(null); // stale closure 방지용 ref
  const [editingName, setEditingName] = useState("");
  const editingNameRef = useRef<string>("");          // stale closure 방지용 ref
  const editingInputRef = useRef<HTMLInputElement>(null);

  // 폼 - 카테고리
  const [formCategory, setFormCategory] = useState(DEFAULT_CATEGORY);

  // PDF upload state
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  // Text entry state
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [savingText, setSavingText] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // 카테고리 목록
  const categories = Array.from(
    new Set([
      DEFAULT_CATEGORY,
      ...extraTabs,
      ...items.map((i) => i.category ?? DEFAULT_CATEGORY),
    ])
  );

  const filteredItems =
    activeCategory === "전체"
      ? items
      : items.filter((i) => (i.category ?? DEFAULT_CATEGORY) === activeCategory);

  // ── Load ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from(table)
      .select("id, title, file_name, file_data, text_content, category, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const fetched = (data as DocItem[]) ?? [];
    setItems(fetched);
    if (fetched.length === 0) setShowForm(true);
    setLoading(false);
  }, [supabase, table]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showNewTab) newTabRef.current?.focus();
  }, [showNewTab]);

  useEffect(() => {
    if (editingTab) editingInputRef.current?.focus();
  }, [editingTab]);

  const startEditTab = (cat: string) => {
    editingTabRef.current = cat;
    editingNameRef.current = cat;
    setEditingTab(cat);
    setEditingName(cat);
  };

  const confirmEditTab = async () => {
    const oldName = editingTabRef.current;
    if (!oldName) return;
    const newName = editingNameRef.current.trim();
    // 먼저 편집 상태 해제 (이중 호출 방지)
    editingTabRef.current = null;
    setEditingTab(null);
    if (!newName || newName === oldName) return;
    if (categories.includes(newName)) return;

    setExtraTabs((prev) => {
      const next = prev.map((t) => t === oldName ? newName : t);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from(table).update({ category: newName })
        .eq("user_id", user.id).eq("category", oldName);
    }
    if (activeCategory === oldName) setActiveCategory(newName);
    load();
  };

  const deleteTab = async (cat: string) => {
    if (!confirm(`"${cat}" 직무를 삭제하시겠습니까?\n해당 직무의 문서는 "일반"으로 이동됩니다.`)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from(table).update({ category: "일반" })
        .eq("user_id", user.id).eq("category", cat);
    }
    setExtraTabs((prev) => {
      const next = prev.filter((t) => t !== cat);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    if (activeCategory === cat) setActiveCategory("전체");
    load();
  };

  // ── 탭 추가 ───────────────────────────────────────────────
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
    setActiveCategory(name);
    setShowNewTab(false);
    setNewTabName("");
  };

  // ── PDF dropzone ─────────────────────────────────────────
  const onDrop = useCallback((files: File[]) => {
    if (!files.length) return;
    setPdfFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newFiles = files.filter((f) => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [] },
    multiple: true,
  });

  // ── Upload PDF ────────────────────────────────────────────
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
        const [text, fileData] = await Promise.all([
          extractTextFromPdf(file),
          file.arrayBuffer().then((buf) => {
            const bytes = new Uint8Array(buf);
            let binary = "";
            bytes.forEach((b) => (binary += String.fromCharCode(b)));
            return `data:application/pdf;base64,${btoa(binary)}`;
          }),
        ]);

        const { error: dbErr } = await supabase.from(table).insert({
          user_id: user.id,
          title: file.name.replace(/\.pdf$/i, ""),
          file_name: file.name,
          file_data: fileData,
          text_content: text || "(텍스트 추출 불가)",
          category: (activeCategory !== "전체" ? activeCategory : formCategory) || DEFAULT_CATEGORY,
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

  // ── Save text ─────────────────────────────────────────────
  const saveText = async () => {
    if (!textTitle.trim() || !textContent.trim()) return;
    setSavingText(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다.");

      const { error: dbErr } = await supabase.from(table).insert({
        user_id: user.id,
        title: textTitle.trim(),
        text_content: textContent.trim(),
        category: (activeCategory !== "전체" ? activeCategory : formCategory) || DEFAULT_CATEGORY,
      });
      if (dbErr) throw dbErr;

      setTextTitle("");
      setTextContent("");
      setShowForm(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSavingText(false);
    }
  };

  // ── Download ──────────────────────────────────────────────
  const downloadItem = (item: DocItem) => {
    if (item.file_data) {
      const base64 = item.file_data.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.file_name ?? `${item.title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      let content = item.text_content ?? "";
      try {
        const parsed = JSON.parse(content) as ResumeFormData;
        if (parsed.name !== undefined) content = resumeFormToText(parsed);
      } catch { /* plain text */ }
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.title}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const deleteItem = async (item: DocItem) => {
    if (!confirm(`"${item.title}"을(를) 삭제하시겠습니까?`)) return;
    await supabase.from(table).delete().eq("id", item.id);
    load();
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개를 삭제하시겠습니까?`)) return;
    await supabase.from(table).delete().in("id", Array.from(selectedIds));
    setSelectedIds(new Set());
    setSelectionMode(false);
    load();
  };

  const deleteAll = async () => {
    if (!confirm(`${filteredItems.length}개를 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    await supabase.from(table).delete().in("id", filteredItems.map((i) => i.id));
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
    setPdfFiles([]);
    setTextTitle(""); setTextContent("");
    setFormCategory(activeCategory !== "전체" ? activeCategory : DEFAULT_CATEGORY);
    setError(null);
    setShowForm(true);
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <PageHeader pageTitle={pageTitle} />

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* ── 직무 탭 바 ── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory("전체")}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
            style={{
              background: activeCategory === "전체" ? "var(--accent)" : "var(--bg-card)",
              color: activeCategory === "전체" ? "var(--bg)" : "var(--text-muted)",
              border: `1px solid ${activeCategory === "전체" ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            전체
            <span className="ml-1.5 text-xs" style={{ opacity: 0.7 }}>{items.length}</span>
          </button>

          {categories.filter((c) => c !== DEFAULT_CATEGORY).map((cat) => {
            const count = items.filter((i) => (i.category ?? DEFAULT_CATEGORY) === cat).length;
            const isActive = activeCategory === cat;
            const isCustom = cat !== DEFAULT_CATEGORY;

            if (editingTab === cat) {
              return (
                <div key={cat} className="flex items-center gap-1 px-2 py-1 rounded-full"
                  style={{ border: "1px solid var(--accent)", background: "var(--bg-card)" }}>
                  <input
                    ref={editingInputRef}
                    value={editingName}
                    onChange={(e) => {
                      editingNameRef.current = e.target.value;
                      setEditingName(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEditTab();
                      if (e.key === "Escape") { editingTabRef.current = null; setEditingTab(null); }
                    }}
                    onBlur={confirmEditTab}
                    className="text-sm outline-none w-20 bg-transparent"
                    style={{ color: "var(--text)" }}
                  />
                  <button onMouseDown={(e) => e.preventDefault()} onClick={confirmEditTab} style={{ color: "var(--accent)" }}>
                    <CheckCircle2 size={14} />
                  </button>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editingTabRef.current = null; setEditingTab(null); }} style={{ color: "var(--text-dim)" }}>
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
                }}
              >
                <button
                  onClick={() => setActiveCategory(cat)}
                  className="px-4 py-1.5 text-sm font-medium transition-all duration-150"
                  style={{ color: isActive ? "var(--bg)" : "var(--text-muted)" }}
                >
                  {cat}
                  <span className="ml-1.5 text-xs" style={{ opacity: 0.7 }}>{count}</span>
                </button>
                {tabEditMode && isCustom && (
                  <>
                    <button
                      onClick={() => startEditTab(cat)}
                      className="px-1.5 py-1.5 transition-colors"
                      style={{ color: isActive ? "rgba(255,255,255,0.6)" : "var(--text-dim)" }}
                      title="이름 수정">
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => deleteTab(cat)}
                      className="px-1.5 py-1.5 transition-colors"
                      style={{ color: isActive ? "rgba(255,255,255,0.6)" : "var(--text-dim)" }}
                      title="직무 삭제">
                      <X size={11} />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {tabEditMode && (showNewTab ? (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ border: "1px solid var(--accent)", background: "var(--bg-card)" }}
            >
              <input
                ref={newTabRef}
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
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowNewTab(false); setNewTabName(""); }}
                style={{ color: "var(--text-dim)" }}>
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
        {!showForm && items.length > 0 && (
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
                  <Plus size={15} /> 추가하기
                </button>
              )}

              {!selectionMode && (
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
                <span style={{ color: "var(--accent)" }}>
                  삭제할 항목을 선택하세요
                </span>
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
            className="rounded-2xl p-6 space-y-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* 폼 헤더 */}
            <div className="flex items-center justify-between">
              <div
                className="flex rounded-lg overflow-hidden"
                style={{ border: "1px solid var(--border)" }}
              >
                {(["pdf", "text"] as InputTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setInputTab(t)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors"
                    style={{
                      background: inputTab === t ? "var(--accent)" : "var(--bg-card)",
                      color: inputTab === t ? "var(--bg)" : "var(--text-muted)",
                    }}
                  >
                    {t === "pdf"
                      ? <><Upload size={12} /> PDF 업로드</>
                      : <><PenLine size={12} /> 직접 작성</>}
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
              <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>직무 분야</label>
              <div className="flex items-center gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormCategory(cat)}
                    className="px-3 py-1 rounded-full text-xs transition-all"
                    style={{
                      background: formCategory === cat ? "var(--accent)" : "color-mix(in srgb, var(--accent) 8%, transparent)",
                      color: formCategory === cat ? "var(--bg)" : "var(--accent)",
                      border: `1px solid ${formCategory === cat ? "var(--accent)" : "color-mix(in srgb, var(--accent) 25%, transparent)"}`,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* PDF 업로드 */}
            {inputTab === "pdf" && (
              <div className="space-y-4">
                <div
                  {...getRootProps()}
                  className="rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200"
                  style={{
                    border: `1.5px dashed ${isDragActive || pdfFiles.length > 0 ? "var(--accent)" : "var(--border-light)"}`,
                    background: pdfFiles.length > 0 ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "var(--bg)",
                  }}
                >
                  <input {...getInputProps()} />
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                  >
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
              </div>
            )}

            {/* 직접 작성 */}
            {inputTab === "text" && (
              useResumeForm ? (
                <ResumeFormEditor
                  saving={savingText}
                  onCancel={() => items.length > 0 ? setShowForm(false) : null}
                  onSave={async (textContent, jsonContent, title) => {
                    setSavingText(true);
                    setError(null);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error("로그인이 필요합니다.");
                      const { error: dbErr } = await supabase.from(table).insert({
                        user_id: user.id,
                        title,
                        text_content: jsonContent,
                        category: formCategory,
                      });
                      if (dbErr) throw dbErr;
                      setShowForm(false);
                      load();
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
                    } finally {
                      setSavingText(false);
                    }
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>제목</label>
                    <input
                      value={textTitle}
                      onChange={(e) => setTextTitle(e.target.value)}
                      placeholder="예: 2025 상반기 포트폴리오"
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>내용</label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      rows={12}
                      placeholder="내용을 직접 입력하세요..."
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y leading-relaxed"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "'Noto Serif KR', serif" }}
                    />
                  </div>
                  <button
                    onClick={saveText}
                    disabled={savingText || !textTitle.trim() || !textContent.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--bg)" }}
                  >
                    {savingText
                      ? <><Loader2 size={15} className="animate-spin" /> 저장 중...</>
                      : <><CheckCircle2 size={15} /> 저장하기</>}
                  </button>
                </div>
              )
            )}

            {error && (
              <p className="text-xs text-center" style={{ color: "var(--error)" }}>{error}</p>
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
              {activeCategory === "전체"
                ? "아직 저장된 문서가 없습니다."
                : `"${activeCategory}" 직무의 문서가 없습니다.`}
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
                      style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                    >
                      {item.file_name ? <FileText size={16} /> : <PenLine size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: "var(--bg-hover)", color: "var(--text-dim)" }}
                        >
                          {item.file_name ? "PDF" : "텍스트"}
                        </span>
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

                {!selectionMode && expandedId === item.id && (
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    {item.file_data ? (
                      <PdfViewerFrame fileData={item.file_data} />
                    ) : (() => {
                      try {
                        const parsed = JSON.parse(item.text_content ?? "");
                        if (parsed.name !== undefined) return <ResumeFormView data={parsed} />;
                      } catch { /* plain text */ }
                      return (
                        <p className="text-sm leading-7 whitespace-pre-wrap px-5 py-5"
                          style={{ color: "var(--text)", fontFamily: "'Noto Serif KR', serif" }}>
                          {item.text_content}
                        </p>
                      );
                    })()}
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

function ResumeFormView({ data: d }: { data: ResumeFormData }) {
  const Row = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div className="flex gap-3">
        <span className="text-xs w-20 flex-shrink-0 pt-0.5" style={{ color: "var(--text-dim)" }}>{label}</span>
        <span className="text-sm" style={{ color: "var(--text)" }}>{value}</span>
      </div>
    ) : null;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold pb-1"
        style={{ color: "var(--accent)", borderBottom: "1px solid var(--border)" }}>{title}</p>
      {children}
    </div>
  );

  return (
    <div className="px-6 py-5 space-y-5">
      <Section title="기본정보">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
          <Row label="이름" value={d.name} />
          <Row label="생년월일" value={d.birth} />
          <Row label="성별" value={d.gender} />
          <Row label="연락처" value={d.phone} />
          <Row label="이메일" value={d.email} />
          <Row label="주소" value={d.address} />
        </div>
      </Section>

      {d.education.length > 0 && (
        <Section title="학력">
          {d.education.map((e, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xs w-20 flex-shrink-0 pt-0.5" style={{ color: "var(--text-dim)" }}>
                {e.start} ~{e.status === "enrolled" ? " 재학중" : ` ${e.end}`}
              </span>
              <span style={{ color: "var(--text)" }}>{e.school} {e.major} {e.degree}{e.gpa ? ` (${e.gpa})` : ""}</span>
            </div>
          ))}
        </Section>
      )}

      {d.experience.length > 0 && (
        <Section title="경력">
          {d.experience.map((e, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex gap-3">
                <span className="text-xs w-20 flex-shrink-0 pt-0.5" style={{ color: "var(--text-dim)" }}>
                  {e.start} ~ {e.current ? "현재" : e.end}
                </span>
                <span className="font-medium" style={{ color: "var(--text)" }}>
                  {e.company}{e.department ? ` / ${e.department}` : ""} — {e.position}
                </span>
              </div>
              {e.description && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)", marginLeft: "92px" }}>
                  {e.description}
                </p>
              )}
            </div>
          ))}
        </Section>
      )}

      {d.certifications.length > 0 && (
        <Section title="자격증">
          {d.certifications.map((c, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xs w-20 flex-shrink-0 pt-0.5" style={{ color: "var(--text-dim)" }}>{c.date}</span>
              <span style={{ color: "var(--text)" }}>{c.name} ({c.issuer})</span>
            </div>
          ))}
        </Section>
      )}

      {d.languages.length > 0 && (
        <Section title="어학">
          {d.languages.map((l, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xs w-20 flex-shrink-0 pt-0.5" style={{ color: "var(--text-dim)" }}>{l.date}</span>
              <span style={{ color: "var(--text)" }}>{l.language} {l.test} {l.score}</span>
            </div>
          ))}
        </Section>
      )}

      {d.skills.length > 0 && (
        <Section title="스킬">
          <div className="flex flex-wrap gap-1.5">
            {d.skills.map((s) => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {d.links.length > 0 && (
        <Section title="링크">
          {d.links.map((l, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xs w-20 flex-shrink-0 pt-0.5" style={{ color: "var(--text-dim)" }}>{l.label || "링크"}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer"
                className="text-sm hover:underline" style={{ color: "var(--accent)" }}>{l.url}</a>
            </div>
          ))}
        </Section>
      )}

      {d.introduction && (
        <Section title="자기소개">
          <p className="text-sm leading-7 whitespace-pre-wrap"
            style={{ color: "var(--text)", fontFamily: "'Noto Serif KR', serif" }}>
            {d.introduction}
          </p>
        </Section>
      )}
    </div>
  );
}
