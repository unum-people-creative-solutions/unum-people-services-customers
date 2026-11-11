import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CobrancaProvider, useCobranca } from './CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAuthStore } from '@/store/authStore';
import { CobrancaService } from '@/services/cobranca';
import type { ResumoDeCobranca } from '@/types/cobranca';
import { resumoBloqueado, resumoEmAtraso, resumoEmDia } from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF2-31 (CobrancaProvider e useCobranca) e a linha
// "Troca de empresa" do T41 (BP-T §15.1).

vi.mock('@/services/cobranca', () => ({
  CobrancaService: { resumo: vi.fn() },
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/contexts/TenantContext', () => ({
  useTenant: vi.fn(),
}));

const resumoMock = CobrancaService.resumo as unknown as ReturnType<typeof vi.fn>;

function tenantAtivo(activeTenantId: string, isLoadingTenants = false) {
  (useTenant as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    activeTenantId,
    activeTenantName: '',
    availableTenants: [],
    isMultiTenant: true,
    switchTenant: vi.fn(),
    isLoadingTenants,
  });
}

function adiado() {
  let resolver!: (r: ResumoDeCobranca) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<ResumoDeCobranca>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

// Mostra o que o hook devolve, em texto, para o teste ler.
function Leitor() {
  const { resumo, carregando, erro, recarregar } = useCobranca();
  return (
    <div>
      <p>{carregando ? 'carregando' : 'pronto'}</p>
      <p>{erro ? 'com erro' : 'sem erro'}</p>
      <p>{resumo ? `situação ${resumo.situacao}` : 'sem resumo'}</p>
      <button type="button" onClick={() => { recarregar().catch(() => undefined); }}>Reler</button>
    </div>
  );
}

function montar() {
  return render(
    <CobrancaProvider>
      <Leitor />
    </CobrancaProvider>,
  );
}

describe('CobrancaProvider (RF2-31)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      session: { email: 'dono@padariaze.com.br', token: 'token' },
    });
  });

  it('espera isLoadingTenants acabar antes de ler; depois lê o resumo da empresa ativa', async () => {
    resumoMock.mockResolvedValue(resumoEmAtraso);
    tenantAtivo('tenant-A', true);
    const { rerender } = montar();

    expect(resumoMock).not.toHaveBeenCalled();
    expect(screen.getByText('carregando')).toBeInTheDocument();
    expect(screen.getByText('sem resumo')).toBeInTheDocument();

    tenantAtivo('tenant-A', false);
    rerender(
      <CobrancaProvider>
        <Leitor />
      </CobrancaProvider>,
    );

    expect(await screen.findByText('situação em_atraso')).toBeInTheDocument();
    expect(resumoMock).toHaveBeenCalledTimes(1);
    expect(resumoMock).toHaveBeenCalledWith('tenant-A');
    expect(screen.getByText('pronto')).toBeInTheDocument();
    expect(screen.getByText('sem erro')).toBeInTheDocument();
  });

  it('troca de empresa: limpa o resumo, relê, e a resposta atrasada da empresa anterior é descartada', async () => {
    const respostaA = adiado();
    const respostaB = adiado();
    resumoMock.mockImplementation((id: string) => (id === 'tenant-A' ? respostaA.promessa : respostaB.promessa));

    tenantAtivo('tenant-A');
    const { rerender } = montar();
    expect(resumoMock).toHaveBeenLastCalledWith('tenant-A');

    tenantAtivo('tenant-B');
    rerender(
      <CobrancaProvider>
        <Leitor />
      </CobrancaProvider>,
    );
    expect(resumoMock).toHaveBeenLastCalledWith('tenant-B');
    expect(screen.getByText('sem resumo')).toBeInTheDocument();

    // B responde primeiro; A chega atrasada e não pode tomar o lugar.
    await act(async () => {
      respostaB.resolver(resumoEmDia);
    });
    expect(screen.getByText('situação em_dia')).toBeInTheDocument();

    await act(async () => {
      respostaA.resolver(resumoBloqueado);
    });
    expect(screen.getByText('situação em_dia')).toBeInTheDocument();
    expect(screen.queryByText('situação bloqueado')).not.toBeInTheDocument();
  });

  it('troca de empresa com o resumo anterior na tela: o resumo da empresa anterior some na hora', async () => {
    resumoMock.mockResolvedValueOnce(resumoBloqueado);
    tenantAtivo('tenant-A');
    const { rerender } = montar();
    expect(await screen.findByText('situação bloqueado')).toBeInTheDocument();

    const respostaB = adiado();
    resumoMock.mockReturnValueOnce(respostaB.promessa);
    tenantAtivo('tenant-B');
    rerender(
      <CobrancaProvider>
        <Leitor />
      </CobrancaProvider>,
    );

    expect(screen.queryByText('situação bloqueado')).not.toBeInTheDocument();
    expect(screen.getByText('sem resumo')).toBeInTheDocument();
    expect(screen.getByText('carregando')).toBeInTheDocument();

    await act(async () => {
      respostaB.resolver(resumoEmDia);
    });
    expect(screen.getByText('situação em_dia')).toBeInTheDocument();
  });

  it('erro na leitura: erro verdadeiro, sem resumo; recarregar relê e limpa o erro', async () => {
    resumoMock.mockRejectedValueOnce(new Error('Network Error'));
    tenantAtivo('tenant-A');
    montar();

    expect(await screen.findByText('com erro')).toBeInTheDocument();
    expect(screen.getByText('sem resumo')).toBeInTheDocument();
    expect(screen.getByText('pronto')).toBeInTheDocument();

    resumoMock.mockResolvedValueOnce(resumoEmAtraso);
    await userEvent.click(screen.getByRole('button', { name: 'Reler' }));

    expect(await screen.findByText('situação em_atraso')).toBeInTheDocument();
    expect(screen.getByText('sem erro')).toBeInTheDocument();
    expect(resumoMock).toHaveBeenCalledTimes(2);
    expect(resumoMock).toHaveBeenLastCalledWith('tenant-A');
  });

  it('recarregar que falha com um resumo na tela rejeita a promessa para quem chamou', async () => {
    resumoMock.mockResolvedValueOnce(resumoEmAtraso);
    tenantAtivo('tenant-A');
    let recarregarDoHook: (() => Promise<void>) | undefined;
    function Captura() {
      recarregarDoHook = useCobranca().recarregar;
      return <Leitor />;
    }
    render(
      <CobrancaProvider>
        <Captura />
      </CobrancaProvider>,
    );
    expect(await screen.findByText('situação em_atraso')).toBeInTheDocument();

    const falha = new Error('Network Error');
    resumoMock.mockRejectedValueOnce(falha);
    await act(async () => {
      await expect(recarregarDoHook!()).rejects.toBe(falha);
    });
  });

  it('sem sessão não lê (nada de 401 fora da área logada)', async () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ session: null });
    tenantAtivo('tenant-A');
    montar();
    await waitFor(() => expect(screen.getByText('pronto')).toBeInTheDocument());
    expect(resumoMock).not.toHaveBeenCalled();
    expect(screen.getByText('sem resumo')).toBeInTheDocument();
    expect(screen.getByText('sem erro')).toBeInTheDocument();
  });
});
