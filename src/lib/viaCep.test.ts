import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buscarCep } from './viaCep';

describe('buscarCep (TASK-FE-202, RF-DNG-28, T16)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devolve null se o CEP tiver menos de 8 dígitos sem chamar fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const resultado = await buscarCep('1234567');
    expect(resultado).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('devolve null se o CEP tiver mais de 8 dígitos sem chamar fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const resultado = await buscarCep('123456789');
    expect(resultado).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sanitiza pontuação e chama https://viacep.com.br/ws/{8 dígitos}/json/', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        logradouro: 'Av. Pref. Erasto Gaertner',
        bairro: 'Bacacheri',
        localidade: 'Curitiba',
        uf: 'PR',
      }),
    } as Response);

    const resultado = await buscarCep('82.515-000');

    expect(fetchSpy).toHaveBeenCalledWith('https://viacep.com.br/ws/82515000/json/');
    expect(resultado).toEqual({
      logradouro: 'Av. Pref. Erasto Gaertner',
      bairro: 'Bacacheri',
      cidade: 'Curitiba',
      uf: 'PR',
    });
  });

  it('devolve null quando a resposta do ViaCEP contém erro: true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ erro: true }),
    } as Response);

    const resultado = await buscarCep('99999-999');
    expect(resultado).toBeNull();
  });

  it('devolve null quando res.ok é false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
    } as Response);

    const resultado = await buscarCep('82515000');
    expect(resultado).toBeNull();
  });

  it('devolve null quando o fetch lança exceção (rede fora)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const resultado = await buscarCep('82515000');
    expect(resultado).toBeNull();
  });

  it('trata campos opcionais ou ausentes no retorno como string vazia', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    } as Response);

    const resultado = await buscarCep('01001000');
    expect(resultado).toEqual({
      logradouro: '',
      bairro: '',
      cidade: 'São Paulo',
      uf: 'SP',
    });
  });
});
