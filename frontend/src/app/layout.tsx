import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { AppSettingsProvider } from "@/components/settings/app-settings-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "EPA Punjab - EnvironmentGPT | Environmental Knowledge Assistant",
  description: "AI-powered environmental knowledge assistant for Punjab, Pakistan. Get information on air quality, water resources, biodiversity, climate change, and environmental regulations.",
  keywords: ["EPA Punjab", "Environment", "Pakistan", "Air Quality", "Water", "Biodiversity", "Climate Change", "AI", "Chatbot"],
  authors: [{ name: "EPA Punjab - Environmental Protection Agency" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "EPA Punjab - EnvironmentGPT",
    description: "AI-powered environmental knowledge assistant for Punjab, Pakistan",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={
          {
            "--font-geist-sans": "system-ui, sans-serif",
            "--font-geist-mono": "Consolas, 'Courier New', monospace",
          } as CSSProperties
        }
        className="antialiased bg-background text-foreground"
      >
        <AppSettingsProvider />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
