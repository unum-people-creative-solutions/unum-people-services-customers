import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CobrancaProvider } from '@/contexts/CobrancaContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAuthStore } from '@/store/authStore';
import { CobrancaService } from '@/services/cobranca';
import { usePathname } from 'next/navigation';
import type { ResumoDeCobranca } from '@/types/cobranca';
import {
  resumoBloqueado,
  resumoEmAtraso,
  resumoBloqueadoAntesDoParcial,
  resumoEmAtrasoDepoisDoParcial,
  RELOGIO_DO_PARCIAL,
  resumoEmAtrasoSemDatas,
  resumoEmAtrasoSemFatura,
  resumoEmAtrasoSemGerir,
  resumoEmDia,
  resumoForaDoAr,
} from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF2-32 (faixa do Portal), T41, BP-T §4 e §15.1.

vi.mock('@/services/cobranca', () => ({
  CobrancaService: { resumo: vi.fn() },
}));
vi.mock('@/store/authStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('@/contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

const resumoMock = CobrancaService.resumo as unknown as ReturnType<typeof vi.fn>;

const LINHA_DO_BOLETO = 'Pix confirma na hora. Boleto pode levar até 3 dias úteis para ser confirmado.';
const LINHA_SEM_LINK =
  'Não conseguimos abrir o link da fatura. Escreva para atendimento@unumpeople.com.br que enviamos para você.';

function empresa(enabled_services: string[], opcoes: { id?: string; isLoadingTenants?: boolean } = {}) {
  const id = opcoes.id ?? '3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b';
  (useTenant as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    activeTenantId: id,
    activeTenantName: 'Padaria Zé',
    availableTenants: [{ id, nome_negocio: 'Padaria Zé', enabled_services }],
    isMultiTenant: false,
    switchTenant: vi.fn(),
    isLoadingTenants: opcoes.isLoadingTenants ?? false,
  });
}

function arvore() {
  return (
    <CobrancaProvider>
      <main>Conteúdo da página</main>
    </CobrancaProvider>
  );
}

async function montarCom(resumo: ResumoDeCobranca) {
  resumoMock.mockResolvedValue(resumo);
  const r = render(arvore());
  await act(async () => {});
  return r;
}

function faixa() {
  return screen.getByRole('region', { name: 'Aviso de cobrança' });
}

