import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MainLayout from "@/components/layout/MainLayout";
import { ToastProvider } from "@/contexts/ToastContext";
import { FontSizeProvider } from "@/contexts/FontSizeContext";
import { UserProvider } from "@/contexts/UserContext";
import { FilterProvider } from "@/contexts/FilterContext";
import { ModalProvider } from "@/contexts/ModalContext";
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

// NOTE: force-dynamic removed - implement ISR/SSG on page level instead
// Only dashboard requires dynamic rendering for real-time data
export const runtime = 'nodejs';

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
          <UserProvider>
            <FilterProvider>
              <ModalProvider>
                <FontSizeProvider>
                  <ToastProvider>
                    <MainLayout>{children}</MainLayout>
                  </ToastProvider>
                </FontSizeProvider>
              </ModalProvider>
            </FilterProvider>
          </UserProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
