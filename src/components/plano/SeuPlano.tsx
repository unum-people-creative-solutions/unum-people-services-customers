'use client';

// cobranca-e-plano-do-cliente RF3-02 (BP-T §9.2): o plano do contrato. Sem botões nesta
// fase: "Mudar de plano" chega na fase 5 e "Trocar forma de pagamento" na fase 6.
import { useId } from 'react';
import { CheckCircle } from 'lucide-react';
import { formatarDataCompleta, nomeDaForma, valorDoPlano } from '@/lib/cobrancaTexto';
import type { PlanoDoCliente } from '@/types/cobranca';

export default function SeuPlano({ plano }: { plano: PlanoDoCliente }) {
  const tituloId = useId();
  return (
    <section aria-labelledby={tituloId} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 id={tituloId} className="text-xl font-black text-gray-900">
        Seu plano
      </h3>
      <p className="text-lg font-bold text-gray-900 mt-3">{plano.nome}</p>
      <p className="text-sm text-gray-700 mt-1">{valorDoPlano(plano.valor, plano.ciclo)}</p>
      {plano.proximo_vencimento && (
        <p className="text-sm text-gray-700 mt-1">
          Próximo vencimento: {formatarDataCompleta(plano.proximo_vencimento)}
        </p>
      )}
      <p className="text-sm text-gray-700 mt-1">Forma de pagamento: {nomeDaForma(plano.forma_de_pagamento)}</p>
      {plano.destaques.length > 0 && (
        <ul aria-label="O que inclui" className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {plano.destaques.map((destaque) => (
            <li key={destaque} className="flex items-center gap-1.5 text-sm text-gray-700">
              <CheckCircle size={16} aria-hidden="true" className="text-green-600 shrink-0" />
              {destaque}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
