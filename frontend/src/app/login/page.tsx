"use client";

import { Suspense } from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import Link from "next/link";

function LoginPageContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const handleGoogleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* 로고 */}
        <div className="text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-0 group">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 transition-opacity group-hover:opacity-80"
              style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
            >
              <Sparkles size={22} />
            </div>
            <h1 className="font-display text-3xl mb-2" style={{ color: "var(--text)" }}>
              Cover<span style={{ color: "var(--accent)" }}>ly</span>
            </h1>
          </Link>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            AI 맞춤형 자기소개서 생성 서비스
          </p>
        </div>

        {/* 로그인 카드 */}
        <div
          className="rounded-2xl p-8 space-y-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm text-center mb-6" style={{ color: "var(--text-muted)" }}>
            소셜 계정으로 간편하게 시작하세요
          </p>

          {error && (
            <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ background: "rgba(224,92,92,0.1)", color: "var(--error)" }}>
              로그인에 실패했습니다. 다시 시도해주세요.
            </p>
          )}

          {/* Google 로그인 */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--bg-hover)", border: "1px solid var(--border-light)", color: "var(--text)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "로그인 중..." : "Google로 계속하기"}
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
          로그인 시 서비스 이용약관에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
