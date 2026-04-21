import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coverly — AI 자기소개서 생성",
  description: "채용공고와 이력서를 업로드하면 AI가 맞춤형 자기소개서를 작성해드립니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
