import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitSense Dashboard",
  description: "Real-time HR monitoring platform for gyms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
