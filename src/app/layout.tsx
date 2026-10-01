import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { LanguageProvider } from "@/lib/i18n";
import ProfileGate from "@/components/profile/ProfileGate";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jira Dashboard",
  description: "Jira JQL Dashboard with Charts and Tables",
  icons: {
    icon: "/atlassian_jira_logo_icon_170511.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex">
        <LanguageProvider>
          <ProfileGate>
            <Sidebar />
            <main
              className="main-content min-w-0 flex-1 flex flex-col h-screen overflow-y-auto transition-[margin] duration-200"
              id="main-content"
              style={{ marginLeft: 224 }}
            >
              {children}
            </main>
          </ProfileGate>
        </LanguageProvider>
      </body>
    </html>
  );
}
