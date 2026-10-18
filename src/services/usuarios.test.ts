import { vi, describe, it, expect, beforeEach } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      ...http,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ session: null, logout: vi.fn() }) } }));
vi.mock('@/lib/pkce', () => ({ redirectToHostedUI: vi.fn() }));

import {
  AcessosService,
  UsuariosService,
  erroDaApi,
  type ListaDeUsuarios,
  type MeusAcessos,
  type PapeisDaEmpresa,
  type UsuarioDaEmpresa,
} from './usuarios';

// gestao-de-acesso-f3-portal-cliente RF-15, CA-09: contrato de /me/usuarios, /me/papeis e /me/acessos.

const bia: UsuarioDaEmpresa = {
  email: 'bia@loja.com',
  nome: 'Bia',
  status: 'ativo',
  criado_em: '2026-10-18T12:00:00Z',
  acessos: { portal: { papel: 'membro', implicito: false }, crm: { papel: 'vendedor', implicito: false } },
};

describe('UsuariosService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listar busca /me/usuarios da empresa ativa', async () => {
    const lista: ListaDeUsuarios = { usuarios: [bia], limite: { maximo: null, em_uso: 1 } };
    http.get.mockResolvedValue({ data: lista });
    await expect(UsuariosService.listar('t-1')).resolves.toEqual(lista);
    expect(http.get).toHaveBeenCalledWith('/me/usuarios?tenant_id=t-1');
  });

  it('papeis busca /me/papeis da empresa ativa', async () => {
    const papeis: PapeisDaEmpresa = {
      ferramentas: [
        {
          id: 'crm',
          nome: 'CRM',
          contratada: true,
          papel_mais_alto: 'gestor',
          permissoes: [{ id: 'crm.lead.ver', nome: 'Ver e buscar leads' }],
          papeis: [{ id: 'gestor', nome: 'Gestor', descricao: '', sistema: true, permissoes: ['crm.lead.ver'] }],
        },
      ],
    };
    http.get.mockResolvedValue({ data: papeis });
    await expect(UsuariosService.papeis('t-1')).resolves.toEqual(papeis);
    expect(http.get).toHaveBeenCalledWith('/me/papeis?tenant_id=t-1');
  });

  it('convidar envia email, nome e acessos', async () => {
    http.post.mockResolvedValue({ data: bia });
    const convite = { email: 'bia@loja.com', nome: 'Bia', acessos: { portal: 'membro', crm: 'vendedor' } };
    await expect(UsuariosService.convidar(convite, 't-1')).resolves.toEqual(bia);
    expect(http.post).toHaveBeenCalledWith('/me/usuarios?tenant_id=t-1', convite);
  });

  it('atualizar manda só o que mudou, com o e-mail codificado no caminho', async () => {
    http.patch.mockResolvedValue({ data: bia });
    await expect(UsuariosService.atualizar('bia+loja@x.com', { status: 'bloqueado' }, 't-1')).resolves.toEqual(bia);
    expect(http.patch).toHaveBeenCalledWith('/me/usuarios/bia%2Bloja%40x.com?tenant_id=t-1', { status: 'bloqueado' });
  });

  it('remover chama DELETE com o e-mail codificado', async () => {
    http.delete.mockResolvedValue({ status: 204 });
    await expect(UsuariosService.remover('bia@loja.com', 't-1')).resolves.toBeUndefined();
    expect(http.delete).toHaveBeenCalledWith('/me/usuarios/bia%40loja.com?tenant_id=t-1');
  });

  it('sem empresa ativa, as rotas vão sem tenant_id', async () => {
    http.get.mockResolvedValue({ data: { usuarios: [], limite: { maximo: null, em_uso: 0 } } });
    await UsuariosService.listar();
    expect(http.get).toHaveBeenCalledWith('/me/usuarios');
    http.delete.mockResolvedValue({ status: 204 });
    await UsuariosService.remover('bia@loja.com');
    expect(http.delete).toHaveBeenCalledWith('/me/usuarios/bia%40loja.com');
  });

  it('erros da API propagam', async () => {
    const erro = { response: { status: 409, data: { error: 'ja_vinculado' } } };
    http.post.mockRejectedValue(erro);
    await expect(UsuariosService.convidar({ email: 'a@b.c', nome: 'A', acessos: { portal: 'membro' } })).rejects.toBe(erro);
  });
});

describe('AcessosService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('meus busca /me/acessos da empresa ativa', async () => {
    const acessos: MeusAcessos = {
      tenant_id: 't-1',
      operador: false,
      ferramentas: [
        {
          id: 'portal',
          nome: 'Portal do Cliente',
          contratada: true,
          papel: { id: 'administrador', nome: 'Administrador', sistema: true, implicito: false },
          permissoes: ['portal.empresa.ver', 'portal.usuarios.gerir'],
        },
      ],
    };
    http.get.mockResolvedValue({ data: acessos });
    await expect(AcessosService.meus('t-1')).resolves.toEqual(acessos);
    expect(http.get).toHaveBeenCalledWith('/me/acessos?tenant_id=t-1');
  });
});

describe('erroDaApi', () => {
  it('lê status e código da resposta', () => {
    expect(erroDaApi({ response: { status: 422, data: { error: 'limite_de_usuarios' } } })).toEqual({ status: 422, codigo: 'limite_de_usuarios' });
  });

  it('sem resposta (rede), nada definido', () => {
    expect(erroDaApi(new Error('Network Error'))).toEqual({ status: undefined, codigo: undefined });
    expect(erroDaApi(undefined)).toEqual({ status: undefined, codigo: undefined });
  });

  it('corpo sem error string não inventa código', () => {
    expect(erroDaApi({ response: { status: 500, data: 'Internal Server Error' } })).toEqual({ status: 500, codigo: undefined });
  });
});
