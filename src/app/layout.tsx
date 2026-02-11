import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "INVAIZ UX Research",
  description: "Advanced UX Research and Analysis System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" as="style" crossOrigin="" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
