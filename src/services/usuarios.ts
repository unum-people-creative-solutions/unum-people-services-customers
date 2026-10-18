// gestao-de-acesso-f3-portal-cliente RF-15: contrato de /me/usuarios, /me/papeis e /me/acessos.
import api from '@/services/api';

export type StatusVinculo = 'ativo' | 'bloqueado';

export interface AcessoDaFerramenta {
  papel: string;
  implicito: boolean;
}

export interface UsuarioDaEmpresa {
  email: string;
  nome: string;
  status: StatusVinculo;
  criado_em: string;
  acessos: Record<string, AcessoDaFerramenta>;
}

export interface ListaDeUsuarios {
  usuarios: UsuarioDaEmpresa[];
  limite: { maximo: number | null; em_uso: number };
}

export interface PermissaoDoCatalogo {
  id: string;
  nome: string;
}

export interface PapelDaEmpresa {
  id: string;
  nome: string;
  descricao: string;
  sistema: boolean;
  permissoes: string[];
}

export interface FerramentaComPapeis {
  id: string;
  nome: string;
  contratada: boolean;
  papel_mais_alto: string;
  permissoes: PermissaoDoCatalogo[];
  papeis: PapelDaEmpresa[];
}

export interface PapeisDaEmpresa {
  ferramentas: FerramentaComPapeis[];
}

export interface PapelResumo {
  id: string;
  nome: string;
  sistema: boolean;
  implicito: boolean;
}

export interface AcessoDaPessoa {
  id: string;
  nome: string;
  contratada: boolean;
  papel: PapelResumo | null;
  permissoes: string[];
}

export interface MeusAcessos {
  tenant_id: string;
  operador: boolean;
  ferramentas: AcessoDaPessoa[];
}

export interface ConviteDeUsuario {
  email: string;
  nome: string;
  acessos: Record<string, string>;
}

export interface MudancaDeUsuario {
  nome?: string;
  status?: StatusVinculo;
  acessos?: Record<string, string>;
}

function urlDaEmpresa(caminho: string, tenantId?: string): string {
  if (tenantId) {
    return `${caminho}?tenant_id=${tenantId}`;
  }
  return caminho;
}

function urlDoUsuario(email: string, tenantId?: string): string {
  return urlDaEmpresa(`/me/usuarios/${encodeURIComponent(email)}`, tenantId);
}

export const UsuariosService = {
  listar: async (tenantId?: string): Promise<ListaDeUsuarios> => {
    const response = await api.get(urlDaEmpresa('/me/usuarios', tenantId));
    return response.data;
  },
  papeis: async (tenantId?: string): Promise<PapeisDaEmpresa> => {
    const response = await api.get(urlDaEmpresa('/me/papeis', tenantId));
    return response.data;
  },
  convidar: async (convite: ConviteDeUsuario, tenantId?: string): Promise<UsuarioDaEmpresa> => {
    const response = await api.post(urlDaEmpresa('/me/usuarios', tenantId), convite);
    return response.data;
  },
  atualizar: async (email: string, mudanca: MudancaDeUsuario, tenantId?: string): Promise<UsuarioDaEmpresa> => {
    const response = await api.patch(urlDoUsuario(email, tenantId), mudanca);
    return response.data;
  },
  remover: async (email: string, tenantId?: string): Promise<void> => {
    await api.delete(urlDoUsuario(email, tenantId));
  },
};

export const AcessosService = {
  meus: async (tenantId?: string): Promise<MeusAcessos> => {
    const response = await api.get(urlDaEmpresa('/me/acessos', tenantId));
    return response.data;
  },
};

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

export function erroDaApi(err: unknown): { status?: number; codigo?: string } {
  if (!ehObjeto(err) || !ehObjeto(err.response)) {
    return { status: undefined, codigo: undefined };
  }
  const status = typeof err.response.status === 'number' ? err.response.status : undefined;
  const data = err.response.data;
  const codigo = ehObjeto(data) && typeof data.error === 'string' ? data.error : undefined;
  return { status, codigo };
}
