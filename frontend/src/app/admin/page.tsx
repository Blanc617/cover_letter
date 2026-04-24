"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Pencil, X, Check, Loader2, Database } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/admin/rag`;

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

interface RagDoc {
  id: number;
  company: string;
  position: string;
  question: string;
  answer: string;
  created_at: string;
}

interface FormState {
  company: string;
  position: string;
  question: string;
  answer: string;
}

const empty: FormState = { company: "", position: "", question: "", answer: "" };

export default function AdminPage() {
  const [docs, setDocs] = useState<RagDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 등록 폼
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  // 수정
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(empty);

  // 검색
  const [filterCompany, setFilterCompany] = useState("");
  const [filterPosition, setFilterPosition] = useState("");

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCompany) params.set("company", filterCompany);
      if (filterPosition) params.set("position", filterPosition);
      const res = await fetch(`${API}?${params}`);
      const data = await res.json();
      setDocs(data.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [filterCompany, filterPosition]);

  const handleCreate = async () => {
    if (!form.company || !form.position || !form.question || !form.answer) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      setForm(empty);
      setShowForm(false);
      fetchDocs();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: number) => {
    setSubmitting(true);
    try {
      const token = await getToken();
      await fetch(`${API}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      setEditId(null);
      fetchDocs();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const token = await getToken();
    await fetch(`${API}/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetchDocs();
  };

  const startEdit = (doc: RagDoc) => {
    setEditId(doc.id);
    setEditForm({ company: doc.company, position: doc.position, question: doc.question, answer: doc.answer });
    setShowForm(false);
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--bg)" }}>
      <PageHeader pageTitle="합격 자소서 관리 (어드민)" />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2" style={{ color: "var(--accent)" }}>
            <Database size={15} />
            <span className="text-sm font-medium">RAG 데이터베이스</span>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            <Plus size={15} /> 새 자소서 등록
          </button>
        </div>

        {/* 검색 필터 */}
        <div className="flex gap-3">
          <input
            placeholder="회사명 검색"
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
          <input
            placeholder="직군 검색"
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        {/* 등록 폼 */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-2xl p-6 space-y-4"
              style={{ background: "var(--bg-card)", border: "1px solid var(--accent)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                  합격 자소서 등록
                </h3>
                <button onClick={() => setShowForm(false)}>
                  <X size={16} style={{ color: "var(--text-dim)" }} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="회사명" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
                <FormInput label="직군" value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
              </div>
              <FormInput label="자소서 문항" value={form.question} onChange={(v) => setForm({ ...form, question: v })} />
              <FormTextarea label="합격 답변" value={form.answer} onChange={(v) => setForm({ ...form, answer: v })} />
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {submitting ? "저장 중..." : "등록하기"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 목록 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              등록된 합격 자소서가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${editId === doc.id ? "var(--accent)" : "var(--border)"}` }}
              >
                {editId === doc.id ? (
                  <div className="p-5 space-y-3" style={{ background: "var(--bg-card)" }}>
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="회사명" value={editForm.company} onChange={(v) => setEditForm({ ...editForm, company: v })} />
                      <FormInput label="직군" value={editForm.position} onChange={(v) => setEditForm({ ...editForm, position: v })} />
                    </div>
                    <FormInput label="문항" value={editForm.question} onChange={(v) => setEditForm({ ...editForm, question: v })} />
                    <FormTextarea label="답변" value={editForm.answer} onChange={(v) => setEditForm({ ...editForm, answer: v })} />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setEditId(null)}
                        className="px-4 py-2 rounded-xl text-sm"
                        style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleUpdate(doc.id)}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                        style={{ background: "var(--accent)", color: "var(--bg)" }}
                      >
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5" style={{ background: "var(--bg-card)" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
                          >
                            {doc.company}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                            {doc.position}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-2 truncate" style={{ color: "var(--text)" }}>
                          {doc.question}
                        </p>
                        <p
                          className="text-xs leading-relaxed line-clamp-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {doc.answer}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(doc)}
                          className="p-2 rounded-lg transition-colors hover:text-[var(--accent)]"
                          style={{ color: "var(--text-dim)" }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 rounded-lg transition-colors hover:text-[var(--error)]"
                          style={{ color: "var(--text-dim)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FormInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>{label}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          background: "var(--bg-hover)",
          border: "1px solid var(--border)",
          color: "var(--text)",
        }}
      />
    </div>
  );
}

function FormTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>{label}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
        style={{
          background: "var(--bg-hover)",
          border: "1px solid var(--border)",
          color: "var(--text)",
        }}
      />
    </div>
  );
}
