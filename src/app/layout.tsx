import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MainLayout from "@/components/layout/MainLayout";
import { ToastProvider } from "@/contexts/ToastContext";
import QueryProvider from "@/providers/QueryProvider";
import "./globals.css";
import "../styles/print.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "태창 ERP 시스템",
  description: "태창 자동차 부품 제조 ERP 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <ToastProvider>
            <MainLayout>{children}</MainLayout>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
