import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { config } from "@/lib/config";
import { isDemoCatalog } from "@/lib/printful/store";

/**
 * An editorial pairing: a high-contrast serif carries the statement headlines,
 * a geometric grotesque handles everything functional. Light weights only —
 * the display face is set large, where heavy weights read as shouting.
 */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: `${config.brand.name} — ${config.brand.tagline}`,
    template: `%s — ${config.brand.name}`,
  },
  description: config.brand.tagline,
  openGraph: {
    title: config.brand.name,
    description: config.brand.tagline,
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter demoMode={isDemoCatalog()} />
      </body>
    </html>
  );
}
