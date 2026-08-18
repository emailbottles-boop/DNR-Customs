import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { config } from "@/lib/config";
import { isDemoCatalog } from "@/lib/printful/store";

/**
 * A grotesk and a mono. Archivo carries the shouting — heavy, uppercase, packed
 * tight — while Plex Mono handles anything technical: sizes, order references,
 * section marks. That split is what keeps this from reading as a generic dark
 * theme; the mono is the streetwear tell.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: config.brand.name,
    template: `%s — ${config.brand.name}`,
  },
  // Search-result text only; never rendered on the site.
  description: "Drop 01. Long sleeve, made to order.",
  openGraph: {
    title: config.brand.name,
    // Search-result text only; never rendered on the site.
  description: "Drop 01. Long sleeve, made to order.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter demoMode={isDemoCatalog()} />
      </body>
    </html>
  );
}
