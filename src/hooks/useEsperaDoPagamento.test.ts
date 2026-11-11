import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEsperaDoPagamento } from './useEsperaDoPagamento';
import type { ResumoDeCobranca } from '@/types/cobranca';
import { resumoBloqueado, resumoEmAtraso, resumoEmDia } from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF2-33 (espera do pagamento, BP-T §5), T42 e o bloco
// de segurança da TASK-FE-P04 (chave do sessionStorage por tenant_id, apagada no fim).

const TENANT = '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b';
const CHAVE = `cobranca-aguardando:${TENANT}`;
const INICIO = new Date('2026-11-10T15:00:00Z').getTime();

let visibilidade: DocumentVisibilityState = 'visible';

function mudarVisibilidade(estado: DocumentVisibilityState) {
  visibilidade = estado;
  document.dispatchEvent(new Event('visibilitychange'));
}

type Props = { tenantId: string; resumo: ResumoDeCobranca | null };

function montar(recarregar: () => Promise<void>, props: Props = { tenantId: TENANT, resumo: resumoEmAtraso }) {
  return renderHook(({ tenantId, resumo }: Props) => useEsperaDoPagamento(tenantId, resumo, recarregar), {
    initialProps: props,
  });
}

async function passar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useEsperaDoPagamento (RF2-33)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(INICIO);
    sessionStorage.clear();
    visibilidade = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidade);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('parado até iniciar; iniciar grava a chave da empresa com o horário do clique e o vencimento', () => {
    const { result } = montar(vi.fn().mockResolvedValue(undefined));
    expect(result.current.estado).toBe('parado');
    expect(result.current.falhou).toBe(false);

    act(() => result.current.iniciar('2026-11-05'));

    expect(result.current.estado).toBe('aguardando');
    expect(JSON.parse(sessionStorage.getItem(CHAVE)!)).toEqual({ clicado_em: INICIO, vencimento: '2026-11-05' });
    // Só horário e vencimento: nada além disso no sessionStorage.
    expect(Object.keys(JSON.parse(sessionStorage.getItem(CHAVE)!)).sort()).toEqual(['clicado_em', 'vencimento']);
  });

  it('consulta a cada 15 s com a aba visível, não antes', async () => {
    const recarregar = vi.fn().mockResolvedValue(undefined);
    const { result } = montar(recarregar);
    act(() => result.current.iniciar('2026-11-05'));

    await passar(14_999);
    expect(recarregar).not.toHaveBeenCalled();
    await passar(1);
    expect(recarregar).toHaveBeenCalledTimes(1);
    await passar(15_000);
    expect(recarregar).toHaveBeenCalledTimes(2);
  });

  it('aba escondida não consulta por intervalo; ao voltar a ficar visível consulta na hora', async () => {
    const recarregar = vi.fn().mockResolvedValue(undefined);
    const { result } = montar(recarregar);
    act(() => result.current.iniciar('2026-11-05'));

    act(() => mudarVisibilidade('hidden'));
    await passar(45_000);
    expect(recarregar).not.toHaveBeenCalled();

    act(() => mudarVisibilidade('visible'));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('ao voltar o foco consulta no máximo uma vez a cada 5 s', async () => {
    const recarregar = vi.fn().mockResolvedValue(undefined);
    const { result } = montar(recarregar);
    act(() => result.current.iniciar('2026-11-05'));

    await passar(6_000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(recarregar).toHaveBeenCalledTimes(1);

    await passar(4_000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(recarregar).toHaveBeenCalledTimes(1);

    await passar(1_000);
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(recarregar).toHaveBeenCalledTimes(2);
  });

  it('para aos 10 min: sem_confirmacao, chave apagada e nenhuma consulta por intervalo depois', async () => {
    const recarregar = vi.fn().mockResolvedValue(undefined);
    const { result } = montar(recarregar);
    act(() => result.current.iniciar('2026-11-05'));

    await passar(10 * 60_000 - 1);
    expect(result.current.estado).toBe('aguardando');
    expect(recarregar).toHaveBeenCalledTimes(39);

    await passar(1);
    expect(result.current.estado).toBe('sem_confirmacao');
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
    // Até 40 consultas por intervalo (BP-T §5.2).
    const consultas = recarregar.mock.calls.length;
    expect(consultas).toBeGreaterThanOrEqual(39);
    expect(consultas).toBeLessThanOrEqual(40);

    await passar(60_000);
    expect(recarregar).toHaveBeenCalledTimes(consultas);
  });

  it('conferirAgora faz uma consulta', async () => {
    const recarregar = vi.fn().mockResolvedValue(undefined);
    const { result } = montar(recarregar);
    act(() => result.current.iniciar('2026-11-05'));
    await passar(10 * 60_000);
    recarregar.mockClear();

    act(() => result.current.conferirAgora());
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('resumo em_dia: confirmado e chave apagada', () => {
    const { result, rerender } = montar(vi.fn().mockResolvedValue(undefined));
    act(() => result.current.iniciar('2026-11-05'));

    rerender({ tenantId: TENANT, resumo: resumoEmDia });

    expect(result.current.estado).toBe('confirmado');
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });

  it('continua em atraso com outro vencimento: parcial, com o vencimento pago, e chave apagada', () => {
    const { result, rerender } = montar(vi.fn().mockResolvedValue(undefined), {
      tenantId: TENANT,
      resumo: { ...resumoBloqueado, fatura: { valor: 39.9, vencimento: '2026-10-05', link: 'https://www.asaas.com/i/abc' } },
    });
    act(() => result.current.iniciar('2026-10-05'));

    rerender({ tenantId: TENANT, resumo: resumoBloqueado });

    expect(result.current.estado).toBe('parcial');
    expect(result.current.vencimentoPago).toBe('2026-10-05');
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });

  it('continua em atraso com o mesmo vencimento: segue aguardando', () => {
    const { result, rerender } = montar(vi.fn().mockResolvedValue(undefined));
    act(() => result.current.iniciar('2026-11-05'));

    rerender({ tenantId: TENANT, resumo: { ...resumoEmAtraso } });

    expect(result.current.estado).toBe('aguardando');
    expect(sessionStorage.getItem(CHAVE)).not.toBeNull();
  });

  it('três consultas seguidas com falha: falhou; uma consulta boa limpa', async () => {
    const recarregar = vi.fn().mockRejectedValue(new Error('Network Error'));
    const { result } = montar(recarregar);
    act(() => result.current.iniciar('2026-11-05'));

    await passar(30_000);
    expect(recarregar).toHaveBeenCalledTimes(2);
    expect(result.current.falhou).toBe(false);

    await passar(15_000);
    expect(recarregar).toHaveBeenCalledTimes(3);
    expect(result.current.falhou).toBe(true);
    expect(result.current.estado).toBe('aguardando');

    recarregar.mockResolvedValue(undefined);
    await passar(15_000);
    expect(result.current.falhou).toBe(false);
  });

  it('recarregar a página com a chave guardada retoma a espera', async () => {
    sessionStorage.setItem(CHAVE, JSON.stringify({ clicado_em: INICIO - 60_000, vencimento: '2026-11-05' }));
    const recarregar = vi.fn().mockResolvedValue(undefined);
    const { result } = montar(recarregar);

    expect(result.current.estado).toBe('aguardando');
    await passar(15_000);
    expect(recarregar).toHaveBeenCalledTimes(1);

    // O limite conta do clique, não da recarga.
    await passar(9 * 60_000 - 15_000 - 1);
    expect(result.current.estado).toBe('aguardando');
    await passar(1);
    expect(result.current.estado).toBe('sem_confirmacao');
  });

  it('recarregar depois dos 10 min: sem_confirmacao e chave apagada (também com efeitos rodando duas vezes, StrictMode)', () => {
    sessionStorage.setItem(CHAVE, JSON.stringify({ clicado_em: INICIO - 11 * 60_000, vencimento: '2026-11-05' }));
    const { result } = renderHook(() => useEsperaDoPagamento(TENANT, resumoEmAtraso, vi.fn().mockResolvedValue(undefined)), {
      wrapper: StrictMode,
    });
    expect(result.current.estado).toBe('sem_confirmacao');
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });

  it('troca de empresa: a espera vencida de uma não apaga a chave da outra', () => {
    sessionStorage.setItem(CHAVE, JSON.stringify({ clicado_em: INICIO - 11 * 60_000, vencimento: '2026-11-05' }));
    sessionStorage.setItem('cobranca-aguardando:tenant-B', JSON.stringify({ clicado_em: INICIO - 60_000, vencimento: '2026-11-05' }));
    const { result, rerender } = montar(vi.fn().mockResolvedValue(undefined));
    expect(result.current.estado).toBe('sem_confirmacao');

    rerender({ tenantId: 'tenant-B', resumo: resumoEmAtraso });
    expect(result.current.estado).toBe('aguardando');
    expect(sessionStorage.getItem('cobranca-aguardando:tenant-B')).not.toBeNull();
  });

  it('a chave é por empresa: a de outra empresa não retoma a espera', () => {
    sessionStorage.setItem('cobranca-aguardando:outra-empresa', JSON.stringify({ clicado_em: INICIO, vencimento: '2026-11-05' }));
    const { result } = montar(vi.fn().mockResolvedValue(undefined));
    expect(result.current.estado).toBe('parado');
  });

  it('fechar volta a parado', () => {
    const { result, rerender } = montar(vi.fn().mockResolvedValue(undefined));
    act(() => result.current.iniciar('2026-11-05'));
    rerender({ tenantId: TENANT, resumo: resumoEmDia });
    expect(result.current.estado).toBe('confirmado');

    act(() => result.current.fechar());
    expect(result.current.estado).toBe('parado');
  });
});
