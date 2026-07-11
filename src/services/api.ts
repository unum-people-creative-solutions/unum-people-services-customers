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
  site_url: string;
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

export default api;
