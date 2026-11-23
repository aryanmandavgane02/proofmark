import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Backdrop } from "@/components/Backdrop";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Plus_Jakarta_Sans({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });

const DESCRIPTION =
  "Check every draft against approved brand rules, facts and assets before it is published. Every issue comes with its rule and a suggested fix, and a person makes the final call.";

export const metadata: Metadata = {
  metadataBase: new URL("https://proofmark-flame.vercel.app"),
  title: "Proofmark: brand guidelines as code",
  description: DESCRIPTION,
  // A link pasted into a chat or an email shows a card (the image is src/app/opengraph-image.tsx).
  openGraph: { title: "Proofmark: brand guidelines as code", description: DESCRIPTION, url: "/", siteName: "Proofmark", type: "website" },
  twitter: { card: "summary_large_image", title: "Proofmark: brand guidelines as code", description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col font-sans isolate">
        <div className="print:hidden"><Backdrop /></div>
        {children}
      </body>
    </html>
  );
}
