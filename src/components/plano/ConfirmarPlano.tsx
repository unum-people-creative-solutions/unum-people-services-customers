'use client';

// cobranca-e-plano-do-cliente RF5-03 (BP-T §11.5): confirmação da troca de plano. Nada
// muda na tela antes do 204; todo erro aparece dentro do diálogo.
import { useId, useRef, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';
import Modal from '@/components/Modal';
import { formatarDataCompleta, formatarReais } from '@/lib/cobrancaTexto';
import { diferencasDoPlano, textoDoIndisponivel } from '@/lib/planosTexto';
import { ehRecusaPorPermissao, MENSAGEM_SEM_PERMISSAO, TermsService } from '@/services/api';
import { PlanosService } from '@/services/planos';
import type { PlanoDoCliente } from '@/types/cobranca';
import type { ErroDaTroca, PlanoParaTroca } from '@/types/planos';

const TEXTO_GENERICO = 'Não foi possível trocar o plano agora. Nada foi alterado. Tente de novo em alguns minutos.';

function textoDoErro(erro: ErroDaTroca, novo: PlanoParaTroca): string {
  switch (erro) {
    case 'conta_nao_ativa':
      return 'Pague a fatura em atraso para mudar de plano.';
    case 'contrato_anual':
      return 'Seu contrato é anual. Para mudar de plano, escreva para atendimento@unumpeople.com.br e a gente faz a troca para você.';
    case 'dominio_ligado':
    case 'paginas_acima_do_limite':
    case 'usuarios_acima_do_limite':
      return textoDoIndisponivel(erro, novo);
    case 'so_upgrade':
      return 'Este plano é menor que o seu. Escreva para atendimento@unumpeople.com.br para pedir a troca.';
    case 'cancellation_requested':
      // DV-35: sem texto próprio, o genérico.
      return TEXTO_GENERICO;
  }
}

const PARA_O_TERMO = '/termos?return_to=/plano';

// Termo de contratação pendente → /termos (com a linha do plano novo); sem ele, /plano.
// Erro ao ler os termos → /termos, onde a pessoa vê o estado real. Em todos, o "Pronto!".
async function destinoDepoisDaTroca(tenantId: string, nome: string): Promise<string> {
  sessionStorage.setItem(`plano-trocado:${tenantId}`, nome);
  try {
    const status = await TermsService.getStatus(tenantId);
    if (!status.pending.some((termo) => termo.type === 'contratacao_servico')) return '/plano';
  } catch (err) {
    console.error('Erro ao conferir os termos depois da troca de plano:', err);
  }
  sessionStorage.setItem(`plano-novo:${tenantId}`, nome);
  return PARA_O_TERMO;
}

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

const BOTAO_PRIMARIO =
  'min-h-[44px] inline-flex items-center justify-center bg-brand-blue text-white rounded-xl font-bold text-sm py-2.5 px-4 hover:brightness-110 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

const BOTAO_SECUNDARIO =
  'min-h-[44px] inline-flex items-center justify-center border border-gray-300 bg-white rounded-lg text-sm font-bold text-gray-700 px-4 py-2 hover:bg-gray-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-60 disabled:cursor-not-allowed';

export default function ConfirmarPlano({
  tenantId,
  atual,
  novo,
  planoDoCliente,
  aoFechar,
}: {
  tenantId: string;
  atual: PlanoParaTroca;
  novo: PlanoParaTroca;
  planoDoCliente: PlanoDoCliente;
  aoFechar: () => void;
}) {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const enviandoRef = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const oQueMudaId = useId();
  const diferencas = diferencasDoPlano(atual, novo);
  const valor = `${formatarReais(novo.valor)} por mês`;
  const quantoEQuando = planoDoCliente.proximo_vencimento
    ? `${valor} a partir do vencimento de ${formatarDataCompleta(planoDoCliente.proximo_vencimento)}. Até lá, nada muda na sua fatura.`
    : `${valor} a partir da próxima fatura.`;

  async function confirmar() {
    // Uma troca por vez: o segundo clique, antes de o botão desabilitar, não chama de novo.
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    const falhar = (texto: string) => {
      setErro(texto);
      enviandoRef.current = false;
      setEnviando(false);
    };
    try {
      const resultado = await PlanosService.mudar(tenantId, novo.slug);
      if (!resultado.ok) {
        falhar(textoDoErro(resultado.erro, novo));
        return;
      }
    } catch (err) {
      console.error('Erro ao trocar o plano:', err);
      falhar(ehRecusaPorPermissao(err) ? MENSAGEM_SEM_PERMISSAO : TEXTO_GENERICO);
      return;
    }
    // Trocado (D-2, DV-36): o termo do plano novo pode ter ficado pendente. Só o nome do
    // plano vai para o sessionStorage; o diálogo continua travado até a navegação.
    window.location.href = await destinoDepoisDaTroca(tenantId, novo.nome);
  }

  return (
    <Modal
      aberto
      titulo={`Mudar para o plano ${novo.nome}?`}
      onFechar={aoFechar}
      fecharBloqueado={enviando}
      focoInicialRef={cancelarRef}
      rodape={
        <>
          <button ref={cancelarRef} type="button" onClick={aoFechar} disabled={enviando} className={BOTAO_SECUNDARIO}>
            Cancelar
          </button>
          <button type="button" onClick={() => void confirmar()} disabled={enviando} className={BOTAO_PRIMARIO}>
            {enviando ? 'Trocando o plano…' : 'Confirmar a troca'}
          </button>
        </>
      }
    >
      {diferencas.length > 0 && (
        <>
          <h3 id={oQueMudaId} className="text-sm font-bold text-gray-900">
            O que muda agora
          </h3>
          <ul aria-labelledby={oQueMudaId} className="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-700">
            {diferencas.map((diferenca) => (
              <li key={diferenca}>{maiuscula(diferenca)}</li>
            ))}
          </ul>
        </>
      )}

      <h3 className="text-sm font-bold text-gray-900 mt-5">Quanto e quando</h3>
      <p className="mt-2 text-sm text-gray-700">{quantoEQuando}</p>

      {planoDoCliente.forma_de_pagamento === 'CREDIT_CARD' && (
        <div className="mt-5 p-3 bg-blue-50 rounded-lg flex gap-2 items-start text-sm text-gray-800">
          <Info size={18} aria-hidden="true" className="text-brand-blue shrink-0 mt-0.5" />
          <p>Você paga no cartão. A próxima fatura chega como link, e você informa o cartão de novo para pagar.</p>
        </div>
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
