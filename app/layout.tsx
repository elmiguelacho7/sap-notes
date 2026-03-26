// app/layout.tsx
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "ribbit",
  description: "Internal workspace for SAP project management",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // i18n: flat App Router (no app/[locale]/ segment). Locale comes from the request
  // pipeline (NEXT_LOCALE cookie → i18n/request.ts). Do not expect URL prefixes.
  // Details: docs/i18n.md
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-[rgb(var(--rb-shell-bg))] text-[rgb(var(--rb-text-primary))]">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
