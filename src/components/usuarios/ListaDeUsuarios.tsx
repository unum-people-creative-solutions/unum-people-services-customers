'use client';

import { Lock, Pencil, Trash2 } from 'lucide-react';
import type { PapeisDaEmpresa, UsuarioDaEmpresa } from '@/services/usuarios';
import { useTelaLarga } from '@/hooks/useTelaLarga';

const MOTIVO_UNICO = 'Único administrador ativo. Promova outra pessoa antes de remover.';
const NOTA_ADMIN = '¹ Acesso completo por ser Administrador do Portal.';

type Ferramenta = PapeisDaEmpresa['ferramentas'][number];

type ListaDeUsuariosProps = {
  usuarios: UsuarioDaEmpresa[];
  papeis: PapeisDaEmpresa;
  emailLogado: string;
  nomeDaEmpresa: string;
  onEditar: (usuario: UsuarioDaEmpresa) => void;
  onRemover: (usuario: UsuarioDaEmpresa) => void;
};

function mesmoEmail(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function nomeBase(usuario: UsuarioDaEmpresa): string {
  return usuario.nome || usuario.email;
}

function nomeExibido(usuario: UsuarioDaEmpresa, emailLogado: string): string {
  const base = nomeBase(usuario);
  return mesmoEmail(usuario.email, emailLogado) ? `${base} (você)` : base;
}

function ferramentasExibidas(papeis: PapeisDaEmpresa): Ferramenta[] {
  const portal = papeis.ferramentas.filter((ferramenta) => ferramenta.id === 'portal');
  const contratadas = papeis.ferramentas.filter(
    (ferramenta) => ferramenta.id !== 'portal' && ferramenta.contratada,
  );
  return [...portal, ...contratadas];
}

function papelIdDe(usuario: UsuarioDaEmpresa, ferramentaId: string): string {
  return usuario.acessos[ferramentaId]?.papel ?? 'sem_acesso';
}

function nomeDoPapel(ferramenta: Ferramenta, papelId: string): string {
  return ferramenta.papeis.find((papel) => papel.id === papelId)?.nome ?? papelId;
}

function comMarcaDeAdmin(usuario: UsuarioDaEmpresa, ferramentaId: string): boolean {
  const acesso = usuario.acessos[ferramentaId];
  return Boolean(acesso?.implicito && ferramentaId !== 'portal' && acesso.papel !== 'sem_acesso');
}

function emailDoUnicoAdministrador(usuarios: UsuarioDaEmpresa[]): string | null {
  const ativos = usuarios.filter(
    (usuario) => usuario.status === 'ativo' && usuario.acessos.portal?.papel === 'administrador',
  );
  return ativos.length === 1 ? ativos[0].email : null;
}

function idDoMotivo(email: string): string {
  return `unico-administrador-${email.replace(/[^a-z0-9]+/gi, '-')}`;
}

function Situacao({ status }: { status: UsuarioDaEmpresa['status'] }) {
  if (status === 'ativo') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        Ativo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      <Lock aria-hidden="true" size={14} />
      Bloqueado
    </span>
  );
}

function PapelNaFerramenta({ usuario, ferramenta }: { usuario: UsuarioDaEmpresa; ferramenta: Ferramenta }) {
  const papelId = papelIdDe(usuario, ferramenta.id);
  const nome = nomeDoPapel(ferramenta, papelId);
  if (!comMarcaDeAdmin(usuario, ferramenta.id)) {
    return nome;
  }
  return (
    <>
      {nome}<sup aria-hidden="true">¹</sup><span className="sr-only">acesso completo por ser administrador</span>
    </>
  );
}

function AcoesDaPessoa({
  usuario,
  emailLogado,
  desabilitarRemover,
  comTexto,
  onEditar,
  onRemover,
}: {
  usuario: UsuarioDaEmpresa;
  emailLogado: string;
  desabilitarRemover: boolean;
  comTexto: boolean;
  onEditar: (usuario: UsuarioDaEmpresa) => void;
  onRemover: (usuario: UsuarioDaEmpresa) => void;
}) {
  const nome = nomeBase(usuario);
  const classeBotao =
    'inline-flex items-center gap-1 p-2 rounded-lg hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 ring-brand-blue';
  const idMotivo = idDoMotivo(usuario.email);
  const ehAPessoaLogada = mesmoEmail(usuario.email, emailLogado);

  return (
    <div className="flex items-center gap-1">
      <button type="button" className={classeBotao} aria-label={`Editar ${nome}`} onClick={() => onEditar(usuario)}>
        <Pencil aria-hidden="true" size={16} />
        {comTexto ? 'Editar' : null}
      </button>
      {ehAPessoaLogada ? null : (
        <>
          <button
            type="button"
            className={`${classeBotao} text-red-600 disabled:opacity-50`}
            aria-label={`Remover ${nome}`}
            disabled={desabilitarRemover}
            title={desabilitarRemover ? MOTIVO_UNICO : undefined}
            aria-describedby={desabilitarRemover ? idMotivo : undefined}
            onClick={() => onRemover(usuario)}
          >
            <Trash2 aria-hidden="true" size={16} />
            {comTexto ? 'Remover' : null}
          </button>
          {desabilitarRemover ? <span className="sr-only" id={idMotivo}>{MOTIVO_UNICO}</span> : null}
        </>
      )}
    </div>
  );
}

