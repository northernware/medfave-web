import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

/*
 * The two companion typefaces from the Medfave guidelines, self-hosted from
 * their npm packages rather than fetched from Google at build time, so a build
 * never depends on reaching fonts.googleapis.com.
 */
const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const jakarta = localFont({
  src: "../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Medfave",
    template: "%s · Medfave",
  },
  description: "Appointments and medical records for family practice, organised by household.",
};

const CANVAS = { light: "#fbf9fa", dark: "#221d21" };

async function currentTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

/** The browser chrome takes the canvas colour: the chosen one, or the device's. */
export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  return {
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: CANVAS.light },
            { media: "(prefers-color-scheme: dark)", color: CANVAS.dark },
          ]
        : CANVAS[theme],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await currentTheme();
  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
