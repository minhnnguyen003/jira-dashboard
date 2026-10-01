import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { LanguageProvider } from "@/lib/i18n";
import ProfileGate from "@/components/profile/ProfileGate";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { RuntimeConfigProvider } from "@/lib/runtimeConfig";
import { connection } from "next/server";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render per request so runtime env (docker --env-file) is picked up.
  await connection();
  const jiraBaseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');

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
        <RuntimeConfigProvider value={{ jiraBaseUrl }}>
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
        </RuntimeConfigProvider>
      </body>
    </html>
  );
}
