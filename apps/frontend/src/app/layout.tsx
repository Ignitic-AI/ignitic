import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ignitic AI",
  description: "Ignitic AI - Your AI-Powered Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-bg-dark"
      >
        {children}
      </body>
    </html>
  );
}
