import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "RE AI Researcher",
  description: "Casino and offer research dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen p-4 md:p-6">{children}</main>
      </body>
    </html>
  );
}
