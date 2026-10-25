import type { Metadata } from "next";
import "./globals.css";
import "./presentation.css";
import "./scroll-motion.css";
import "./store-updates.css";
import "./customer-commerce.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "Aarini — Made for your moments",
  description: "Thoughtful Indian womenswear, a virtual fitting room, and your boutique studio.",
  icons: {
    icon: [
      {url:"/favicon.svg?v=aarini-1",type:"image/svg+xml",sizes:"any"},
      {url:"/favicon-32.png",type:"image/png",sizes:"32x32"},
    ],
    shortcut: "/favicon.svg?v=aarini-1",
    apple: "/apple-touch-icon.png",
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
