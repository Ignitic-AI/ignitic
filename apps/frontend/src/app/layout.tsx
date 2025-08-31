// app/layout.tsx
import "./globals.css"

export const metadata = {
  title: "Ignitic AI",
  description: "Ignitic AI - Your AI-Powered Assistant",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-bg">
        {children}
      </body>
    </html>
  )
}
