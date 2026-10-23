import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Grupo G2H — Admin", template: "%s · Grupo G2H Admin" },
  description: "Grupo G2H · Servicios Integrales — construction document and compliance management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
          {/* Success feedback only. Failures stay inline in FormDialog / ConfirmDialog,
              where the message sits next to the field or action that caused it. */}
          <Toaster position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
