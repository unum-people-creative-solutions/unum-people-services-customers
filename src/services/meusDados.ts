// dados-do-negocio: leitura e gravação do cadastro da empresa e da pessoa.
import api from '@/services/api';
import type { DadosDoNegocio, ErroDoNegocio, MudancaDoNegocio, Perfil } from '@/types/meusDados';

function urlDaEmpresa(caminho: string, tenantId: string): string {
  return `${caminho}?tenant_id=${encodeURIComponent(tenantId)}`;
}

function cabecalhoDaEmpresa(tenantId: string) {
  return { headers: { 'X-Tenant-ID': tenantId } };
}

export function mapearErroDoNegocio(err: unknown): ErroDoNegocio | null {
  if (typeof err !== 'object' || err === null || !('response' in err)) return null;
  const response = (err as { response?: { status?: number; data?: { campo?: unknown; motivo?: unknown; detalhe?: unknown } } }).response;
  if (response?.status === 400) {
    return {
      tipo: 'campo',
      campo: typeof response.data?.campo === 'string' ? response.data.campo : undefined,
      detalhe: typeof response.data?.motivo === 'string' ? response.data.motivo : undefined,
    };
  }
  if (response?.status === 422) {
    return {
      tipo: 'asaas',
      detalhe: typeof response.data?.detalhe === 'string' ? response.data.detalhe : undefined,
    };
  }
  if (response?.status === 503) return { tipo: 'indisponivel' };
  return null;
}

export const NegocioService = {
  async ler(tenantId: string): Promise<DadosDoNegocio> {
    const response = await api.get<DadosDoNegocio>(urlDaEmpresa('/me/negocio', tenantId), cabecalhoDaEmpresa(tenantId));
    return response.data;
  },

  async salvar(tenantId: string, mudanca: MudancaDoNegocio): Promise<DadosDoNegocio> {
    try {
      const response = await api.put<DadosDoNegocio>(urlDaEmpresa('/me/negocio', tenantId), mudanca, cabecalhoDaEmpresa(tenantId));
      return response.data;
    } catch (err) {
      const mapeado = mapearErroDoNegocio(err);
      if (mapeado) throw mapeado;
      throw err;
    }
  },
};

export const PerfilService = {
  async ler(): Promise<Perfil> {
    const response = await api.get<Perfil>('/me/perfil');
    return response.data;
  },

  async salvarNome(nome: string): Promise<Perfil> {
    const response = await api.put<Perfil>('/me/perfil', { nome });
    return response.data;
  },
};
