import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harada Method — AI-Powered 64-Cell Goal Planner",
  description: "Transform any goal into a structured 64-cell action plan using the proven Harada Method.",
  openGraph: {
    title: "Harada Method — AI-Powered 64-Cell Goal Planner",
    description: "Transform any goal into a structured 64-cell action plan using the proven Harada Method.",
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'Harada Method 64-Cell Goal Planning System',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Harada Method — AI-Powered 64-Cell Goal Planner",
    description: "Transform any goal into a structured 64-cell action plan using the proven Harada Method.",
    images: ['/api/og'],
  },
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
