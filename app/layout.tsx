import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "K Fonts Creator",
  description: "A local, browser-based font editor with Khmer Unicode support.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('kfonts_theme');
                if (t === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
                var l = localStorage.getItem('kfonts_lang');
                if (l) document.documentElement.lang = l;
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
