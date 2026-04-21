"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import UserMenu from "@/components/UserMenu";

const NAV_LINKS = [
  { href: "/my/resumes",       label: "이력서 관리" },
  { href: "/my/portfolios",    label: "포트폴리오 관리" },
  { href: "/my/cover-letters", label: "자소서 관리" },
];

interface Props {
  backHref?: string;
  backLabel?: string;
  pageTitle?: string;
}

export default function PageHeader({ backHref = "/", backLabel = "홈", pageTitle }: Props) {
  const pathname = usePathname();

  return (
    <header style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      {/* 로고 행 */}
      <div className="relative flex items-center justify-center px-8 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="Coverly" width={32} height={32} priority />
          <span className="font-display text-lg tracking-tight" style={{ color: "var(--text)" }}>
            Cover<span style={{ color: "var(--accent)" }}>ly</span>
          </span>
        </Link>
        <div className="absolute right-8">
          <UserMenu />
        </div>
      </div>

      {/* 네비게이션 바 */}
      <nav className="py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="grid grid-cols-3 items-center max-w-5xl mx-auto px-8">
        {/* 왼쪽: 브레드크럼 */}
        <div className="flex items-center gap-2 pl-8">
          {pageTitle && (
            <>
              <Link
                href={backHref}
                className="flex items-center gap-1 text-xs transition-colors hover:text-[var(--accent)]"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronLeft size={13} />
                {backLabel}
              </Link>
              <span className="text-xs" style={{ color: "var(--border)" }}>/</span>
              <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
                {pageTitle}
              </span>
            </>
          )}
        </div>

        {/* 중앙: 네비 링크 */}
        <div className="flex items-center justify-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="px-4 py-1.5 rounded-lg text-sm transition-colors duration-200 whitespace-nowrap"
                style={{
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* 오른쪽: AI 자소서 생성 버튼 */}
        <div className="flex justify-end">
          <Link
            href="/generate"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90 whitespace-nowrap"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            <Sparkles size={13} />
            AI 자소서 생성
          </Link>
        </div>
      </div>
      </nav>
    </header>
  );
}
