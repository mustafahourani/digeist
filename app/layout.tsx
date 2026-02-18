import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { Header } from "@/components/nav/header";
import "./globals.css";

const serif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Digeist",
  description: "Daily digest of what's happening in AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={serif.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var saved = null;
                try { saved = localStorage.getItem('theme'); } catch(e) {}
                if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <Header />
        <main className="max-w-[1400px] mx-auto px-6 pb-16">{children}</main>
      </body>
    </html>
  );
}
