import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "ResumeTailor",
  description: "원문을 검토하고 회사별 맞춤 이력서를 만드는 로컬 앱",
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
