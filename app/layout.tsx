import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aarini — Made for your moments",
  description: "Thoughtful Indian womenswear, a virtual fitting room, and your boutique studio.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
