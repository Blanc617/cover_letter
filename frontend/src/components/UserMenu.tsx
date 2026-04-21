"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import Link from "next/link";

export default function UserMenu() {
  const [name, setName] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const fullName = data.user?.user_metadata?.full_name ?? data.user?.email ?? null;
      setName(fullName);
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (!name) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
        <span style={{ color: "var(--text)" }}>{name}</span>님
      </span>
      <Link
        href="/my"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:text-[var(--accent)] hover:border-[var(--accent)]"
        style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
      >
        <User size={13} />
        마이페이지
      </Link>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:text-[var(--error)] hover:border-[var(--error)]"
        style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
      >
        <LogOut size={13} />
        로그아웃
      </button>
    </div>
  );
}
