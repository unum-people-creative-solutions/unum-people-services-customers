'use client';

// gestao-de-acesso-f3-portal-cliente RF-18: convidar e editar uma pessoa da empresa.
import { useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import Modal from '@/components/Modal';
import AcessosPorFerramenta from '@/components/usuarios/AcessosPorFerramenta';
import {
  UsuariosService,
  erroDaApi,
  type MudancaDeUsuario,
  type PapeisDaEmpresa,
  type UsuarioDaEmpresa,
} from '@/services/usuarios';

const TEXTO_PROPRIO = 'Você não pode mudar o seu próprio acesso ao Portal nem se bloquear.';

const classePrimario =
  'bg-brand-blue text-white rounded-xl font-bold py-2.5 px-4 text-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

const classeSecundario =
  'rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

type UsuarioDialogProps = {
  modo: 'convidar' | 'editar';
  usuario?: UsuarioDaEmpresa;
  ehVoce?: boolean;
  papeis: PapeisDaEmpresa;
  tenantId: string;
  maximo: number | null;
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
};

function acessosDeConvite(papeis: PapeisDaEmpresa): Record<string, string> {
  const acessos: Record<string, string> = { portal: 'membro' };
  for (const ferramenta of papeis.ferramentas) {
    if (ferramenta.id !== 'portal' && ferramenta.contratada) {
      acessos[ferramenta.id] = '';
    }
  }
  return acessos;
}

function acessosDeEdicao(usuario: UsuarioDaEmpresa, papeis: PapeisDaEmpresa): Record<string, string> {
  const acessos: Record<string, string> = {};
  for (const ferramenta of papeis.ferramentas) {
    if (ferramenta.id !== 'portal' && !ferramenta.contratada) continue;
    const atual = usuario.acessos[ferramenta.id];
    if (ferramenta.id === 'portal') {
      acessos.portal = atual?.papel ?? 'membro';
    } else {
      acessos[ferramenta.id] = !atual || atual.implicito ? '' : atual.papel;
    }
  }
  return acessos;
}

function mensagemDoErro(codigo: string | undefined, maximo: number | null): string {
  switch (codigo) {
    case 'ja_vinculado':
      return 'Essa pessoa já tem acesso a esta empresa. Para mudar o que ela pode fazer, use Editar.';
    case 'limite_de_usuarios':
      return maximo
        ? `Seu plano permite ${maximo} usuários. Remova alguém para convidar outra pessoa.`
        : 'Seu plano chegou ao limite de usuários. Remova alguém para convidar outra pessoa.';
    case 'papel_invalido':
      return 'Uma das escolhas não vale mais. Recarregue a página e tente de novo.';
    case 'ultimo_administrador':
      return 'A empresa precisa de pelo menos um Administrador do Portal ativo. Promova outra pessoa antes.';
    case 'proprio_usuario':
      return TEXTO_PROPRIO;
    default:
      return 'Não foi possível salvar. Tente de novo.';
  }
}

export default function UsuarioDialog({
  modo,
  usuario,
  ehVoce = false,
  papeis,
  tenantId,
  maximo,
  onFechar,
  onSalvo,
}: UsuarioDialogProps) {
  const idNome = useId();
  const idEmail = useId();
  const idMotivo = useId();
  const nomeRef = useRef<HTMLInputElement>(null);
  const idProprio = useId();
  const iniciais = modo === 'editar' && usuario ? acessosDeEdicao(usuario, papeis) : acessosDeConvite(papeis);
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState('');
  const [bloqueado, setBloqueado] = useState(usuario?.status === 'bloqueado');
  const [acessos, setAcessos] = useState(iniciais);
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);

  const nomeTrim = nome.trim();
  const emailTrim = email.trim();
  const statusAtual: 'ativo' | 'bloqueado' = bloqueado ? 'bloqueado' : 'ativo';

  const deltaAcessos: Record<string, string> = {};
  if (modo === 'editar') {
    for (const [id, valor] of Object.entries(acessos)) {
      if (valor !== iniciais[id]) deltaAcessos[id] = valor;
    }
  }
  const nomeMudou = modo === 'editar' && nomeTrim !== (usuario?.nome ?? '');
  const statusMudou = modo === 'editar' && usuario !== undefined && statusAtual !== usuario.status;
  const acessosMudaram = Object.keys(deltaAcessos).length > 0;

  let motivo: string | null = null;
  if (nomeTrim === '') {
    motivo = 'Preencha o nome.';
  } else if (modo === 'convidar' && emailTrim === '') {
    motivo = 'Preencha o e-mail.';
  } else if (modo === 'convidar' && !/^[^\s@]+@[^\s@]+$/.test(emailTrim)) {
    motivo = 'E-mail inválido.';
  } else if (modo === 'editar' && !nomeMudou && !statusMudou && !acessosMudaram) {
    motivo = 'Nada para salvar.';
  }

  function enviar() {
    if (motivo || enviando) return;
    setEnviando(true);
    setAlerta(null);
    void (async () => {
      try {
        if (modo === 'convidar') {
          const escolhidos: Record<string, string> = { portal: acessos.portal };
          for (const [id, valor] of Object.entries(acessos)) {
            if (id !== 'portal' && valor !== '') escolhidos[id] = valor;
          }
          await UsuariosService.convidar({ email: emailTrim, nome: nomeTrim, acessos: escolhidos }, tenantId);
          onSalvo(`Convite enviado para ${emailTrim}.`);
        } else if (usuario) {
          const mudanca: MudancaDeUsuario = {};
          if (nomeMudou) mudanca.nome = nomeTrim;
          if (statusMudou) mudanca.status = statusAtual;
          if (acessosMudaram) mudanca.acessos = deltaAcessos;
          await UsuariosService.atualizar(usuario.email, mudanca, tenantId);
          onSalvo('Alterações salvas.');
        }
      } catch (err: unknown) {
        setAlerta(mensagemDoErro(erroDaApi(err).codigo, maximo));
      } finally {
        setEnviando(false);
      }
    })();
  }

  const titulo = modo === 'convidar' ? 'Convidar pessoa' : usuario?.nome || usuario?.email || '';

  return (
    <Modal
      aberto
      titulo={titulo}
      onFechar={onFechar}
      fecharBloqueado={enviando}
      focoInicialRef={nomeRef}
      rodape={
        <>
          {motivo ? (
            <span id={idMotivo} className="text-xs text-gray-500">
              {motivo}
            </span>
          ) : null}
          <button type="button" onClick={onFechar} disabled={enviando} className={classeSecundario}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || motivo !== null}
            aria-describedby={motivo ? idMotivo : undefined}
            className={classePrimario}
          >
            {enviando
              ? modo === 'convidar'
                ? 'Enviando…'
                : 'Salvando…'
              : modo === 'convidar'
                ? 'Enviar convite'
                : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {ehVoce ? (
          <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span id={idProprio}>{TEXTO_PROPRIO}</span>
          </p>
        ) : null}

        {alerta ? (
          <div role="alert" className="bg-red-50 border-l-4 border-red-500 text-sm text-red-700 p-3 rounded-r-lg">
            {alerta}
          </div>
        ) : null}

        <div className="space-y-1">
          <label htmlFor={idNome} className="block text-sm font-semibold text-gray-800">
            Nome
          </label>
          <input
            ref={nomeRef}
            id={idNome}
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
          />
        </div>

        {modo === 'convidar' ? (
          <div className="space-y-1">
            <label htmlFor={idEmail} className="block text-sm font-semibold text-gray-800">
              E-mail
            </label>
            <input
              id={idEmail}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
            />
          </div>
        ) : (
          <p className="text-sm text-gray-600">{usuario?.email}</p>
        )}

        {modo === 'convidar' ? (
          <p className="flex items-start gap-2 text-sm text-gray-600">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>A pessoa recebe um e-mail com uma senha temporária para entrar.</span>
          </p>
        ) : (
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={bloqueado}
                disabled={ehVoce}
                aria-describedby={ehVoce ? idProprio : undefined}
                onChange={(event) => setBloqueado(event.target.checked)}
              />
              Bloquear o acesso a esta empresa
            </label>
            <p className="text-sm text-gray-600">A pessoa continua na lista, mas não entra até você desbloquear.</p>
          </div>
        )}

        <AcessosPorFerramenta
          papeis={papeis}
          valor={acessos}
          onChange={setAcessos}
          portalBloqueado={ehVoce}
          idDoMotivoPortal={ehVoce ? idProprio : undefined}
        />
      </div>
    </Modal>
  );
}
