'use client';

// metricas-de-visitas MV-71 a MV-74 (§2.8): visitas da empresa ativa, lidas de
// GET /me/visitas. A tela decide só pela resposta da rota; o cadeado do cabeçalho é aviso.
import { useCallback, useEffect, useRef, useState } from 'react';
import { notFound } from 'next/navigation';
import { AlertCircle, Lock } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import ForaDoPlano from '@/components/ForaDoPlano';
import GraficoDeVisitas from '@/components/visitas/GraficoDeVisitas';
import ListaDeParticipacao from '@/components/visitas/ListaDeParticipacao';
import { useTenant } from '@/contexts/TenantContext';
import { upgradeQueLibera } from '@/lib/upgradeQueLibera';
import { ehRecusaPorPermissao, MENSAGEM_SEM_PERMISSAO } from '@/services/api';
import { PlanosService } from '@/services/planos';
import { VisitasService } from '@/services/visitas';
import type { PlanoParaTroca } from '@/types/planos';
import type { PeriodoDeVisitas, VisitasDoPeriodo } from '@/types/visitas';

type Estado =
  | { status: 'carregando' }
  | { status: 'inexistente' }
  | { status: 'proibido' }
  | { status: 'erro' }
  | { status: 'fora' }
  | { status: 'pronto'; dados: VisitasDoPeriodo };

type EstadoDosPlanos =
  | { status: 'carregando' }
  | { status: 'pronto'; planos: PlanoParaTroca[] }
  | { status: 'erro' };

const PERIODOS: PeriodoDeVisitas[] = [7, 30, 90];

// Textos literais da spec §2.8.2.
const SUBTITULO =
  'Quantas vezes a sua página foi aberta, de onde vieram as visitas e quantos toques houve para falar com você. Os números somam todas as páginas da empresa.';
const AJUDA_DOS_TOQUES = 'Toques no WhatsApp, no telefone e nos botões de contato da página.';
const NOTA_FIXA =
  "Visitas vindas do WhatsApp quase sempre aparecem como 'Direto': o WhatsApp não diz de onde o visitante veio. Recarregar a página não conta de novo, e robôs conhecidos ficam de fora.";
const FORA_DO_PLANO =
  'A contagem de visitas faz parte dos planos Presença e Captação. Ela começa no dia da troca de plano.';

const CARTAO = 'bg-white rounded-2xl border border-gray-200 shadow-sm p-6';
const BOTAO_TENTAR_DE_NOVO =
  'mt-3 min-h-[44px] text-sm font-bold text-red-800 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue';

