"use client";

import { useEffect, useRef, useState } from "react";
import { TenantService, TenantResponse, AcessosService, MeusAcessos } from "@/services/api";
import { 
  Globe, 
  Kanban, 
  BookOpen, 
  ArrowRight, 
  Lock, 
  RefreshCw,
  Settings,
  Pencil,
  LayoutTemplate
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { useTenant } from "@/contexts/TenantContext";
import { siteHostLabel } from "@/lib/siteHost";
import SubscriptionCancel from "@/components/SubscriptionCancel";

// RF-5A-28: o editor de cada página do configurador abre pelo slug dela.
function editorDaPagina(slug: string): string {
  const base = process.env.NEXT_PUBLIC_LP_BUILDER_URL || "https://unumpeople.app";
  return `${base}/minha-conta/editar?slug=${encodeURIComponent(slug)}`;
}

type EstadoAcessos =
  | { status: "carregando" }
  | { status: "pronto"; dados: MeusAcessos }
  | { status: "erro" };

// null = carregando ou erro: não decide, para não liberar por engano.
function temPermissao(estado: EstadoAcessos, ferramentaId: string, permissao: string): boolean | null {
  if (estado.status !== "pronto") return null;
  const ferramenta = estado.dados.ferramentas.find((f) => f.id === ferramentaId);
  // Ausente ou não contratada não decide; "Não incluso" continua em enabled_services.
  if (!ferramenta?.contratada) return null;
  return ferramenta.permissoes.includes(permissao);
}

export default function ProductsPage() {
  const { activeTenantId, isLoadingTenants } = useTenant();
  const [tenant, setTenant] = useState<TenantResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acessosEstado, setAcessosEstado] = useState<EstadoAcessos>({ status: "carregando" });
  const requisicaoRef = useRef(0);

  const fetchTenant = async (tenantId?: string) => {
    const requisicao = ++requisicaoRef.current;
    setLoading(true);
    setError(null);
    setAcessosEstado({ status: "carregando" });

    // As duas leituras começam juntas; o atraso de uma empresa anterior é ignorado.
    const tenantPromise = TenantService.getMe(tenantId);
    const acessosPromise = AcessosService.get(tenantId);

    try {
      const res = await tenantPromise;
      if (requisicao === requisicaoRef.current) setTenant(res);
    } catch (err: any) {
      if (requisicao === requisicaoRef.current) {
        console.error("Erro ao carregar dados do tenant:", err);
        setError("Não foi possível carregar as informações da sua conta. Tente novamente.");
      }
    } finally {
      // A página aparece com o getMe; permissão pendente não segura o spinner.
      if (requisicao === requisicaoRef.current) setLoading(false);
    }

    try {
      const dados = await acessosPromise;
      if (requisicao !== requisicaoRef.current) return;
      setAcessosEstado({ status: "pronto", dados });
    } catch (err) {
      if (requisicao !== requisicaoRef.current) return;
      console.error("Erro ao carregar permissões:", err);
      setAcessosEstado({ status: "erro" });
    }
  };

  useEffect(() => {
    if (!isLoadingTenants) {
      fetchTenant(activeTenantId);
    }
  }, [isLoadingTenants, activeTenantId]);

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
  const podeVerCrm = temPermissao(acessosEstado, "crm", "crm.lead.ver");
  const podeVerBlog = temPermissao(acessosEstado, "blog", "blog.post.ver");
  const podeVerLp = temPermissao(acessosEstado, "lp", "lp.pagina.ver");
  const podeEditarLp = temPermissao(acessosEstado, "lp", "lp.rascunho.editar");
  const sites = tenant?.site_urls?.length
    ? tenant.site_urls
    : (tenant?.site_url ? [tenant.site_url] : []);
  const paginas = tenant?.paginas ?? [];
  const paginasIndisponiveis = tenant?.paginas_indisponiveis ?? false;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

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
              Aqui você pode gerenciar suas assinaturas, ver o status dos seus sites e acessar as ferramentas inclusas no seu plano.
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

        {acessosEstado.status === "erro" && (
          <div role="alert" className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-3 items-start shadow-sm">
            <Settings className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-bold text-red-800 text-sm">Erro</h3>
              <p className="text-red-700 text-sm mt-1">Não foi possível carregar suas permissões nesta empresa.</p>
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card: Site personalizado */}
          {sites.length > 0 && (
            <section aria-labelledby="produto-site" className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition group">
              <div>
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-brand-blue mb-4">
                  <Globe size={24} />
                </div>
                <h4 id="produto-site" className="text-lg font-bold text-gray-900">Site personalizado</h4>
                <p className="text-sm text-gray-600 mt-2">
                  O site feito sob medida para a sua empresa, no seu domínio.
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex flex-col gap-2">
                  {sites.map((url) => (
                    <div key={url} className="flex flex-col gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-brand-blue text-white py-2.5 px-4 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 text-sm shadow-sm"
                      >
                        {sites.length === 1 ? "Visitar site" : `Visitar ${siteHostLabel(url)}`}
                        <ArrowRight size={16} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Card: Configurador de páginas */}
          {(paginas.length > 0 || paginasIndisponiveis) && (
            <section aria-labelledby="produto-configurador" className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition group">
              <div>
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-brand-blue mb-4">
                  <LayoutTemplate size={24} />
                </div>
                <h4 id="produto-configurador" className="text-lg font-bold text-gray-900">Configurador de páginas</h4>
                <p className="text-sm text-gray-600 mt-2">
                  Suas páginas montadas no configurador da Unum People, prontas para captar contatos.
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex flex-col gap-2">
                  {paginasIndisponiveis && (
                    <p role="alert" className="w-full bg-amber-50 border border-amber-200 text-amber-800 py-2.5 px-4 rounded-xl text-xs font-bold text-center">
                      Não foi possível carregar as páginas do configurador.
                    </p>
                  )}
                  {paginas.map((pagina) => (
                    <div key={pagina.slug} className="flex flex-col gap-2">
                      {pagina.publicada ? (
                        <a
                          href={pagina.endereco}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-brand-blue text-white py-2.5 px-4 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 text-sm shadow-sm"
                        >
                          {paginas.length === 1 ? "Visitar página" : `Visitar ${siteHostLabel(pagina.endereco)}`}
                          <ArrowRight size={16} />
                        </a>
                      ) : (
                        <div className="w-full bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                          Página fora do ar
                        </div>
                      )}
                      {podeEditarLp === true && (
                        <a
                          href={editorDaPagina(pagina.slug)}
                          className="w-full bg-blue-50 border border-blue-200 text-brand-blue py-2.5 px-4 rounded-xl font-bold hover:bg-blue-100 transition flex items-center justify-center gap-2 text-sm"
                        >
                          <Pencil size={16} />
                          {paginas.length === 1 ? "Editar página" : `Editar ${siteHostLabel(pagina.endereco)}`}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {podeVerLp === false && (
                  <div className="w-full mt-2 bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                    <Lock size={14} />
                    Sem acesso nesta empresa
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Card 2: CRM */}
          <section aria-labelledby="produto-crm" className={`bg-white rounded-2xl border p-6 flex flex-col justify-between shadow-sm transition ${
            isCrmEnabled ? "border-gray-200 hover:shadow-md" : "border-gray-100 bg-gray-50/50"
          }`}>
            <div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isCrmEnabled ? "bg-orange-50 text-brand-orange" : "bg-gray-100 text-gray-400"
              }`}>
                <Kanban size={24} />
              </div>
              <div className="flex items-center gap-2">
                <h4 id="produto-crm" className="text-lg font-bold text-gray-900">CRM Unum</h4>
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
                podeVerCrm === true ? (
                  <a
                    href={crmUrl}
                    className="w-full bg-brand-orange text-white py-2.5 px-4 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 text-sm shadow-sm shadow-orange-100"
                  >
                    Acessar CRM
                    <ArrowRight size={16} />
                  </a>
                ) : podeVerCrm === false ? (
                  <div className="w-full bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                    <Lock size={14} />
                    Sem acesso nesta empresa
                  </div>
                ) : null
              ) : (
                <div className="w-full bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                  <Lock size={14} />
                  Não incluso neste plano
                </div>
              )}
            </div>
          </section>

          {/* Card 3: Blog */}
          <section aria-labelledby="produto-blog" className={`bg-white rounded-2xl border p-6 flex flex-col justify-between shadow-sm transition ${
            isBlogEnabled ? "border-gray-200 hover:shadow-md" : "border-gray-100 bg-gray-50/50"
          }`}>
            <div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                isBlogEnabled ? "bg-purple-50 text-brand-purple" : "bg-gray-100 text-gray-400"
              }`}>
                <BookOpen size={24} />
              </div>
              <div className="flex items-center gap-2">
                <h4 id="produto-blog" className="text-lg font-bold text-gray-900">Blog Admin</h4>
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
                podeVerBlog === true ? (
                  <a
                    href={blogUrl}
                    className="w-full bg-brand-purple text-white py-2.5 px-4 rounded-xl font-bold hover:brightness-110 transition flex items-center justify-center gap-2 text-sm shadow-sm shadow-purple-100"
                  >
                    Acessar Blog
                    <ArrowRight size={16} />
                  </a>
                ) : podeVerBlog === false ? (
                  <div className="w-full bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                    <Lock size={14} />
                    Sem acesso nesta empresa
                  </div>
                ) : null
              ) : (
                <div className="w-full bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                  <Lock size={14} />
                  Não incluso neste plano
                </div>
              )}
            </div>
          </section>
        </div>

        {/* portal-cancelamento RF-C2: cancelamento e arrependimento da assinatura */}
        <div className="mt-8">
          <SubscriptionCancel tenantId={activeTenantId} />
        </div>
      </main>
    </div>
  );
}
