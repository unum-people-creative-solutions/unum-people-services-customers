'use client';

// gestao-de-acesso-f3-portal-cliente RF-19: confirmar a remoção de uma pessoa da empresa.
import { useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { UsuariosService, erroDaApi, type UsuarioDaEmpresa } from '@/services/usuarios';

const classeSecundario =
  'rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

const classeRemover =
  'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

type RemoverUsuarioDialogProps = {
  usuario: UsuarioDaEmpresa;
  nomeDaEmpresa: string;
  tenantId: string;
  onFechar: () => void;
  onRemovido: (mensagem: string) => void;
};

function mensagemDoErro(codigo: string | undefined): string {
  switch (codigo) {
    case 'ultimo_administrador':
      return 'A empresa precisa de pelo menos um Administrador do Portal ativo. Promova outra pessoa antes.';
    case 'usuario_fora_da_empresa':
      return 'Essa pessoa já não está nesta empresa. Feche e a lista será atualizada.';
    case 'proprio_usuario':
      return 'Você não pode remover a si mesmo.';
    default:
      return 'Não foi possível remover. Tente de novo.';
  }
}

export default function RemoverUsuarioDialog({
  usuario,
  nomeDaEmpresa,
  tenantId,
  onFechar,
  onRemovido,
}: RemoverUsuarioDialogProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const [removendo, setRemovendo] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const quem = usuario.nome || usuario.email;

  function remover() {
    if (removendo) return;
    setRemovendo(true);
    setAlerta(null);
    void (async () => {
      try {
        await UsuariosService.remover(usuario.email, tenantId);
        onRemovido(`${quem} não tem mais acesso a ${nomeDaEmpresa}.`);
      } catch (err: unknown) {
        setAlerta(mensagemDoErro(erroDaApi(err).codigo));
      } finally {
        setRemovendo(false);
      }
    })();
  }

  return (
    <Modal
      aberto
      titulo={`Remover ${quem}?`}
      descricao={`A pessoa deixa de acessar ${nomeDaEmpresa}. Se não tiver acesso a outra empresa, a conta dela é apagada.`}
      onFechar={onFechar}
      fecharBloqueado={removendo}
      focoInicialRef={cancelarRef}
      rodape={
        <>
          <button ref={cancelarRef} type="button" onClick={onFechar} disabled={removendo} className={classeSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={remover} disabled={removendo} className={classeRemover}>
            {removendo ? 'Removendo…' : 'Remover'}
          </button>
        </>
      }
    >
      {alerta ? (
        <div role="alert" className="bg-red-50 border-l-4 border-red-500 text-sm text-red-700 p-3 rounded-r-lg">
          {alerta}
        </div>
      ) : null}
    </Modal>
  );
}
