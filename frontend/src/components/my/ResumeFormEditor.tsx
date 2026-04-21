"use client";

import { useState } from "react";
import { Plus, Trash2, CheckCircle2, Loader2, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────
export interface ResumeFormData {
  title: string;
  // 기본정보
  name: string;
  birth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  // 학력
  education: {
    school: string; major: string; degree: string;
    start: string; end: string; gpa: string; status: string;
  }[];
  // 경력
  experience: {
    company: string; department: string; position: string;
    start: string; end: string; current: boolean; description: string;
  }[];
  // 자격증
  certifications: { name: string; issuer: string; date: string }[];
  // 어학
  languages: { language: string; test: string; score: string; date: string }[];
  // 스킬
  skills: string[];
  // 포트폴리오/링크
  links: { label: string; url: string }[];
  // 자기소개
  introduction: string;
}

const emptyForm = (): ResumeFormData => ({
  title: "",
  name: "", birth: "", gender: "", phone: "", email: "", address: "",
  education: [],
  experience: [],
  certifications: [],
  languages: [],
  skills: [],
  links: [],
  introduction: "",
});

export function resumeFormToText(d: ResumeFormData): string {
  const lines: string[] = [];
  lines.push(`[이력서] ${d.title}`);
  lines.push("\n■ 기본정보");
  if (d.name)    lines.push(`이름: ${d.name}`);
  if (d.birth)   lines.push(`생년월일: ${d.birth}`);
  if (d.gender)  lines.push(`성별: ${d.gender}`);
  if (d.phone)   lines.push(`연락처: ${d.phone}`);
  if (d.email)   lines.push(`이메일: ${d.email}`);
  if (d.address) lines.push(`주소: ${d.address}`);

  if (d.education.length) {
    lines.push("\n■ 학력");
    d.education.forEach((e) => {
      lines.push(`${e.school} ${e.major} ${e.degree} (${e.start} ~ ${e.status === "enrolled" ? "재학중" : e.end})${e.gpa ? ` 학점: ${e.gpa}` : ""}`);
    });
  }
  if (d.experience.length) {
    lines.push("\n■ 경력");
    d.experience.forEach((e) => {
      lines.push(`${e.company}${e.department ? ` / ${e.department}` : ""} | ${e.position} | ${e.start} ~ ${e.current ? "현재" : e.end}`);
      if (e.description) lines.push(`  담당업무: ${e.description}`);
    });
  }
  if (d.certifications.length) {
    lines.push("\n■ 자격증");
    d.certifications.forEach((c) => lines.push(`${c.name} | ${c.issuer} | ${c.date}`));
  }
  if (d.languages.length) {
    lines.push("\n■ 어학");
    d.languages.forEach((l) => lines.push(`${l.language} | ${l.test} | ${l.score} | ${l.date}`));
  }
  if (d.skills.length) {
    lines.push("\n■ 스킬");
    lines.push(d.skills.join(", "));
  }
  if (d.links.length) {
    lines.push("\n■ 포트폴리오/링크");
    d.links.forEach((l) => lines.push(`${l.label}: ${l.url}`));
  }
  if (d.introduction) {
    lines.push("\n■ 자기소개");
    lines.push(d.introduction);
  }
  return lines.join("\n");
}

// ── Sub-components ─────────────────────────────────────────
function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1.5px solid var(--accent)" }}>
      <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{title}</span>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors hover:opacity-80"
        style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
      >
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs" style={{ color: "var(--text-dim)" }}>
        {label}{required && <span style={{ color: "var(--error)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "px-3 py-2 rounded-lg text-sm outline-none w-full";
const inputStyle = { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" };

// ── Main Component ─────────────────────────────────────────
interface Props {
  onSave: (textContent: string, jsonContent: string, title: string) => Promise<void>;
  saving: boolean;
  onCancel: () => void;
}

export default function ResumeFormEditor({ onSave, saving, onCancel }: Props) {
  const [form, setForm] = useState<ResumeFormData>(emptyForm());
  const [skillInput, setSkillInput] = useState("");

  const set = (field: keyof ResumeFormData, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  // ── Education ─────────────────────────────────────────────
  const addEdu = () => set("education", [...form.education, { school: "", major: "", degree: "학사", start: "", end: "", gpa: "", status: "graduated" }]);
  const updateEdu = (i: number, k: string, v: string) =>
    set("education", form.education.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeEdu = (i: number) => set("education", form.education.filter((_, idx) => idx !== i));

  // ── Experience ────────────────────────────────────────────
  const addExp = () => set("experience", [...form.experience, { company: "", department: "", position: "", start: "", end: "", current: false, description: "" }]);
  const updateExp = (i: number, k: string, v: string | boolean) =>
    set("experience", form.experience.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeExp = (i: number) => set("experience", form.experience.filter((_, idx) => idx !== i));

  // ── Certification ─────────────────────────────────────────
  const addCert = () => set("certifications", [...form.certifications, { name: "", issuer: "", date: "" }]);
  const updateCert = (i: number, k: string, v: string) =>
    set("certifications", form.certifications.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeCert = (i: number) => set("certifications", form.certifications.filter((_, idx) => idx !== i));

  // ── Language ──────────────────────────────────────────────
  const addLang = () => set("languages", [...form.languages, { language: "", test: "", score: "", date: "" }]);
  const updateLang = (i: number, k: string, v: string) =>
    set("languages", form.languages.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeLang = (i: number) => set("languages", form.languages.filter((_, idx) => idx !== i));

  // ── Skills ────────────────────────────────────────────────
  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || form.skills.includes(s)) return;
    set("skills", [...form.skills, s]);
    setSkillInput("");
  };
  const removeSkill = (s: string) => set("skills", form.skills.filter((x) => x !== s));

  // ── Links ─────────────────────────────────────────────────
  const addLink = () => set("links", [...form.links, { label: "", url: "" }]);
  const updateLink = (i: number, k: string, v: string) =>
    set("links", form.links.map((e, idx) => idx === i ? { ...e, [k]: v } : e));
  const removeLink = (i: number) => set("links", form.links.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    const text = resumeFormToText(form);
    const json = JSON.stringify(form);
    await onSave(text, json, form.title || form.name || "이력서");
  };

  return (
    <div className="space-y-6">
      {/* 이력서 제목 */}
      <div className="flex items-center justify-between gap-3">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="이력서 제목 (예: 2025 상반기 이력서)"
          className={inputCls + " flex-1 font-medium"}
          style={inputStyle}
        />
        <button type="button" onClick={onCancel} style={{ color: "var(--text-dim)" }}>
          <X size={18} />
        </button>
      </div>

      {/* ① 기본정보 */}
      <section className="space-y-3">
        <div className="py-3" style={{ borderBottom: "1.5px solid var(--accent)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>기본정보</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="이름" required><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="홍길동" className={inputCls} style={inputStyle} /></Field>
          <Field label="생년월일"><input value={form.birth} onChange={(e) => set("birth", e.target.value)} placeholder="1999-01-01" className={inputCls} style={inputStyle} /></Field>
          <Field label="성별">
            <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls} style={inputStyle}>
              <option value="">선택</option>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="연락처"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" className={inputCls} style={inputStyle} /></Field>
          <Field label="이메일"><input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="example@email.com" className={inputCls} style={inputStyle} /></Field>
        </div>
        <Field label="주소"><input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="서울특별시 강남구" className={inputCls} style={inputStyle} /></Field>
      </section>

      {/* ② 학력 */}
      <section className="space-y-3">
        <SectionHeader title="학력" onAdd={addEdu} addLabel="학력 추가" />
        {form.education.map((e, i) => (
          <div key={i} className="p-4 rounded-xl space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="학교명"><input value={e.school} onChange={(ev) => updateEdu(i, "school", ev.target.value)} placeholder="홍익대학교" className={inputCls} style={inputStyle} /></Field>
              <Field label="전공"><input value={e.major} onChange={(ev) => updateEdu(i, "major", ev.target.value)} placeholder="컴퓨터공학과" className={inputCls} style={inputStyle} /></Field>
              <Field label="학위">
                <select value={e.degree} onChange={(ev) => updateEdu(i, "degree", ev.target.value)} className={inputCls} style={inputStyle}>
                  {["고등학교 졸업", "전문학사", "학사", "석사", "박사"].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-3 items-end">
              <Field label="입학년월"><input value={e.start} onChange={(ev) => updateEdu(i, "start", ev.target.value)} placeholder="2018-03" className={inputCls} style={inputStyle} /></Field>
              <Field label="졸업년월">
                <input value={e.end} onChange={(ev) => updateEdu(i, "end", ev.target.value)} placeholder="2022-02" disabled={e.status === "enrolled"} className={inputCls} style={{ ...inputStyle, opacity: e.status === "enrolled" ? 0.4 : 1 }} />
              </Field>
              <Field label="재학 상태">
                <select value={e.status} onChange={(ev) => updateEdu(i, "status", ev.target.value)} className={inputCls} style={inputStyle}>
                  <option value="graduated">졸업</option>
                  <option value="enrolled">재학중</option>
                  <option value="expected">졸업예정</option>
                  <option value="dropout">중퇴</option>
                </select>
              </Field>
              <Field label="학점 (선택)"><input value={e.gpa} onChange={(ev) => updateEdu(i, "gpa", ev.target.value)} placeholder="3.8 / 4.5" className={inputCls} style={inputStyle} /></Field>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => removeEdu(i)} className="flex items-center gap-1 text-xs transition-colors hover:text-[var(--error)]" style={{ color: "var(--text-dim)" }}>
                <Trash2 size={12} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* ③ 경력 */}
      <section className="space-y-3">
        <SectionHeader title="경력" onAdd={addExp} addLabel="경력 추가" />
        {form.experience.map((e, i) => (
          <div key={i} className="p-4 rounded-xl space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="회사명"><input value={e.company} onChange={(ev) => updateExp(i, "company", ev.target.value)} placeholder="(주)회사명" className={inputCls} style={inputStyle} /></Field>
              <Field label="부서 (선택)"><input value={e.department} onChange={(ev) => updateExp(i, "department", ev.target.value)} placeholder="개발팀" className={inputCls} style={inputStyle} /></Field>
              <Field label="직위/직책"><input value={e.position} onChange={(ev) => updateExp(i, "position", ev.target.value)} placeholder="백엔드 개발자" className={inputCls} style={inputStyle} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <Field label="입사년월"><input value={e.start} onChange={(ev) => updateExp(i, "start", ev.target.value)} placeholder="2022-03" className={inputCls} style={inputStyle} /></Field>
              <Field label="퇴사년월">
                <input value={e.end} onChange={(ev) => updateExp(i, "end", ev.target.value)} placeholder="2024-12" disabled={e.current} className={inputCls} style={{ ...inputStyle, opacity: e.current ? 0.4 : 1 }} />
              </Field>
              <Field label="재직여부">
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <input type="checkbox" checked={e.current} onChange={(ev) => updateExp(i, "current", ev.target.checked)} />
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>현재 재직중</span>
                </label>
              </Field>
            </div>
            <Field label="담당업무">
              <textarea value={e.description} onChange={(ev) => updateExp(i, "description", ev.target.value)} rows={3} placeholder="주요 담당 업무 및 성과를 입력하세요." className="px-3 py-2 rounded-lg text-sm outline-none w-full resize-none" style={inputStyle} />
            </Field>
            <div className="flex justify-end">
              <button type="button" onClick={() => removeExp(i)} className="flex items-center gap-1 text-xs transition-colors hover:text-[var(--error)]" style={{ color: "var(--text-dim)" }}>
                <Trash2 size={12} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* ④ 자격증 */}
      <section className="space-y-3">
        <SectionHeader title="자격증" onAdd={addCert} addLabel="자격증 추가" />
        {form.certifications.map((c, i) => (
          <div key={i} className="grid grid-cols-4 gap-3 items-end p-4 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <Field label="자격증명"><input value={c.name} onChange={(ev) => updateCert(i, "name", ev.target.value)} placeholder="정보처리기사" className={inputCls} style={inputStyle} /></Field>
            <Field label="발행기관"><input value={c.issuer} onChange={(ev) => updateCert(i, "issuer", ev.target.value)} placeholder="한국산업인력공단" className={inputCls} style={inputStyle} /></Field>
            <Field label="취득년월"><input value={c.date} onChange={(ev) => updateCert(i, "date", ev.target.value)} placeholder="2023-06" className={inputCls} style={inputStyle} /></Field>
            <button type="button" onClick={() => removeCert(i)} className="flex items-center gap-1 text-xs mb-0.5 transition-colors hover:text-[var(--error)]" style={{ color: "var(--text-dim)" }}>
              <Trash2 size={12} /> 삭제
            </button>
          </div>
        ))}
      </section>

      {/* ⑤ 어학 */}
      <section className="space-y-3">
        <SectionHeader title="어학" onAdd={addLang} addLabel="어학 추가" />
        {form.languages.map((l, i) => (
          <div key={i} className="grid grid-cols-5 gap-3 items-end p-4 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <Field label="언어"><input value={l.language} onChange={(ev) => updateLang(i, "language", ev.target.value)} placeholder="영어" className={inputCls} style={inputStyle} /></Field>
            <Field label="시험명"><input value={l.test} onChange={(ev) => updateLang(i, "test", ev.target.value)} placeholder="TOEIC" className={inputCls} style={inputStyle} /></Field>
            <Field label="점수/등급"><input value={l.score} onChange={(ev) => updateLang(i, "score", ev.target.value)} placeholder="900" className={inputCls} style={inputStyle} /></Field>
            <Field label="취득년월"><input value={l.date} onChange={(ev) => updateLang(i, "date", ev.target.value)} placeholder="2024-03" className={inputCls} style={inputStyle} /></Field>
            <button type="button" onClick={() => removeLang(i)} className="flex items-center gap-1 text-xs mb-0.5 transition-colors hover:text-[var(--error)]" style={{ color: "var(--text-dim)" }}>
              <Trash2 size={12} /> 삭제
            </button>
          </div>
        ))}
      </section>

      {/* ⑥ 스킬 */}
      <section className="space-y-3">
        <div className="py-3" style={{ borderBottom: "1.5px solid var(--accent)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>스킬</span>
        </div>
        <div className="flex gap-2">
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
            placeholder="스킬 입력 후 Enter (예: React, Python)"
            className={inputCls + " flex-1"}
            style={inputStyle}
          />
          <button type="button" onClick={addSkill} className="px-4 py-2 rounded-lg text-sm transition-colors hover:opacity-80" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
            추가
          </button>
        </div>
        {form.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.skills.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" }}>
                {s}
                <button type="button" onClick={() => removeSkill(s)}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ⑦ 포트폴리오/링크 */}
      <section className="space-y-3">
        <SectionHeader title="포트폴리오 / 링크" onAdd={addLink} addLabel="링크 추가" />
        {form.links.map((l, i) => (
          <div key={i} className="grid grid-cols-5 gap-3 items-end p-4 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <Field label="이름 (선택)"><input value={l.label} onChange={(ev) => updateLink(i, "label", ev.target.value)} placeholder="GitHub" className={inputCls} style={inputStyle} /></Field>
            <div className="col-span-3">
              <Field label="URL"><input value={l.url} onChange={(ev) => updateLink(i, "url", ev.target.value)} placeholder="https://github.com/username" className={inputCls} style={inputStyle} /></Field>
            </div>
            <button type="button" onClick={() => removeLink(i)} className="flex items-center gap-1 text-xs mb-0.5 transition-colors hover:text-[var(--error)]" style={{ color: "var(--text-dim)" }}>
              <Trash2 size={12} /> 삭제
            </button>
          </div>
        ))}
      </section>

      {/* ⑧ 자기소개 */}
      <section className="space-y-3">
        <div className="py-3" style={{ borderBottom: "1.5px solid var(--accent)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>자기소개 (선택)</span>
        </div>
        <textarea
          value={form.introduction}
          onChange={(e) => set("introduction", e.target.value)}
          rows={5}
          placeholder="간략한 자기소개를 입력하세요."
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={{ ...inputStyle, fontFamily: "'Noto Serif KR', serif", lineHeight: "1.8" }}
        />
      </section>

      {/* 저장 */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !form.name.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--bg)" }}
      >
        {saving
          ? <><Loader2 size={15} className="animate-spin" /> 저장 중...</>
          : <><CheckCircle2 size={15} /> 이력서 저장하기</>}
      </button>
    </div>
  );
}