function NotaDeRodape({ visivel }: { visivel: boolean }) {
  if (!visivel) {
    return null;
  }
  return <p className="text-xs text-gray-500">{NOTA_ADMIN}</p>;
}

const classeCabecalho = 'px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-500';

export default function ListaDeUsuarios({
  usuarios,
  papeis,
  emailLogado,
  nomeDaEmpresa,
  onEditar,
  onRemover,
}: ListaDeUsuariosProps) {
  const telaLarga = useTelaLarga();
  const ferramentas = ferramentasExibidas(papeis);
  const ordenados = [...usuarios].sort((a, b) => {
    const aLogado = mesmoEmail(a.email, emailLogado);
    const bLogado = mesmoEmail(b.email, emailLogado);
    if (aLogado !== bLogado) {
      return aLogado ? -1 : 1;
    }
    return nomeBase(a).localeCompare(nomeBase(b), 'pt-BR');
  });
  const emailUnico = emailDoUnicoAdministrador(usuarios);
  const temNota = ordenados.some((usuario) => ferramentas.some((ferramenta) => comMarcaDeAdmin(usuario, ferramenta.id)));

  if (telaLarga) {
    return (
      <>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Usuários da {nomeDaEmpresa}</caption>
            <thead>
              <tr>
                <th scope="col" className={classeCabecalho}>Pessoa</th>
                {ferramentas.map((ferramenta) => (
                  <th key={ferramenta.id} scope="col" className={classeCabecalho}>{ferramenta.nome}</th>
                ))}
                <th scope="col" className={classeCabecalho}>Situação</th>
                <th scope="col" className={classeCabecalho}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((usuario) => (
                <tr key={usuario.email} className="border-t border-gray-100">
                  <td className="px-4 py-3"><div className="font-semibold text-gray-900">{nomeExibido(usuario, emailLogado)}</div><div className="text-xs text-gray-500">{usuario.email}</div></td>
                  {ferramentas.map((ferramenta) => (
                    <td key={ferramenta.id} className="px-4 py-3 text-gray-700">
                      <PapelNaFerramenta usuario={usuario} ferramenta={ferramenta} />
                    </td>
                  ))}
                  <td className="px-4 py-3"><Situacao status={usuario.status} /></td>
                  <td className="px-4 py-3">
                    <AcoesDaPessoa
                      usuario={usuario}
                      emailLogado={emailLogado}
                      desabilitarRemover={emailUnico !== null && mesmoEmail(usuario.email, emailUnico)}
                      comTexto={false}
                      onEditar={onEditar}
                      onRemover={onRemover}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NotaDeRodape visivel={temNota} />
      </>
    );
  }

  return (
    <>
      <ul aria-label={`Usuários da ${nomeDaEmpresa}`} className="flex flex-col gap-3">
        {ordenados.map((usuario) => (
          <li key={usuario.email} className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900">{nomeExibido(usuario, emailLogado)}</h3>
            <p className="text-xs text-gray-500">{usuario.email}</p>
            <div className="mt-2">
              <Situacao status={usuario.status} />
            </div>
            <dl className="mt-3 space-y-2">
              {ferramentas.map((ferramenta) => (
                <div key={ferramenta.id}>
                  <dt className="text-xs text-gray-500">{ferramenta.nome}</dt>
                  <dd className="text-sm text-gray-900">
                    <PapelNaFerramenta usuario={usuario} ferramenta={ferramenta} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <AcoesDaPessoa
                usuario={usuario}
                emailLogado={emailLogado}
                desabilitarRemover={emailUnico !== null && mesmoEmail(usuario.email, emailUnico)}
                comTexto
                onEditar={onEditar}
                onRemover={onRemover}
              />
            </div>
          </li>
        ))}
      </ul>
      <NotaDeRodape visivel={temNota} />
    </>
  );
}
