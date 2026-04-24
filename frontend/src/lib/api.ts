import { createClient } from "@/lib/supabase/client";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");
  return token;
}

export async function saveCoverLetter(payload: {
  job_posting: object;
  content_json: { question: string; answer: string }[];
  resume_id?: number;
}) {
  const token = await getToken();

  const res = await fetch(`${API_BASE}/api/history/cover-letter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`저장 실패 (${res.status})`);
  return res.json();
}

export async function getHistory() {
  const token = await getToken();

  const res = await fetch(`${API_BASE}/api/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { items: [] };
  return res.json();
}

export async function getCoverLetter(id: number) {
  const token = await getToken();

  const res = await fetch(`${API_BASE}/api/history/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}
