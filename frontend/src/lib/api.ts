import { createClient } from "@/lib/supabase/client";

const BASE = "http://localhost:8000";

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export async function saveCoverLetter(payload: {
  job_posting: object;
  content_json: { question: string; answer: string }[];
  resume_id?: number;
}) {
  const token = await getToken();
  if (!token) return null;

  const res = await fetch(`${BASE}/api/history/cover-letter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) return null;
  return res.json();
}

export async function getHistory() {
  const token = await getToken();
  if (!token) return { items: [] };

  const res = await fetch(`${BASE}/api/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { items: [] };
  return res.json();
}

export async function getCoverLetter(id: number) {
  const token = await getToken();
  if (!token) return null;

  const res = await fetch(`${BASE}/api/history/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return res.json();
}
