"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TermsService, TermStatusItem, AcceptedTermItem, ehRecusaPorPermissao, MENSAGEM_SEM_PERMISSAO } from "@/services/api";
import { useTenant } from "@/contexts/TenantContext";
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Lock, 
  RefreshCw, 
  ArrowRight
} from "lucide-react";
import { getSafeRedirect } from "@/lib/safeRedirect";
import AppHeader from "@/components/AppHeader";

interface DisplayTermItem extends TermStatusItem {
  status: "pending";
}

// Termo aceito como a tela mostra: versão, data e link da versão aceita
// (termos-vigentes-e-aceitos).
interface TermoAceito {
  term_id: string;
  term_name: string;
  versao: number;
  aceitoEm: string;
  document_url: string;
}

function termoAceitoDaApi(item: AcceptedTermItem): TermoAceito {
  return {
    term_id: item.term_id,
    term_name: item.term_name,
    versao: item.accepted_version,
    aceitoEm: new Date(item.accepted_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    document_url: item.document_url,
  };
}

export default function TermsPage() {
  const searchParams = useSearchParams();
  const { activeTenantId, activeTenantName, isLoadingTenants } = useTenant();
  const [terms, setTerms] = useState<DisplayTermItem[]>([]);
  const [aceitos, setAceitos] = useState<TermoAceito[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = async (tenantId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await TermsService.getStatus(tenantId);
      const displayItems: DisplayTermItem[] = res.pending.map((item) => ({
        ...item,
        status: "pending",
      }));
      setTerms(displayItems);
      setAceitos(res.accepted.map(termoAceitoDaApi));
    } catch (err: any) {
      console.error("Erro ao carregar termos:", err);
      setError("Não foi possível carregar a lista de termos pendentes. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingTenants) {
      fetchTerms(activeTenantId);
    }
  }, [isLoadingTenants, activeTenantId]);

  useEffect(() => {
    if (!loading) {
      const hasPending = terms.some((t) => t.status === "pending");
      const returnTo = searchParams.get("return_to");
      if (!hasPending && returnTo) {
        const validated = getSafeRedirect(returnTo, "/termos");
        if (validated !== "/termos" && !["/", "/auth/callback"].includes(validated)) {
          window.location.href = validated;
        }
      }
    }
  }, [loading, terms, searchParams]);

  const handleAccept = async (item: DisplayTermItem) => {
    try {
      setSubmittingId(item.term_id);
      setError(null);
      await TermsService.accept(item.type, item.required_version, activeTenantId);
      
      // O termo aceito sai dos pendentes e entra nos aceitos, com a data de hoje
      setTerms((prev) => prev.filter((t) => t.term_id !== item.term_id));
      setAceitos((prev) => [
        ...prev,
        {
          term_id: item.term_id,
          term_name: item.term_name,
          versao: item.required_version,
          aceitoEm: new Date().toLocaleDateString("pt-BR"),
          document_url: item.document_url,
        },
      ]);
    } catch (err: any) {
      console.error("Erro ao aceitar termo:", err);
      if (err.response?.status === 409) {
        setError(
          "Conflito de versão: Este termo foi atualizado recentemente. Por favor, recarregue a página para ler e aceitar a versão mais recente."
        );
      } else if (ehRecusaPorPermissao(err)) {
        setError(MENSAGEM_SEM_PERMISSAO);
      } else {
        setError(
          err.response?.data?.error ||
            "Não foi possível aceitar o termo. Por favor, tente novamente."
        );
      }
    } finally {
      setSubmittingId(null);
    }
  };

  // RNF-PCT-06: Sem cache/ISR na busca de termos pendentes
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-brand-blue" size={48} />
          <p className="text-gray-600 font-semibold">Carregando termos...</p>
        </div>
      </div>
    );
  }

  const getFriendlyTypeName = (type: string) => {
    switch (type) {
      case "contratacao_servico":
        return "Termo de Contratação de Serviço";
      case "termos_uso":
        return "Termos de Uso";
      case "politica_privacidade":
        return "Política de Privacidade";
      default:
        return "Termo Legal";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-gray-900 md:text-3xl">Termos Legais e Consentimentos</h2>
          <p className="text-gray-600 mt-2">
            Para continuar utilizando nossos serviços, leia e aceite os termos e políticas abaixo.
          </p>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-3 items-start shadow-sm">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-bold text-red-800 text-sm">Atenção</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Terms List / State */}
        {terms.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-600">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Tudo em dia!</h3>
            <p className="text-gray-600 max-w-md">
              Você já aceitou todas as versões mais recentes dos termos de uso, políticas de privacidade e contratos de serviço.
            </p>
            <div className="flex gap-4 mt-2">
              <a
                href="/produtos"
                className="bg-brand-blue text-white px-6 py-2.5 rounded-lg font-bold hover:bg-opacity-90 transition flex items-center gap-2 shadow-md shadow-blue-200"
              >
                Ir para Meus Produtos
                <ArrowRight size={18} />
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {terms.map((item) => (
              <div
                key={item.term_id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex gap-4 items-start">
                    <div
                      className={`p-3 rounded-lg ${
                        item.can_accept
                          ? "bg-blue-50 text-brand-blue"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      <FileText size={24} />
                    </div>
                    <div>
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.can_accept
                            ? "bg-blue-100 text-brand-blue"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {getFriendlyTypeName(item.type)}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900 mt-2">
                        {item.term_name || "Documento sem título"}
                      </h3>
                      <p className="text-xs text-support-grey mt-1">
                        Versão Requerida: v{item.required_version}
                      </p>
                      {item.type === "contratacao_servico" && activeTenantName && (
                        <p className="text-xs text-support-grey mt-1">
                          {`Empresa: ${activeTenantName}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      {item.can_accept ? (
                        <p className="text-xs text-gray-500">
                          Leia o termo antes de clicar em aceitar.
                        </p>
                      ) : (
                        <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                          <Lock size={14} />
                          Somente o administrador da conta pode aceitar este termo.
                        </span>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {item.document_url && (
                        <a
                          href={item.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
                        >
                          Visualizar Termo
                        </a>
                      )}
                      <button
                        onClick={() => handleAccept(item)}
                        disabled={!item.can_accept || submittingId !== null}
                        className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition flex items-center gap-2 shadow-sm ${
                          !item.can_accept
                            ? "bg-gray-300 cursor-not-allowed shadow-none"
                            : "bg-brand-blue hover:brightness-110 shadow-blue-100"
                        }`}
                      >
                        {submittingId === item.term_id ? (
                          <>
                            <RefreshCw className="animate-spin" size={16} />
                            Aceitando...
                          </>
                        ) : (
                          "Aceitar e Continuar"
                        )}
                      </button>
                    </div>
                  </div>
              </div>
            ))}

          </div>
        )}

        {aceitos.length > 0 && (
          <section aria-labelledby="termos-aceitos-titulo" className="mt-10">
            <h3 id="termos-aceitos-titulo" className="text-lg font-bold text-gray-900 mb-4">
              Termos aceitos
            </h3>
            <ul className="flex flex-col gap-3">
              {aceitos.map((aceito) => (
                <li
                  key={aceito.term_id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex gap-3 items-start">
                    <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-bold text-gray-900">{aceito.term_name}</p>
                      <p className="text-xs text-support-grey mt-1">
                        <span>{`Versão ${aceito.versao}`}</span>
                        {" · "}
                        <span>{`Aceito em ${aceito.aceitoEm}`}</span>
                      </p>
                    </div>
                  </div>
                  {aceito.document_url && (
                    <a
                      href={aceito.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visualizar ${aceito.term_name}`}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition self-start md:self-auto"
                    >
                      Visualizar
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
