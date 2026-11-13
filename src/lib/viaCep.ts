// dados-do-negocio: consulta de CEP no ViaCEP (RF-DNG-28, TASK-FE-202).
// Sanitiza para 8 dígitos, nunca trava e devolve null em qualquer erro.

export interface EnderecoViaCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  const digits = (cep ?? '').replace(/\D/g, '');
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro === true || data.erro === 'true') return null;

    return {
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      uf: data.uf ?? '',
    };
  } catch {
    return null;
  }
}
