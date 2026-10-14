import { Suspense } from "react";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";
import { TenantProvider } from "@/contexts/TenantContext";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "900"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Portal do Cliente | Unum People",
  description: "Gerencie seus termos e produtos",
  // Portal só para clientes logados: nada aqui deve ir para o Google. Quem não
  // está logado é mandado para o login do Cognito (auth.unumpeople.com.br), um
  // dos caminhos pelos quais o Google indexava a página vazia de login.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${poppins.className} ${poppins.variable}`}>
        <AuthGuard>
          {/* TenantProvider lê ?tenant_id= via useSearchParams, que exige Suspense. */}
          <Suspense fallback={null}>
            <TenantProvider>{children}</TenantProvider>
          </Suspense>
        </AuthGuard>
      </body>
    </html>
  );
}