describe('FaixaDeCobranca (RF2-32)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      session: { email: 'dono@padariaze.com.br', token: 'token' },
    });
    (usePathname as unknown as ReturnType<typeof vi.fn>).mockReturnValue('/produtos');
    empresa(['site', 'crm', 'blog']);
  });

  it('em_atraso, gere: texto aprovado, linha do boleto e link "Pagar fatura" em nova aba para fatura.link', async () => {
    await montarCom(resumoEmAtraso);

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent(
      'Sua fatura de R$ 39,90 venceu em 05/11. Pague até 14/11 para não perder o acesso a Páginas, CRM e blog.',
    );
    expect(status).toHaveTextContent(LINHA_DO_BOLETO);

    const pagar = screen.getByRole('link', { name: /Pagar fatura/ });
    expect(pagar).toHaveAttribute('href', 'https://www.asaas.com/i/abc');
    expect(pagar).toHaveAttribute('target', '_blank');
    expect(pagar).toHaveAttribute('rel', 'noopener noreferrer');
    expect(pagar).toHaveAccessibleName(/abre em nova aba/);
    expect(screen.queryByText('Avise o responsável pela conta')).not.toBeInTheDocument();
  });

  it('a faixa vem acima do conteúdo da página', async () => {
    await montarCom(resumoEmAtraso);
    const conteudo = screen.getByText('Conteúdo da página');
    expect(faixa().compareDocumentPosition(conteudo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('em_atraso cita só as ferramentas do plano da empresa ativa (enabled_services)', async () => {
    empresa(['site']);
    await montarCom(resumoEmAtraso);
    expect(within(faixa()).getByRole('status')).toHaveTextContent(
      'Sua fatura de R$ 39,90 venceu em 05/11. Pague até 14/11 para não perder o acesso a Páginas.',
    );
  });

  it('bloqueado: texto aprovado com fora_do_ar_em, ferramentas de ferramentas_bloqueadas, boleto e "Pagar fatura"', async () => {
    await montarCom({ ...resumoBloqueado, ferramentas_bloqueadas: ['crm', 'lp'] });

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent(
      'Acesso a Páginas e CRM bloqueado por fatura em atraso. Sua página publicada sai do ar em 05/12.',
    );
    expect(status).toHaveTextContent(LINHA_DO_BOLETO);
    expect(screen.getByRole('link', { name: /Pagar fatura/ })).toHaveAttribute('href', 'https://www.asaas.com/i/abc');
  });

  // Fase 4 (RF4-05, T72): o "Pedir a reativação por e-mail" da fase 2 vira "Reativar minha conta".
  it('fora_do_ar, gere: texto com cancelamento_em e "Reativar minha conta" para /reativar na mesma aba', async () => {
    const { container } = await montarCom(resumoForaDoAr);

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent(
      'Sua página está fora do ar por falta de pagamento. A conta será cancelada em 04/01.',
    );
    expect(status).not.toHaveTextContent(LINHA_DO_BOLETO);
    const reativar = within(faixa()).getByRole('link', { name: 'Reativar minha conta' });
    expect(reativar).toHaveAttribute('href', '/reativar');
    expect(reativar).not.toHaveAttribute('target');
    expect(screen.queryByRole('link', { name: 'Pedir a reativação por e-mail' })).not.toBeInTheDocument();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
  });

  it('sem pode_gerir em em_atraso: sem link de pagar no DOM e "Avise o responsável pela conta"', async () => {
    const { container } = await montarCom(resumoEmAtrasoSemGerir);

    expect(within(faixa()).getByRole('status')).toHaveTextContent(
      'Sua fatura de R$ 39,90 venceu em 05/11. Pague até 14/11 para não perder o acesso a Páginas, CRM e blog.',
    );
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
    expect(container.querySelector('a[href*="asaas"]')).toBeNull();
    expect(screen.getByText('Avise o responsável pela conta')).toBeInTheDocument();
  });

  it('sem pode_gerir em bloqueado e em fora_do_ar: "Avise o responsável pela conta", sem pagar nem reativar', async () => {
    const { unmount } = await montarCom({ ...resumoBloqueado, fatura: { valor: 39.9, vencimento: '2026-11-05' }, pode_gerir: false });
    expect(screen.getByText('Avise o responsável pela conta')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
    unmount();

    await montarCom({ ...resumoForaDoAr, pode_gerir: false });
    expect(screen.getByText('Avise o responsável pela conta')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pedir a reativação por e-mail' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reativar minha conta' })).not.toBeInTheDocument();
  });

  it('fatura: null em em_atraso: sem valor, sem botão, com a linha do e-mail (mailto)', async () => {
    await montarCom(resumoEmAtrasoSemFatura);

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent(
      'Sua fatura venceu em 05/11. Pague até 14/11 para não perder o acesso a Páginas, CRM e blog.',
    );
    expect(status).not.toHaveTextContent('R$');
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
    expect(faixa()).toHaveTextContent(LINHA_SEM_LINK);
    expect(screen.getByRole('link', { name: 'atendimento@unumpeople.com.br' })).toHaveAttribute(
      'href',
      'mailto:atendimento@unumpeople.com.br',
    );
  });

  // RF2-32a: em_atraso sem as cinco datas não monta frase com data vazia.
  it('em_atraso sem datas (corpo literal da API), com fatura: "está em atraso", boleto e "Pagar fatura"', async () => {
    await montarCom(resumoEmAtrasoSemDatas);

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent(
      'Sua fatura de R$ 39,90 está em atraso. Pague para não perder o acesso a Páginas, CRM e blog.',
    );
    expect(status).not.toHaveTextContent('Pague até');
    expect(status).not.toHaveTextContent('venceu em');
    expect(status).toHaveTextContent(LINHA_DO_BOLETO);
    expect(screen.getByRole('link', { name: /Pagar fatura/ })).toHaveAttribute('href', 'https://www.asaas.com/i/abc');
  });

  it('em_atraso sem datas e sem fatura: "Há uma fatura em atraso nesta conta.", boleto e a linha do e-mail, sem botão', async () => {
    await montarCom({ ...resumoEmAtrasoSemDatas, fatura: null });

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent(
      'Há uma fatura em atraso nesta conta. Pague para não perder o acesso a Páginas, CRM e blog.',
    );
    expect(status).not.toHaveTextContent('Pague até');
    expect(status).not.toHaveTextContent('venceu em');
    expect(status).toHaveTextContent(LINHA_DO_BOLETO);
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
    expect(faixa()).toHaveTextContent(LINHA_SEM_LINK);
  });

  it('fatura: null em bloqueado: o texto do estado e a linha do e-mail, sem botão', async () => {
    await montarCom({ ...resumoBloqueado, fatura: null });

    expect(within(faixa()).getByRole('status')).toHaveTextContent(
      'Acesso a Páginas, CRM e blog bloqueado por fatura em atraso. Sua página publicada sai do ar em 05/12.',
    );
    expect(screen.queryByRole('link', { name: /Pagar fatura/ })).not.toBeInTheDocument();
    expect(faixa()).toHaveTextContent(LINHA_SEM_LINK);
  });

  it('fatura: null sem pode_gerir: "Avise o responsável pela conta" no lugar da linha do e-mail', async () => {
    await montarCom({ ...resumoEmAtrasoSemFatura, pode_gerir: false });

    expect(screen.getByText('Avise o responsável pela conta')).toBeInTheDocument();
    expect(faixa()).not.toHaveTextContent(LINHA_SEM_LINK);
    expect(screen.queryByRole('link', { name: 'atendimento@unumpeople.com.br' })).not.toBeInTheDocument();
  });

  it.each([
    ['em_dia', resumoEmDia],
    ['pausada', { ...resumoEmDia, situacao: 'pausada' } as ResumoDeCobranca],
    ['cancelada', { ...resumoEmDia, situacao: 'cancelada' } as ResumoDeCobranca],
    ['outra', { ...resumoEmDia, situacao: 'outra' } as ResumoDeCobranca],
  ])('%s: nenhuma faixa', async (_nome, resumo) => {
    await montarCom(resumo);
    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Aviso de cobrança' })).not.toBeInTheDocument();
  });

  it('erro ao ler: alerta "Erro" com a mensagem, não some sozinho, e "Tentar de novo" relê', async () => {
    resumoMock.mockRejectedValueOnce(new Error('Network Error'));
    render(arvore());
    await act(async () => {});

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Erro');
    expect(alerta).toHaveTextContent('Não foi possível conferir a situação da sua fatura.');

    // Nova falha: o alerta continua.
    resumoMock.mockRejectedValueOnce(new Error('Network Error'));
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível conferir a situação da sua fatura.');

    resumoMock.mockResolvedValueOnce(resumoEmAtraso);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(resumoMock).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(within(faixa()).getByRole('status')).toHaveTextContent('Sua fatura de R$ 39,90 venceu em 05/11.');
  });

  it('/auth/callback: sem faixa', async () => {
    (usePathname as unknown as ReturnType<typeof vi.fn>).mockReturnValue('/auth/callback');
    await montarCom(resumoEmAtraso);
    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Aviso de cobrança' })).not.toBeInTheDocument();
  });

  it('antes de isLoadingTenants acabar: sem faixa', async () => {
    empresa(['site', 'crm', 'blog'], { isLoadingTenants: true });
    await montarCom(resumoEmAtraso);
    expect(screen.queryByRole('region', { name: 'Aviso de cobrança' })).not.toBeInTheDocument();
  });

  it('troca de empresa: a faixa da empresa anterior some e a resposta atrasada dela não aparece', async () => {
    let resolverA!: (r: ResumoDeCobranca) => void;
    let resolverB!: (r: ResumoDeCobranca) => void;
    resumoMock.mockResolvedValueOnce(resumoBloqueado);
    empresa(['site', 'crm', 'blog'], { id: 'tenant-A' });
    const { rerender } = render(arvore());
    await act(async () => {});
    expect(faixa()).toHaveTextContent('bloqueado por fatura em atraso');

    // Volta para A depois de B: a leitura de A fica pendurada; B responde antes.
    resumoMock.mockReturnValueOnce(new Promise<ResumoDeCobranca>((res) => { resolverB = res; }));
    empresa(['site'], { id: 'tenant-B' });
    rerender(arvore());
    expect(screen.queryByRole('region', { name: 'Aviso de cobrança' })).not.toBeInTheDocument();

    resumoMock.mockReturnValueOnce(new Promise<ResumoDeCobranca>((res) => { resolverA = res; }));
    empresa(['site', 'crm', 'blog'], { id: 'tenant-A' });
    rerender(arvore());
    await act(async () => { resolverB(resumoEmAtraso); });
    expect(screen.queryByRole('region', { name: 'Aviso de cobrança' })).not.toBeInTheDocument();

    await act(async () => { resolverA(resumoEmDia); });
    expect(screen.queryByRole('region', { name: 'Aviso de cobrança' })).not.toBeInTheDocument();
  });
});

// spec: RF2-33 (espera do pagamento na faixa), T42 e BP-T §15.1 "Espera", "Confirmado", "Parcial (R6)".
describe('FaixaDeCobranca — espera do pagamento (RF2-33)', () => {
  const CHAVE = 'cobranca-aguardando:3f2b8c1e-9d4a-4e7b-a6c5-1b2d3e4f5a6b';
  const INICIO = new Date('2026-11-10T15:00:00Z').getTime();
  const AGUARDANDO = 'Aguardando a confirmação do pagamento';
  const LINHA_AGUARDANDO = 'Pix e cartão costumam confirmar em poucos minutos. Esta tela atualiza sozinha.';
  const SEM_CONFIRMACAO =
    'Ainda não recebemos a confirmação. Pix e cartão confirmam em poucos minutos. Boleto leva até 3 dias úteis. O acesso volta sozinho quando o pagamento for confirmado.';
  const FALHA_NA_CONSULTA = 'Não foi possível conferir o pagamento agora. Tente de novo em instantes.';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(INICIO);
    sessionStorage.clear();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      session: { email: 'dono@padariaze.com.br', token: 'token' },
    });
    (usePathname as unknown as ReturnType<typeof vi.fn>).mockReturnValue('/produtos');
    empresa(['site', 'crm', 'blog']);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function passar(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  async function clicarEmPagar() {
    const pagar = screen.getByRole('link', { name: /Pagar fatura/ });
    // O link abre o Asaas em outra aba; aqui só interessa o que a faixa faz.
    pagar.addEventListener('click', (e) => e.preventDefault(), { once: true });
    await act(async () => {
      fireEvent.click(pagar);
    });
  }

  it('depois do clique: "Aguardando a confirmação do pagamento", a linha da espera e "Pagar fatura" ainda visível', async () => {
    await montarCom(resumoEmAtraso);
    await clicarEmPagar();

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent(AGUARDANDO);
    expect(status).toHaveTextContent(LINHA_AGUARDANDO);
    expect(screen.getByRole('link', { name: /Pagar fatura/ })).toHaveAttribute('href', 'https://www.asaas.com/i/abc');
    expect(JSON.parse(sessionStorage.getItem(CHAVE)!)).toEqual({ clicado_em: INICIO, vencimento: '2026-11-05' });
  });

  it('nova consulta aos 15 s; resumo em_dia → "Pagamento confirmado. Obrigado!" (bloqueado: acesso liberado) e "Fechar aviso"', async () => {
    await montarCom(resumoBloqueado);
    await clicarEmPagar();
    expect(resumoMock).toHaveBeenCalledTimes(1);

    resumoMock.mockResolvedValue(resumoEmDia);
    await passar(15_000);
    expect(resumoMock).toHaveBeenCalledTimes(2);

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent('Pagamento confirmado. Obrigado!');
    expect(status).toHaveTextContent('O acesso a Páginas, CRM e blog está liberado.');
    expect(sessionStorage.getItem(CHAVE)).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    });
    expect(screen.queryByRole('region', { name: 'Aviso de cobrança' })).not.toBeInTheDocument();
  });

  it('confirmado vindo de em_atraso: sem a linha do acesso liberado', async () => {
    await montarCom(resumoEmAtraso);
    await clicarEmPagar();

    resumoMock.mockResolvedValue(resumoEmDia);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent('Pagamento confirmado. Obrigado!');
    expect(status).not.toHaveTextContent('está liberado');
  });

  it('parcial (R6): outro vencimento em atraso → volta ao estado normal com a linha da fatura paga acima do texto', async () => {
    // Par real: bloqueado com 31/01 e 28/02 vencidas (01/03); pago o 31/01, em_atraso com 28/02.
    vi.setSystemTime(RELOGIO_DO_PARCIAL);
    await montarCom(resumoBloqueadoAntesDoParcial);
    await clicarEmPagar();

    resumoMock.mockResolvedValue(resumoEmAtrasoDepoisDoParcial);
    await passar(15_000);

    const status = within(faixa()).getByRole('status');
    expect(status).toHaveTextContent(
      'Recebemos o pagamento da fatura de 31/01. Ainda há outra fatura em atraso.' +
        'Sua fatura de R$ 39,90 venceu em 28/02. Pague até 09/03 para não perder o acesso a Páginas, CRM e blog.',
    );
    expect(status).not.toHaveTextContent(AGUARDANDO);
  });

  it('10 min sem confirmar: para, mostra "Ainda não recebemos a confirmação…", "Conferir agora" (uma consulta) e "Pagar fatura"', async () => {
    await montarCom(resumoEmAtraso);
    await clicarEmPagar();

    await passar(10 * 60_000);
    expect(within(faixa()).getByRole('status')).toHaveTextContent(SEM_CONFIRMACAO);
    expect(screen.getByRole('link', { name: /Pagar fatura/ })).toBeInTheDocument();
    expect(sessionStorage.getItem(CHAVE)).toBeNull();

    const consultas = resumoMock.mock.calls.length;
    await passar(60_000);
    expect(resumoMock).toHaveBeenCalledTimes(consultas);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Conferir agora' }));
    });
    expect(resumoMock).toHaveBeenCalledTimes(consultas + 1);
  });

  it('três consultas seguidas com falha: alerta com "Conferir agora"', async () => {
    await montarCom(resumoEmAtraso);
    await clicarEmPagar();

    resumoMock.mockRejectedValue(new Error('Network Error'));
    await passar(30_000);
    expect(screen.queryByText(FALHA_NA_CONSULTA)).not.toBeInTheDocument();

    await passar(15_000);
    expect(screen.getByRole('alert')).toHaveTextContent(FALHA_NA_CONSULTA);
    expect(screen.getByRole('button', { name: 'Conferir agora' })).toBeInTheDocument();
    // A faixa continua com o estado da espera.
    expect(within(faixa()).getByRole('status')).toHaveTextContent(AGUARDANDO);
  });

  it('recarregar a página com a chave guardada retoma "Aguardando…"', async () => {
    sessionStorage.setItem(CHAVE, JSON.stringify({ clicado_em: INICIO - 60_000, vencimento: '2026-11-05' }));
    await montarCom(resumoEmAtraso);
    expect(within(faixa()).getByRole('status')).toHaveTextContent(AGUARDANDO);
  });
});
