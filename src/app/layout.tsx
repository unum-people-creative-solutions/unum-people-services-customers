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
          <TenantProvider>{children}</TenantProvider>
        </AuthGuard>
      </body>
    </html>
  );
}
