import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { redirectToHostedUI } from '@/lib/pkce';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_GATEWAY_URL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().session?.token;
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("Não autorizado. Limpando sessão...");
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        void redirectToHostedUI(window.location.pathname);
      }
    }
    return Promise.reject(error);
  }
);

export interface TermStatusItem {
  type: string;
  term_id: string;
  term_name: string;
  required_version: number;
  can_accept: boolean;
  document_url: string;
  accepted_version?: number;
  accepted_at?: string;
}

export interface TermsStatusResponse {
  pending: TermStatusItem[];
}

export interface TenantResponse {
  site_url: string; // depreciado — fonte da verdade é site_urls
  site_urls?: string[];
  enabled_services: string[];
  plan_name: string;
  status: string;
}

export const TermsService = {
  getStatus: async (tenantId?: string): Promise<TermsStatusResponse> => {
    let url = '/me/terms/status';
    if (tenantId) {
      url += `?tenant_id=${tenantId}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  accept: async (type: string, version: number, tenantId?: string): Promise<void> => {
    let url = `/me/terms/${type}/accept`;
    if (tenantId) {
      url += `?tenant_id=${tenantId}`;
    }
    await api.post(url, { version });
  },
};

export const TenantService = {
  getMe: async (tenantId?: string): Promise<TenantResponse> => {
    let url = '/me/tenant';
    if (tenantId) {
      url += `?tenant_id=${tenantId}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  list: async (): Promise<any[]> => {
    const response = await api.get('/me/tenants');
    return response.data;
  },
};

export interface PapelResumo {
  id: string;
  nome: string;
  sistema: boolean;
  implicito: boolean;
}

export interface AcessoFerramenta {
  id: string;
  nome: string;
  contratada: boolean;
  papel: PapelResumo | null;
  permissoes: string[];
}

export interface MeusAcessos {
  tenant_id: string;
  operador: boolean;
  ferramentas: AcessoFerramenta[];
}

// RF-08: permissões da empresa ativa. O id vai codificado (# vira %23).
export const AcessosService = {
  get: async (tenantId?: string): Promise<MeusAcessos> => {
    let url = '/me/acessos';
    if (tenantId) {
      url += `?tenant_id=${encodeURIComponent(tenantId)}`;
    }
    const response = await api.get(url);
    return response.data;
  },
};

export default api;

// portal-cancelamento RF-C1: contrato de GET/POST /me/cancellation (API RF-B8).
export type CancellationKind = 'arrependimento' | 'fim_de_periodo' | 'imediato' | 'sem_cobranca';
export type CancellationReason = '' | 'not_admin' | 'plan_livre' | 'already_cancelled' | 'already_scheduled';
// AWAITING_SETTLEMENT: cartão ainda não liquidado; o estorno é refeito na liquidação (RF-E2/E3).
export type RefundStatus = 'REQUESTED' | 'IN_PROGRESS' | 'AWAITING_SETTLEMENT' | 'DONE' | 'FAILED';

export interface CancellationPreview {
  can_cancel: boolean;
  reason: CancellationReason;
  kind: CancellationKind | '';
  effective_at: string; // AAAA-MM-DD
  refund: { value: number; billing_type: string } | null;
  refund_deadline: string; // AAAA-MM-DD, vazio fora do prazo de 7 dias
  refund_status?: RefundStatus;
  purge_days: number;
  scheduled: { cancel_at: string; requested_at: string } | null;
}

export type CancellationRequestResult =
  | { status: 'done'; preview: CancellationPreview }
  // O prazo mudou entre a prévia e o clique: a API não agiu e devolveu a prévia nova.
  | { status: 'kind_changed'; preview: CancellationPreview };

export const CancellationService = {
  getPreview: async (tenantId?: string): Promise<CancellationPreview> => {
    let url = '/me/cancellation';
    if (tenantId) {
      url += `?tenant_id=${tenantId}`;
    }
    const response = await api.get(url);
    return response.data;
  },
  request: async (kind: CancellationKind, tenantId?: string): Promise<CancellationRequestResult> => {
    let url = '/me/cancellation';
    if (tenantId) {
      url += `?tenant_id=${tenantId}`;
    }
    try {
      const response = await api.post(url, { kind });
      return { status: 'done', preview: response.data };
    } catch (err: any) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.error === 'cancellation_kind_changed' && data?.preview) {
        return { status: 'kind_changed', preview: data.preview };
      }
      throw err;
    }
  },
};
