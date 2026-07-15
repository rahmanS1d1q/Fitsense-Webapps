import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitSense — Heart Rate Monitoring Platform",
  description: "Real-time heart rate monitoring for modern gyms",
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
