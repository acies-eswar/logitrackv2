import type { Metadata } from "next";
import { Shell } from "@/components/layout/shell";
import { ThemeProvider } from "@/contexts/theme-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogiTrack: Finance-Native Logistics Intelligence",
  description: "Global supply chain logistics intelligence: network visibility, transportation performance, cost & sustainability, scenario planning, and transition economics.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Shell>{children}</Shell>
        </ThemeProvider>
      </body>
    </html>
  );
}
