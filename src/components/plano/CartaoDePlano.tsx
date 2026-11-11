'use client';

// cobranca-e-plano-do-cliente RF5-03 (BP-T §11.2, §11.3): um plano na comparação de
// /plano/mudar. Linhas fixas, na mesma ordem em todos os cartões, sempre em texto.
import { useId, useState, type ReactNode } from 'react';
import { valorDoPlano } from '@/lib/cobrancaTexto';
import type { CicloDoPlano } from '@/types/cobranca';
import type { PlanoParaTroca } from '@/types/planos';

type Linha = { rotulo: string; valor: string; marca: string | null };

const simNao = (sim: boolean) => (sim ? 'Sim' : 'Não');

// "Novo" para o que era "Não"; "(+N)" para números (BP-T §11.2).
function linhasDoPlano(plano: PlanoParaTroca, atual: PlanoParaTroca): Linha[] {
  const novo = (tem: boolean, tinha: boolean) => (tem && !tinha ? 'Novo' : null);
  const mais = (n: number, antes: number) => (n > antes ? `(+${n - antes})` : null);
  const marcaDosUsuarios = (): string | null => {
    if (plano.usuarios === null) return atual.usuarios === null ? null : 'Novo';
    return atual.usuarios === null ? null : mais(plano.usuarios, atual.usuarios);
  };
  return [
    { rotulo: 'Páginas', valor: String(plano.paginas), marca: mais(plano.paginas, atual.paginas) },
    {
      rotulo: 'Domínio próprio',
      valor: simNao(!plano.sem_dominio_proprio),
      marca: novo(!plano.sem_dominio_proprio, !atual.sem_dominio_proprio),
    },
    {
      rotulo: 'Sem a assinatura “Feito com Unum People”',
      valor: simNao(plano.sem_marca),
      marca: novo(plano.sem_marca, atual.sem_marca),
    },
    {
      rotulo: 'Blog',
      valor: simNao(plano.servicos.includes('blog')),
      marca: novo(plano.servicos.includes('blog'), atual.servicos.includes('blog')),
    },
    {
      rotulo: 'CRM',
      valor: simNao(plano.servicos.includes('crm')),
      marca: novo(plano.servicos.includes('crm'), atual.servicos.includes('crm')),
    },
    {
      rotulo: 'Usuários',
      valor: plano.usuarios === null ? 'Sem limite' : String(plano.usuarios),
      marca: marcaDosUsuarios(),
    },
  ];
}

function ItemDaLinha({ linha }: { linha: Linha }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm text-gray-700">
      <span>{`${linha.rotulo}: ${linha.valor}`}</span>
      {linha.marca && <span className="shrink-0 text-brand-blue font-semibold">{linha.marca}</span>}
    </li>
  );
}

export type BotaoDoCartao = {
  // Motivo escrito acima do botão desabilitado (BP-T §11.3, §11.4); null = pode escolher.
  desabilitadoPor: ReactNode | null;
  aoEscolher: () => void;
};

const BOTAO_PRIMARIO =
  'w-full min-h-[44px] inline-flex items-center justify-center bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:brightness-100';

export default function CartaoDePlano({
  plano,
  atual,
  ciclo,
  telaLarga,
  botao,
}: {
  plano: PlanoParaTroca;
  atual: PlanoParaTroca;
  ciclo: CicloDoPlano;
  telaLarga: boolean;
  botao: BotaoDoCartao | null;
}) {
  const tituloId = useId();
  const motivoId = useId();
  const restoId = useId();
  const [verTudo, setVerTudo] = useState(false);
  const ehAtual = plano.direcao === 'atual';
  const linhas = linhasDoPlano(plano, atual);
  // No celular, o cartão de upgrade mostra só o que muda; "Ver tudo" abre o resto.
  const resumido = !telaLarga && !ehAtual;
  const visiveis = resumido ? linhas.filter((l) => l.marca) : linhas;
  const escondidas = resumido ? linhas.filter((l) => !l.marca) : [];

  return (
    <section
      aria-labelledby={tituloId}
      className={`bg-white rounded-2xl border shadow-sm p-6 flex flex-col ${ehAtual ? 'border-2 border-brand-blue' : 'border-gray-200'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={tituloId} className="text-lg font-bold text-gray-900">
          {plano.nome}
        </h2>
        {ehAtual && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-brand-blue">Seu plano</span>
        )}
      </div>
      <p className="text-sm text-gray-700 mt-1">{valorDoPlano(plano.valor, ehAtual ? ciclo : 'mensal')}</p>

      <ul className="mt-4 space-y-2">
        {visiveis.map((linha) => (
          <ItemDaLinha key={linha.rotulo} linha={linha} />
        ))}
      </ul>
      {escondidas.length > 0 && (
        <>
          {verTudo && (
            <ul id={restoId} className="mt-2 space-y-2">
              {escondidas.map((linha) => (
                <ItemDaLinha key={linha.rotulo} linha={linha} />
              ))}
            </ul>
          )}
          <button
            type="button"
            aria-expanded={verTudo}
            aria-controls={restoId}
            onClick={() => setVerTudo((v) => !v)}
            className="mt-2 self-start min-h-[44px] text-sm font-semibold text-brand-blue underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            Ver tudo
          </button>
        </>
      )}

      {botao && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          {botao.desabilitadoPor && (
            <p id={motivoId} className="text-sm text-gray-700 mb-3">
              {botao.desabilitadoPor}
            </p>
          )}
          <button
            type="button"
            disabled={botao.desabilitadoPor !== null}
            aria-describedby={botao.desabilitadoPor ? motivoId : undefined}
            onClick={botao.aoEscolher}
            className={BOTAO_PRIMARIO}
          >
            {`Escolher o ${plano.nome}`}
          </button>
        </div>
      )}
    </section>
  );
}
