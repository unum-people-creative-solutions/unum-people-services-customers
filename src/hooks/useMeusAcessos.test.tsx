import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MeusAcessos } from '@/services/usuarios';

const meus = vi.hoisted(() => vi.fn());
vi.mock('@/services/usuarios', () => ({ AcessosService: { meus } }));

import { useMeusAcessos } from './useMeusAcessos';

// gestao-de-acesso-f3-portal-cliente RF-16, CA-09: quem pode gerir usuários na empresa ativa.

function acessos(permissoesDoPortal: string[]): MeusAcessos {
  return {
    tenant_id: 't-1',
    operador: false,
    ferramentas: [
      {
        id: 'portal',
        nome: 'Portal do Cliente',
        contratada: true,
        papel: { id: 'membro', nome: 'Membro', sistema: true, implicito: false },
        permissoes: permissoesDoPortal,
      },
      {
        id: 'crm',
        nome: 'CRM',
        contratada: true,
        papel: { id: 'gestor', nome: 'Gestor', sistema: true, implicito: true },
        // A permissão em outra ferramenta não vale para o Portal.
        permissoes: ['portal.usuarios.gerir'],
      },
    ],
  };
}

describe('useMeusAcessos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('com portal.usuarios.gerir no Portal, pode gerir usuários', async () => {
    meus.mockResolvedValue(acessos(['portal.empresa.ver', 'portal.usuarios.gerir']));
    const { result } = renderHook(() => useMeusAcessos('t-1'));
    expect(result.current.podeGerirUsuarios).toBe(false);
    expect(result.current.carregando).toBe(true);
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.podeGerirUsuarios).toBe(true);
    expect(meus).toHaveBeenCalledWith('t-1');
  });

  it('sem a permissão no Portal, não pode (mesmo com ela noutra ferramenta)', async () => {
    meus.mockResolvedValue(acessos(['portal.empresa.ver']));
    const { result } = renderHook(() => useMeusAcessos('t-1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.podeGerirUsuarios).toBe(false);
  });

  it('erro na leitura: não pode, e avisa o erro', async () => {
    meus.mockRejectedValue({ response: { status: 403 } });
    const { result } = renderHook(() => useMeusAcessos('t-1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.podeGerirUsuarios).toBe(false);
    expect(result.current.erro).toBe(true);
  });

  it('sem empresa ativa, não busca', () => {
    const { result } = renderHook(() => useMeusAcessos(''));
    expect(meus).not.toHaveBeenCalled();
    expect(result.current.podeGerirUsuarios).toBe(false);
  });

  it('troca de empresa busca de novo, e a resposta antiga não vale', async () => {
    let resolverAntiga: (v: MeusAcessos) => void = () => {};
    meus.mockImplementation((tenant: string) =>
      tenant === 't-1'
        ? new Promise<MeusAcessos>((r) => { resolverAntiga = r; })
        : Promise.resolve(acessos(['portal.empresa.ver'])),
    );
    const { result, rerender } = renderHook(({ t }) => useMeusAcessos(t), { initialProps: { t: 't-1' } });
    rerender({ t: 't-2' });
    await waitFor(() => expect(result.current.carregando).toBe(false));
    resolverAntiga(acessos(['portal.empresa.ver', 'portal.usuarios.gerir']));
    await new Promise((r) => setTimeout(r, 0));
    expect(meus).toHaveBeenLastCalledWith('t-2');
    expect(result.current.podeGerirUsuarios).toBe(false);
  });
});
