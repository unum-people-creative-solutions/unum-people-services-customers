'use client';

// cobranca-e-plano-do-cliente RF4-06 (BP-T §10.1, §10.2): o que a conta precisa para voltar
// e o que acontece depois. A tela não decide se a conta pode ser reativada: mostra o que o
// resumo (GET /me/cobranca) disse.
import { useId } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { useCobranca } from '@/contexts/CobrancaContext';
import { ferramentasCitadas, formatarData, formatarReais } from '@/lib/cobrancaTexto';
import type { PlanoEFaturas } from '@/types/cobranca';

const EMAIL_DO_ATENDIMENTO = 'atendimento@unumpeople.com.br';

const LINK_SECUNDARIO =
  'min-h-[44px] inline-flex items-center justify-center gap-2 border border-gray-300 bg-white rounded-lg text-sm font-bold text-gray-700 px-4 py-2 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue';

function Caixa({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">{children}</div>;
}

function NaoPodeReativar() {
  return (
    <Caixa>
      <p className="text-gray-800">
        Esta conta não pode ser reativada por aqui. Escreva para{' '}
        <a href={`mailto:${EMAIL_DO_ATENDIMENTO}`} className="font-semibold text-brand-blue underline">
          {EMAIL_DO_ATENDIMENTO}
        </a>
        .
      </p>
    </Caixa>
  );
}

function AviseOResponsavel() {
  return (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
      <Lock size={14} aria-hidden="true" className="shrink-0" />
      Avise o responsável pela conta
    </p>
  );
}

export default function ParaVoltar({ planoEFaturas }: { planoEFaturas: PlanoEFaturas }) {
  const { resumo } = useCobranca();
  const cartaoId = useId();
  const depoisId = useId();
  const dominioId = useId();

  if (!resumo) return null;

  if (resumo.situacao === 'em_dia') {
    return (
      <Caixa>
        <p className="text-gray-800">Sua conta está ativa. Não há nada para reativar.</p>
        <a href="/produtos" className={`${LINK_SECUNDARIO} mt-4`}>
          Ir para Meus Produtos
        </a>
      </Caixa>
    );
  }

  if (resumo.situacao !== 'fora_do_ar') return <NaoPodeReativar />;

  const { plano } = planoEFaturas;
  const anual = plano.ciclo === 'anual';
  const valor = resumo.reativacao?.valor ?? plano.valor;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-gray-800">
        Sua página está fora do ar por falta de pagamento. A conta será cancelada em{' '}
        {resumo.cancelamento_em ? formatarData(resumo.cancelamento_em) : ''}.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <section aria-labelledby={cartaoId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 id={cartaoId} className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Para voltar
          </h2>
          <p className="text-3xl font-black text-gray-900 mt-2">{formatarReais(valor)}</p>
          <p className="text-sm text-gray-700 mt-2">
            {anual ? `Uma anuidade do plano ${plano.nome}.` : `Uma mensalidade do plano ${plano.nome}.`}
          </p>
          <p className="text-sm text-gray-700">A fatura antiga não é cobrada.</p>
          {!resumo.pode_gerir && (
            <div className="mt-4">
              <AviseOResponsavel />
            </div>
          )}
        </section>

        <section aria-labelledby={depoisId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 id={depoisId} className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Depois de pagar
          </h2>
          <ul className="mt-3 list-disc pl-5 space-y-2 text-sm text-gray-800">
            <li>Sua página volta ao ar.</li>
            <li>{ferramentasCitadas(resumo.ferramentas_bloqueadas)} voltam a funcionar.</li>
            <li>
              Um novo ciclo começa no dia do pagamento. A próxima fatura vence em {anual ? 'um ano' : 'um mês'}.
            </li>
          </ul>
        </section>
      </div>

      <section
        aria-labelledby={dominioId}
        className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex items-start gap-3"
      >
        <AlertTriangle size={20} aria-hidden="true" className="shrink-0 mt-0.5" />
        <div>
          <h2 id={dominioId} className="font-bold text-sm">
            Domínio próprio
          </h2>
          <p className="text-sm mt-1">
            Se você usava um domínio próprio, ele foi desligado quando a página saiu do ar. Depois de reativar, ligue
            de novo em Páginas › Domínio próprio.
          </p>
        </div>
      </section>
    </div>
  );
}
