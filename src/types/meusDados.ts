// dados-do-negocio: contratos de GET/PUT /me/negocio e /me/perfil (TECH-DESIGN §4.1 a §4.3).

export interface EnderecoDoNegocio {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade?: string;
  uf?: string;
}

export interface DadosDoNegocio {
  nome_negocio: string;
  documento: string;
  email_cobranca: string;
  celular: string;
  endereco: EnderecoDoNegocio | null;
  endereco_obrigatorio: boolean;
  endereco_completo: boolean;
  pode_editar: boolean;
}

export interface MudancaDoNegocio {
  nome_negocio?: string;
  celular?: string;
  endereco?: EnderecoDoNegocio;
}

export interface EmpresaDoPerfil {
  id: string;
  nome_negocio: string;
  papel_portal: string;
}

export interface Perfil {
  nome: string;
  email: string;
  empresas: EmpresaDoPerfil[];
}

export type ErroDoNegocio = {
  tipo: 'campo' | 'asaas' | 'indisponivel';
  campo?: string;
  detalhe?: string;
};
