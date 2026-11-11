'use client';

// cobranca-e-plano-do-cliente RF6-02 (BP-T §12.2): caixa "Trocar forma de pagamento". Nada
// muda na tela antes do 204; todo erro aparece dentro do diálogo. RF6-03: a frase da fatura
// em atraso só existe no resultado A da D-4 (hoje vale o B, ver RESULTADO_D4).
import { useId, useRef, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import Modal from '@/components/Modal';
import { formatarData, formatarReais } from '@/lib/cobrancaTexto';
import { ehRecusaPorPermissao, MENSAGEM_SEM_PERMISSAO } from '@/services/api';
import { FormaDePagamentoService } from '@/services/formaDePagamento';
import type { FaturaDoCliente } from '@/types/cobranca';
import type { FormaDePagamento } from '@/types/planos';

type Opcao = {
  forma: FormaDePagamento;
  rotulo: string;
  descricao: string;
  // Dentro da frase ("também passa para boleto") e no botão ("Trocar para Boleto"),
  // como no BP-T §12.2 e no T94.
  naFrase: string;
  noBotao: string;
};

const OPCOES: Opcao[] = [
  {
    forma: 'PIX',
    rotulo: 'Pix',
    descricao: 'Confirma na hora. A fatura chega por e-mail 5 dias antes do vencimento.',
    naFrase: 'Pix',
    noBotao: 'Pix',
  },
  {
    forma: 'BOLETO',
    rotulo: 'Boleto',
    descricao: 'Leva até 3 dias úteis para confirmar depois do pagamento.',
    naFrase: 'boleto',
    noBotao: 'Boleto',
  },
  {
    forma: 'CREDIT_CARD',
    rotulo: 'Cartão de crédito',
    descricao: 'Cobrado no cartão no vencimento.',
    naFrase: 'cartão',
    noBotao: 'cartão',
  },
];

const TEXTO_GENERICO = 'Não foi possível trocar agora. Nada foi alterado. Tente de novo em alguns minutos.';
const MESMA_FORMA = 'Escolha uma forma diferente da atual.';

const BOTAO_PRIMARIO =
  'min-h-[44px] inline-flex items-center justify-center bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

const BOTAO_SECUNDARIO =
  'min-h-[44px] inline-flex items-center justify-center border border-gray-300 bg-white rounded-lg text-sm font-bold text-gray-700 px-4 py-2 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-60 disabled:cursor-not-allowed';

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onTrocou: (forma: FormaDePagamento) => void;
  tenantId: string;
  // forma_de_pagamento do contrato como veio (pode ser UNDEFINED ou vazio).
  formaAtual: string;
  // SPEC_DEVIATION: a lista de props da FE-P602 não traz proximo_vencimento, mas o BP-T
  // §12.2 pede "Vale a partir da próxima fatura, que vence em DD/MM." (`proximo_vencimento`).
  // Reason: sem a data a frase não existe; o valor vem de GET /me/faturas, como o resto.
  proximoVencimento?: string;
  faturaAVencer?: FaturaDoCliente;
  faturaVencida?: FaturaDoCliente;
  resultadoD4: 'A' | 'B';
};

export default function TrocarFormaDePagamento(props: Props) {
  // Cada abertura começa de novo: a escolha volta à forma atual e o erro some.
  if (!props.aberto) return null;
  return <Caixa {...props} />;
}

