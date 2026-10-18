'use client';

// gestao-de-acesso-f3-portal-cliente RF-18: papéis por ferramenta, com o Automático.
import { useId } from 'react';
import type { FerramentaComPapeis, PapeisDaEmpresa } from '@/services/usuarios';

type AcessosPorFerramentaProps = {
  papeis: PapeisDaEmpresa;
  valor: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  portalBloqueado?: boolean;
  motivoPortalBloqueado?: string;
  // id de um aviso fora do componente que explica o Portal bloqueado (aria-describedby).
  idDoMotivoPortal?: string;
};

function nomeDoPapel(ferramenta: FerramentaComPapeis, id: string): string {
  return ferramenta.papeis.find((p) => p.id === id)?.nome ?? id;
}

function papelImplicito(ferramenta: FerramentaComPapeis, portal: string): string {
  return portal === 'administrador' ? ferramenta.papel_mais_alto : 'sem_acesso';
}

function descricaoDoPapel(ferramenta: FerramentaComPapeis, papelId: string): string {
  const permissoes = ferramenta.papeis.find((p) => p.id === papelId)?.permissoes ?? [];
  if (permissoes.length === 0) {
    return `Não entra no ${ferramenta.nome}.`;
  }
  const nomes = permissoes.map((id) => ferramenta.permissoes.find((p) => p.id === id)?.nome ?? id);
  return `${nomes.join(', ')}.`;
}

export default function AcessosPorFerramenta({
  papeis,
  valor,
  onChange,
  portalBloqueado = false,
  motivoPortalBloqueado,
  idDoMotivoPortal,
}: AcessosPorFerramentaProps) {
  const baseId = useId();
  const visiveis = papeis.ferramentas.filter((f) => f.id === 'portal' || f.contratada);

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold text-gray-900">O que a pessoa pode fazer</legend>
      {visiveis.map((ferramenta) => {
        const id = `${baseId}-${ferramenta.id}`;
        const idDescricao = `${baseId}-${ferramenta.id}-desc`;
        const portal = ferramenta.id === 'portal';
        const escolhido = valor[ferramenta.id] ?? '';
        const efetivo = portal || escolhido !== '' ? escolhido : papelImplicito(ferramenta, valor.portal ?? '');

        return (
          <div key={ferramenta.id} className="space-y-1">
            <label htmlFor={id} className="block text-sm font-semibold text-gray-800">
              {ferramenta.nome}
            </label>
            <select
              id={id}
              aria-describedby={portal && portalBloqueado && idDoMotivoPortal ? `${idDescricao} ${idDoMotivoPortal}` : idDescricao}
              value={portal ? (valor.portal ?? '') : escolhido}
              disabled={portal && portalBloqueado}
              onChange={(event) => onChange({ ...valor, [ferramenta.id]: event.target.value })}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              {portal ? null : (
                <option value="">Automático ({nomeDoPapel(ferramenta, papelImplicito(ferramenta, valor.portal ?? ''))})</option>
              )}
              {ferramenta.papeis.map((papel) => (
                <option key={papel.id} value={papel.id}>
                  {papel.nome}
                </option>
              ))}
            </select>
            <p id={idDescricao} className="text-xs text-gray-500">
              {descricaoDoPapel(ferramenta, efetivo)}
            </p>
            {portal && portalBloqueado && motivoPortalBloqueado ? (
              <p className="text-xs text-gray-500">{motivoPortalBloqueado}</p>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
