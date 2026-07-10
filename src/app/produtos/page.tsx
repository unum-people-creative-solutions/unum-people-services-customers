"use client";

import { useEffect, useState } from "react";
import { TenantService, TenantResponse } from "@/services/api";
import { 
  Globe, 
  Kanban, 
  BookOpen, 
  ArrowRight, 
  Lock, 
  RefreshCw,
  LogOut,
  Settings
} from "lucide-react";
import { logoutFromHostedUI } from "@/lib/pkce";

export default function ProductsPage() {
  const [tenant, setTenant] = useState<TenantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenant = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await TenantService.getMe();
      setTenant(res);
    } catch (err: any) {
      console.error("Erro ao carregar dados do tenant:", err);
      setError("Não foi possível carregar as informações da sua conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenant();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-brand-blue" size={48} />
          <p className="text-gray-600 font-semibold">Carregando seus produtos...</p>
        </div>
      </div>
    );
  }

  const crmUrl = process.env.NEXT_PUBLIC_CRM_URL || "https://crm.unumpeople.com.br";
  const blogUrl = process.env.NEXT_PUBLIC_BLOG_ADMIN_URL || "https://blog-admin.unumpeople.com.br";

  const isCrmEnabled = tenant?.enabled_services?.includes("crm") ?? false;
  const isBlogEnabled = tenant?.enabled_services?.includes("blog") ?? false;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
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
            <a 
              href="/termos"
              className="text-sm font-semibold text-gray-600 hover:text-brand-blue transition"
            >
              Termos Legais
            </a>
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

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-brand-blue to-brand-purple rounded-2xl p-6 md:p-8 text-white mb-8 shadow-xl shadow-blue-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Plano Ativo: {tenant?.plan_name || "Básico"}
            </span>
            <h2 className="text-2xl md:text-3xl font-black mt-3">Olá! Bem-vindo ao seu portal.</h2>
            <p className="text-white/80 text-sm mt-1 max-w-xl">
              Aqui você pode gerenciar suas assinaturas, visualizar o status do seu site institucional e acessar as ferramentas inclusas no seu plano.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-3 rounded-xl flex items-center gap-3 self-stretch md:self-auto">
            <Settings className="text-white" size={24} />
            <div>
              <p className="text-xs text-white/60 uppercase font-bold tracking-wider">Status da Conta</p>
              <p className="text-sm font-bold uppercase">{tenant?.status || "Ativo"}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-3 items-start shadow-sm">
            <Settings className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-bold text-red-800 text-sm">Erro</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-xl font-black text-gray-900">Seus Serviços</h3>
          <p className="text-sm text-gray-500 mt-1">Abaixo estão as ferramentas e serviços configurados para a sua empresa.</p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Site Institucional */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition group">
            <div>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-brand-blue mb-4">
                <Globe size={24} />
              </div>
              <h4 className="text-lg font-bold text-gray-900">Site Institucional</h4>
              <p className="text-sm text-gray-600 mt-2">
                Sua presença digital principal com carregamento rápido e design otimizado para conversões.
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              {tenant?.site_url ? (
                <a
                  href={tenant.site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-brand-blue text-white py-2.5 px-4 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 text-sm shadow-sm"
                >
                  Visitar Site
                  <ArrowRight size={16} />
                </a>
              ) : (
                <div className="w-full bg-blue-50 border border-blue-200 text-brand-blue font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs">
                  <span className="w-2 h-2 bg-brand-blue rounded-full animate-ping"></span>
                  Em produção
                </div>
              )}
            </div>
          </div>

          {/* Card 2: CRM */}
          <div className={`bg-white rounded-2xl border p-6 flex flex-col justify-between shadow-sm transition ${
            isCrmEnabled ? "border-gray-200 hover:shadow-md" : "border-gray-100 bg-gray-50/50"
          }`}>
            <div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isCrmEnabled ? "bg-orange-50 text-brand-orange" : "bg-gray-100 text-gray-400"
              }`}>
                <Kanban size={24} />
              </div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-gray-900">CRM Unum</h4>
                {!isCrmEnabled && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                    Bloqueado
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Gestão inteligente de leads, funil de vendas integrado e automação de contatos.
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              {isCrmEnabled ? (
                <a
                  href={crmUrl}
                  className="w-full bg-brand-orange text-white py-2.5 px-4 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 text-sm shadow-sm shadow-orange-100"
                >
                  Acessar CRM
                  <ArrowRight size={16} />
                </a>
              ) : (
                <div className="w-full bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                  <Lock size={14} />
                  Não incluso neste plano
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Blog */}
          <div className={`bg-white rounded-2xl border p-6 flex flex-col justify-between shadow-sm transition ${
            isBlogEnabled ? "border-gray-200 hover:shadow-md" : "border-gray-100 bg-gray-50/50"
          }`}>
            <div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isBlogEnabled ? "bg-purple-50 text-brand-purple" : "bg-gray-100 text-gray-400"
              }`}>
                <BookOpen size={24} />
              </div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-bold text-gray-900">Blog Admin</h4>
                {!isBlogEnabled && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                    Bloqueado
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Gerencie seus artigos de blog, SEO, tags e conteúdo institucional em um só painel.
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              {isBlogEnabled ? (
                <a
                  href={blogUrl}
                  className="w-full bg-brand-purple text-white py-2.5 px-4 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 text-sm shadow-sm shadow-purple-100"
                >
                  Acessar Blog
                  <ArrowRight size={16} />
                </a>
              ) : (
                <div className="w-full bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                  <Lock size={14} />
                  Não incluso neste plano
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
