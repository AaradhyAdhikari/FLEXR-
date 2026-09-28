import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/Offline";

export const metadata: Metadata = {
  title: "Flexr",
  description: "Your daily fitness dashboard — macros, workouts and steps in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Flexr", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#111512" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Figtree:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
