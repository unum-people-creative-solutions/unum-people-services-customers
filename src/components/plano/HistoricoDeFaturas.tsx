'use client';

// cobranca-e-plano-do-cliente RF3-02 (BP-T §9.4): histórico de faturas, tabela na tela
// larga e cartões no celular (useTelaLarga). Os links só existem quando a API mandou.
import { useId } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTelaLarga } from '@/hooks/useTelaLarga';
import { formatarDataCompleta, formatarReais } from '@/lib/cobrancaTexto';
import type { FaturaDoCliente } from '@/types/cobranca';
import { ChipDaSituacao } from './FaturaEmAberto';

const classeCabecalho = 'px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-500';

const classeDoLink =
  'min-h-[44px] md:min-h-0 inline-flex items-center gap-1.5 text-sm font-bold text-brand-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded';

function LinksDaFatura({ fatura }: { fatura: FaturaDoCliente }) {
  const data = formatarDataCompleta(fatura.vencimento);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {fatura.link && (
        <a
          href={fatura.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver fatura de ${data} (abre em nova aba)`}
          className={classeDoLink}
        >
          Ver fatura
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      {fatura.nota_fiscal_url && (
        <a
          href={fatura.nota_fiscal_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Nota fiscal de ${data} (abre em nova aba)`}
          className={classeDoLink}
        >
          Nota fiscal
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function pagaEm(fatura: FaturaDoCliente): string {
  return fatura.pago_em ? formatarDataCompleta(fatura.pago_em) : '—';
}

export default function HistoricoDeFaturas({
  faturas,
  podeGerir,
  nomeDaEmpresa,
}: {
  faturas: FaturaDoCliente[];
  podeGerir: boolean;
  nomeDaEmpresa: string;
}) {
  const tituloId = useId();
  const telaLarga = useTelaLarga();
  const rotulo = `Faturas da ${nomeDaEmpresa}`;

  let conteudo: React.ReactNode;
  if (faturas.length === 0) {
    conteudo = (
      <p className="text-sm text-gray-600">Nenhuma fatura ainda. A primeira aparece aqui quando for gerada.</p>
    );
  } else if (telaLarga) {
    conteudo = (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">{rotulo}</caption>
          <thead>
            <tr>
              <th scope="col" className={classeCabecalho}>Vencimento</th>
              <th scope="col" className={classeCabecalho}>Valor</th>
              <th scope="col" className={classeCabecalho}>Situação</th>
              <th scope="col" className={classeCabecalho}>Paga em</th>
              {podeGerir && <th scope="col" className={classeCabecalho}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {faturas.map((fatura) => (
              <tr key={fatura.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900">{formatarDataCompleta(fatura.vencimento)}</td>
                <td className="px-4 py-3 text-gray-900">{formatarReais(fatura.valor)}</td>
                <td className="px-4 py-3">
                  <ChipDaSituacao situacao={fatura.situacao} />
                </td>
                <td className="px-4 py-3 text-gray-700">{pagaEm(fatura)}</td>
                {podeGerir && (
                  <td className="px-4 py-3">
                    <LinksDaFatura fatura={fatura} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    conteudo = (
      <ul aria-label={rotulo} className="flex flex-col gap-3">
        {faturas.map((fatura) => (
          <li key={fatura.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-gray-900">{formatarDataCompleta(fatura.vencimento)}</span>
              <ChipDaSituacao situacao={fatura.situacao} />
            </div>
            <div className="flex items-center justify-between gap-3 mt-1 text-sm text-gray-700">
              <span>{formatarReais(fatura.valor)}</span>
              <span>Paga em {pagaEm(fatura)}</span>
            </div>
            {podeGerir && (fatura.link || fatura.nota_fiscal_url) && (
              <div className="mt-2">
                <LinksDaFatura fatura={fatura} />
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby={tituloId}>
      <h3 id={tituloId} className="text-xl font-black text-gray-900 mb-4">
        Histórico de faturas
      </h3>
      {conteudo}
      {faturas.length > 0 && !podeGerir && (
        <p className="text-sm text-gray-600 mt-3">
          Os links das faturas e das notas fiscais aparecem só para quem gere o contrato.
        </p>
      )}
    </section>
  );
}
