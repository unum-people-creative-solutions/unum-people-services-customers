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
  getStatus: async (): Promise<TermsStatusResponse> => {
    const response = await api.get('/me/terms/status');
    return response.data;
  },
  accept: async (type: string, version: number): Promise<void> => {
    await api.post(`/me/terms/${type}/accept`, { version });
  },
};

export const TenantService = {
  getMe: async (): Promise<TenantResponse> => {
    const response = await api.get('/me/tenant');
    return response.data;
  },
};

export default api;
