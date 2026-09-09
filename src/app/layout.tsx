import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Predictor by DTech — Pronostics IA",
  description:
    "Plateforme de pronostics et paris sportifs automatisée par IA : loi de Poisson, intelligence contextuelle, combiné du jour et vérification autonome des résultats.",
  icons: {
    icon: "/images/logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  );
}
