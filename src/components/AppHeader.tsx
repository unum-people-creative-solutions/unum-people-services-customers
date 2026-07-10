"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutFromHostedUI } from "@/lib/pkce";

export default function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-10 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-blue rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
            <span className="text-white font-black text-xl">U</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Unum People</h1>
            <p className="text-xs text-support-grey">Portal do Cliente</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
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
          <button
            onClick={() => logoutFromHostedUI()}
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
