"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutFromHostedUI } from "@/lib/pkce";
import { useAuthStore } from "@/store/authStore";
import { useTenant } from "@/contexts/TenantContext";
import { useMeusAcessos } from "@/hooks/useMeusAcessos";
import { TenantSwitcher } from "./TenantSwitcher";

export default function AppHeader() {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const { activeTenantId } = useTenant();
  const { podeGerirUsuarios } = useMeusAcessos(activeTenantId);

  const handleLogout = () => {
    logout();
    logoutFromHostedUI();
  };

  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-10 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/images/logo_simbolo.webp"
            alt="Unum People"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Unum People</h1>
            <p className="text-xs text-support-grey">Portal do Cliente</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
          <TenantSwitcher />
          {pathname !== "/termos" && (
            <a
              href="/termos"
              className="text-sm font-semibold text-gray-600 hover:text-brand-blue transition"
            >
              Termos Legais
            </a>
          )}
          {pathname !== "/produtos" && (
            <a
              href="/produtos"
              className="text-sm font-semibold text-gray-600 hover:text-brand-blue transition"
            >
              Meus Produtos
            </a>
          )}
          {podeGerirUsuarios && pathname !== "/usuarios" && (
            <a
              href="/usuarios"
              className="text-sm font-semibold text-gray-600 hover:text-brand-blue transition"
            >
              Usuários
            </a>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}