function Caixa({
  onFechar,
  onTrocou,
  tenantId,
  formaAtual,
  proximoVencimento,
  faturaAVencer,
  faturaVencida,
  resultadoD4,
}: Props) {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const enviandoRef = useRef(false);
  const atual = OPCOES.find((o) => o.forma === formaAtual) ?? null;
  const [escolha, setEscolha] = useState<FormaDePagamento | null>(atual?.forma ?? null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const nome = useId();
  const motivoId = useId();
  const escolhida = OPCOES.find((o) => o.forma === escolha) ?? null;
  const mudou = escolhida !== null && escolhida.forma !== atual?.forma;

  let proximaFatura: string | null = null;
  if (mudou && faturaAVencer) {
    proximaFatura = `A fatura de ${formatarReais(faturaAVencer.valor)} que vence em ${formatarData(faturaAVencer.vencimento)}, já gerada, também passa para ${escolhida.naFrase}.`;
  } else if (mudou && proximoVencimento) {
    proximaFatura = `Vale a partir da próxima fatura, que vence em ${formatarData(proximoVencimento)}.`;
  }

  async function trocar() {
    if (!escolhida || !mudou) return;
    // Uma troca por vez: o segundo clique, antes de o botão desabilitar, não chama de novo.
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    try {
      await FormaDePagamentoService.trocar(tenantId, escolhida.forma);
    } catch (err) {
      console.error('Erro ao trocar a forma de pagamento:', err);
      setErro(ehRecusaPorPermissao(err) ? MENSAGEM_SEM_PERMISSAO : TEXTO_GENERICO);
      enviandoRef.current = false;
      setEnviando(false);
      return;
    }
    onTrocou(escolhida.forma);
  }

  return (
    <Modal
      aberto
      titulo="Trocar forma de pagamento"
      onFechar={onFechar}
      fecharBloqueado={enviando}
      focoInicialRef={cancelarRef}
      rodape={
        <>
          {!mudou && (
            <p id={motivoId} className="w-full sm:w-auto sm:mr-auto self-center text-sm text-gray-600">
              {MESMA_FORMA}
            </p>
          )}
          <button ref={cancelarRef} type="button" onClick={onFechar} disabled={enviando} className={BOTAO_SECUNDARIO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void trocar()}
            disabled={enviando || !mudou}
            aria-describedby={!mudou ? motivoId : undefined}
            className={BOTAO_PRIMARIO}
          >
            {enviando
              ? 'Trocando…'
              : escolhida
                ? `Trocar para ${escolhida.noBotao}`
                : 'Trocar forma de pagamento'}
          </button>
        </>
      }
    >
      <fieldset disabled={enviando}>
        <legend className="text-sm font-bold text-gray-900">Como você quer pagar?</legend>
        <div className="mt-3 space-y-3">
          {OPCOES.map((opcao) => {
            const id = `${nome}-${opcao.forma}`;
            return (
              <div key={opcao.forma} className="flex gap-3 items-start">
                <input
                  id={id}
                  type="radio"
                  name={nome}
                  value={opcao.forma}
                  checked={escolha === opcao.forma}
                  onChange={() => setEscolha(opcao.forma)}
                  aria-describedby={`${id}-descricao`}
                  className="mt-1 h-5 w-5 shrink-0 accent-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
                />
                <div>
                  <label htmlFor={id} className="text-sm font-semibold text-gray-900">
                    {opcao.rotulo}
                    {opcao.forma === atual?.forma && ' (atual)'}
                  </label>
                  <p id={`${id}-descricao`} className="text-sm text-gray-600">
                    {opcao.descricao}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {proximaFatura && <p className="mt-5 text-sm text-gray-800">{proximaFatura}</p>}

      {mudou && resultadoD4 === 'A' && faturaVencida && (
        <p className="mt-2 text-sm text-gray-800">{`A fatura em atraso também passa para ${escolhida.naFrase}.`}</p>
      )}

      {escolha === 'CREDIT_CARD' && (
        <div className="mt-5 p-3 bg-blue-50 rounded-lg flex gap-2 items-start text-sm text-gray-800">
          <Info size={18} aria-hidden="true" className="text-brand-blue shrink-0 mt-0.5" />
          <p>Na próxima fatura, o Asaas pede os dados do cartão na página da fatura. Você recebe o link por e-mail.</p>
        </div>
      )}

      {atual?.forma === 'CREDIT_CARD' && mudou && (
        <p className="mt-5 text-sm text-gray-800">
          Você volta a receber o lembrete 5 dias antes e no dia do vencimento.
        </p>
      )}

      {erro && (
        <div role="alert" className="mt-5 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-2 items-start">
          <AlertCircle size={18} aria-hidden="true" className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{erro}</p>
        </div>
      )}
    </Modal>
  );
}
