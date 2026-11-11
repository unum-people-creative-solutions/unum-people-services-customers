"use client";

// cobranca-e-plano-do-cliente RF2-32: faixa de cobrança do Portal, acima do cabeçalho
// de toda página (BP-T §4). Textos aprovados; a UI não decide autorização: o link de
// pagar só existe quando a API mandou (pode_gerir).
import { AlertCircle, ExternalLink, Lock } from 'lucide-react';
import { useCobranca } from '@/contexts/CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { ferramentasCitadas, formatarData, formatarReais } from '@/lib/cobrancaTexto';
import type { ResumoDeCobranca } from '@/types/cobranca';

const EMAIL_DO_ATENDIMENTO = 'atendimento@unumpeople.com.br';
const LINHA_DO_BOLETO = 'Pix confirma na hora. Boleto pode levar até 3 dias úteis para ser confirmado.';

const BOTAO_PRIMARIO =
  'w-full md:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

function data(valor: string | undefined): string {
  return valor ? formatarData(valor) : '';
}

function textoDoEstado(resumo: ResumoDeCobranca, servicosDoPlano: string[]): string {
  switch (resumo.situacao) {
    case 'em_atraso': {
      const ferramentas = ferramentasCitadas(servicosDoPlano);
      if (resumo.fatura) {
        return `Sua fatura de ${formatarReais(resumo.fatura.valor)} venceu em ${data(resumo.fatura.vencimento)}. Pague até ${data(resumo.pagar_ate)} para não perder o acesso a ${ferramentas}.`;
      }
      return `Sua fatura venceu em ${data(resumo.vencida_em)}. Pague até ${data(resumo.pagar_ate)} para não perder o acesso a ${ferramentas}.`;
    }
    case 'bloqueado':
      return `Acesso a ${ferramentasCitadas(resumo.ferramentas_bloqueadas)} bloqueado por fatura em atraso. Sua página publicada sai do ar em ${data(resumo.fora_do_ar_em)}.`;
    case 'fora_do_ar':
      return `Sua página está fora do ar por falta de pagamento. A conta será cancelada em ${data(resumo.cancelamento_em)}.`;
    default:
      return '';
  }
}

function AviseOResponsavel() {
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold">
      <Lock size={14} aria-hidden="true" className="shrink-0" />
      Avise o responsável pela conta
    </p>
  );
}

function LinhaSemLink() {
  return (
    <p className="text-sm">
      Não conseguimos abrir o link da fatura. Escreva para{' '}
      <a href={`mailto:${EMAIL_DO_ATENDIMENTO}`} className="font-semibold underline">
        {EMAIL_DO_ATENDIMENTO}
      </a>{' '}
      que enviamos para você.
    </p>
  );
}

function Acao({ resumo, nomeDoNegocio }: { resumo: ResumoDeCobranca; nomeDoNegocio: string }) {
  if (!resumo.pode_gerir) return <AviseOResponsavel />;

  if (resumo.situacao === 'fora_do_ar') {
    const assunto = encodeURIComponent(`Reativar minha conta – ${nomeDoNegocio}`);
    return (
      <a href={`mailto:${EMAIL_DO_ATENDIMENTO}?subject=${assunto}`} className={BOTAO_PRIMARIO}>
        Pedir a reativação por e-mail
      </a>
    );
  }

  // Sem fatura registrada (ou registrada sem link): não há o que pagar pela tela.
  if (!resumo.fatura?.link) return <LinhaSemLink />;

  return (
    <a href={resumo.fatura.link} target="_blank" rel="noopener noreferrer" className={BOTAO_PRIMARIO}>
      Pagar fatura
      <ExternalLink size={16} aria-hidden="true" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

export default function FaixaDeCobranca() {
  const { resumo, erro, recarregar } = useCobranca();
  const { activeTenantId, activeTenantName, availableTenants } = useTenant();

  if (erro) {
    return (
      <section aria-label="Aviso de cobrança" className="bg-red-50 border-b border-red-200 md:border-b-0 md:border-l-4 md:border-red-500">
        <div role="alert" className="max-w-6xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
          <AlertCircle size={20} aria-hidden="true" className="text-red-500 shrink-0" />
          <div className="flex-1">
            <h2 className="font-bold text-red-800 text-sm">Erro</h2>
            <p className="text-red-700 text-sm mt-1">Não foi possível conferir a situação da sua fatura.</p>
          </div>
          <button
            type="button"
            onClick={() => { recarregar().catch(() => undefined); }}
            className="w-full md:w-auto min-h-[44px] border border-gray-300 bg-white rounded-lg text-sm font-bold text-gray-700 px-4 py-2 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            Tentar de novo
          </button>
        </div>
      </section>
    );
  }

  if (!resumo) return null;
  if (resumo.situacao !== 'em_atraso' && resumo.situacao !== 'bloqueado' && resumo.situacao !== 'fora_do_ar') {
    return null;
  }

  const servicosDoPlano = availableTenants.find((t) => t.id === activeTenantId)?.enabled_services ?? [];
  const emAtraso = resumo.situacao === 'em_atraso';
  const Icone = emAtraso ? AlertCircle : Lock;

  return (
    <section
      aria-label="Aviso de cobrança"
      className={
        emAtraso
          ? 'bg-amber-50 border-b border-amber-200 text-amber-900'
          : 'bg-red-50 border-b border-red-200 md:border-b-0 md:border-l-4 md:border-red-500 text-red-800'
      }
    >
      <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Icone size={20} aria-hidden="true" className="shrink-0 mt-0.5" />
          <div role="status" className="text-sm">
            <p className="font-semibold">{textoDoEstado(resumo, servicosDoPlano)}</p>
            {resumo.situacao !== 'fora_do_ar' && <p className="mt-1">{LINHA_DO_BOLETO}</p>}
          </div>
        </div>
        <Acao resumo={resumo} nomeDoNegocio={activeTenantName} />
      </div>
    </section>
  );
}