function numero(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

function Alerta({ texto, aoTentarDeNovo }: { texto: string; aoTentarDeNovo: () => void }) {
  return (
    <div
      role="alert"
      className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-3 items-start shadow-sm"
    >
      <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} aria-hidden="true" />
      <div>
        <p className="text-sm text-red-700">{texto}</p>
        <button type="button" onClick={aoTentarDeNovo} className={BOTAO_TENTAR_DE_NOVO}>
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

export default function VisitasPage() {
  const { activeTenantId, isLoadingTenants } = useTenant();
  const [periodo, setPeriodo] = useState<PeriodoDeVisitas>(30);
  const [estado, setEstado] = useState<Estado>({ status: 'carregando' });
  const [planos, setPlanos] = useState<EstadoDosPlanos>({ status: 'carregando' });
  // Os botões de período só aparecem depois que a rota mostrou a tela com números
  // (nunca para quem está fora do plano).
  const [comPeriodo, setComPeriodo] = useState(false);
  // Só a leitura mais recente mexe no estado: a resposta atrasada de outro período ou de
  // outra empresa é descartada.
  const requisicaoRef = useRef(0);
  const planosRef = useRef(0);

  // Empresa trocada: nada da anterior fica na tela.
  const [tenantVisto, setTenantVisto] = useState(activeTenantId);
  if (activeTenantId !== tenantVisto) {
    setTenantVisto(activeTenantId);
    setEstado({ status: 'carregando' });
    setComPeriodo(false);
  }

  // MV-74: a sugestão de plano só existe para quem está fora do plano. Falha vira alerta.
  const lerPlanos = useCallback(async (tenantId: string) => {
    const requisicao = ++planosRef.current;
    setPlanos({ status: 'carregando' });
    try {
      const lista = await PlanosService.listar(tenantId);
      if (requisicao === planosRef.current) setPlanos({ status: 'pronto', planos: lista });
    } catch (err) {
      if (requisicao !== planosRef.current) return;
      console.error('Erro ao ler os planos para a troca:', err);
      setPlanos({ status: 'erro' });
    }
  }, []);

  const ler = useCallback(
    async (tenantId: string, dias: PeriodoDeVisitas) => {
      const requisicao = ++requisicaoRef.current;
      planosRef.current++;
      setEstado({ status: 'carregando' });
      try {
        const leitura = await VisitasService.ler(tenantId, dias);
        if (requisicao !== requisicaoRef.current) return;
        if ('inexistente' in leitura) {
          setEstado({ status: 'inexistente' });
        } else if (!leitura.disponivel) {
          setComPeriodo(false);
          setEstado({ status: 'fora' });
          void lerPlanos(tenantId);
        } else {
          setComPeriodo(true);
          setEstado({ status: 'pronto', dados: leitura });
        }
      } catch (err) {
        if (requisicao !== requisicaoRef.current) return;
        console.error('Erro ao carregar as visitas:', err);
        setEstado({ status: ehRecusaPorPermissao(err) ? 'proibido' : 'erro' });
      }
    },
    [lerPlanos],
  );

  useEffect(() => {
    if (isLoadingTenants || !activeTenantId) return;
    void ler(activeTenantId, periodo);
  }, [isLoadingTenants, activeTenantId, periodo, ler]);

  // MV-73 (D-MV-24): a empresa não tem a tela; a mesma 404 de um endereço inexistente.
  if (estado.status === 'inexistente') notFound();

  const carregando = estado.status === 'carregando';
  const mostraPeriodo = comPeriodo && (carregando || estado.status === 'pronto' || estado.status === 'erro');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <section
          aria-labelledby="visitas-titulo"
          aria-busy={carregando ? 'true' : undefined}
          className="flex flex-col gap-6"
        >
          <div>
            <h2 id="visitas-titulo" className="text-xl font-black text-gray-900">
              Visitas
            </h2>
            <p className="text-sm text-gray-500 mt-1">{SUBTITULO}</p>
          </div>

          {mostraPeriodo && (
            <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
              {PERIODOS.map((dias) => (
                <button
                  key={dias}
                  type="button"
                  aria-pressed={periodo === dias}
                  onClick={() => setPeriodo(dias)}
                  className={`min-h-[44px] px-4 rounded-xl text-sm font-bold border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                    periodo === dias
                      ? 'bg-brand-blue border-brand-blue text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {`${dias} dias`}
                </button>
              ))}
            </div>
          )}

          {carregando ? (
            <p className="text-sm text-gray-600">Carregando as visitas…</p>
          ) : estado.status === 'proibido' ? (
            <div className={CARTAO}>
              <p className="text-gray-800">{MENSAGEM_SEM_PERMISSAO}</p>
            </div>
          ) : estado.status === 'erro' ? (
            <Alerta
              texto="Não foi possível carregar as visitas."
              aoTentarDeNovo={() => void ler(activeTenantId, periodo)}
            />
          ) : estado.status === 'fora' ? (
            <div className={`${CARTAO} flex flex-col gap-4 max-w-md`}>
              <div className="flex gap-3 items-start">
                <Lock className="text-gray-400 shrink-0 mt-0.5" size={20} aria-hidden="true" />
                <p className="text-sm text-gray-700">{FORA_DO_PLANO}</p>
              </div>
              {planos.status === 'pronto' && (
                <ForaDoPlano plano={upgradeQueLibera(planos.planos, (p) => p.metricas_de_visitas)} />
              )}
              {planos.status === 'erro' && (
                <Alerta
                  texto="Não foi possível carregar os planos."
                  aoTentarDeNovo={() => void lerPlanos(activeTenantId)}
                />
              )}
            </div>
          ) : estado.status === 'pronto' ? (
            estado.dados.totais.visitas === 0 && estado.dados.totais.toques === 0 ? (
              <div className={`${CARTAO} flex flex-col gap-3`}>
                <p className="text-gray-800">{`Nenhuma visita contada nos últimos ${estado.dados.periodo} dias.`}</p>
                <p className="text-xs text-gray-500">{NOTA_FIXA}</p>
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={CARTAO}>
                    <dt className="text-sm font-semibold text-gray-600">Visitas</dt>
                    <dd className="text-3xl font-black text-gray-900 mt-1">{numero(estado.dados.totais.visitas)}</dd>
                  </div>
                  <div className={CARTAO}>
                    <dt className="text-sm font-semibold text-gray-600">Toques para falar com você</dt>
                    <dd className="text-3xl font-black text-gray-900 mt-1">{numero(estado.dados.totais.toques)}</dd>
                    <dd className="text-xs text-gray-500 mt-2">{AJUDA_DOS_TOQUES}</dd>
                  </div>
                </dl>
                <div className={CARTAO}>
                  <GraficoDeVisitas dias={estado.dados.dias} />
                </div>
                <div className={CARTAO}>
                  <ListaDeParticipacao origens={estado.dados.origens} aparelhos={estado.dados.aparelhos} />
                </div>
                <p className="text-xs text-gray-500">{NOTA_FIXA}</p>
              </>
            )
          ) : null}
        </section>
      </main>
    </div>
  );
}
