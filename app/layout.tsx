import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Harada Method - 64 Cells to Achieve Your Goal",
  description: "Create your personalized 64-cell roadmap using the Harada Method, inspired by Shohei Ohtani",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-950" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
