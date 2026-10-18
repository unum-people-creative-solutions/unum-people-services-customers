import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { listaDaLoja, papeisDaLoja } from '@/test/usuariosFixtures';
import { simularTela } from '@/test/telaLarga';

const servico = vi.hoisted(() => ({ listar: vi.fn(), papeis: vi.fn(), convidar: vi.fn(), atualizar: vi.fn(), remover: vi.fn() }));
vi.mock('@/services/usuarios', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/usuarios')>();
  return { ...real, UsuariosService: servico };
});
const tenant = vi.hoisted(() => ({ activeTenantId: 't-1', activeTenantName: 'Loja da Ana', isLoadingTenants: false }));
vi.mock('@/contexts/TenantContext', () => ({ useTenant: () => tenant }));
vi.mock('@/components/AppHeader', () => ({ default: () => <header>cabeçalho</header> }));

import UsuariosPage from './page';

// gestao-de-acesso-f3-portal-cliente RF-17 a RF-19, CA-10 (blueprint §3).

describe('Página Usuários', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    simularTela(true);
    tenant.activeTenantId = 't-1';
    tenant.isLoadingTenants = false;
    useAuthStore.setState({ session: { email: 'ana@loja.com', token: 'x' }, isAuthenticated: true });
    servico.listar.mockResolvedValue(listaDaLoja);
    servico.papeis.mockResolvedValue(papeisDaLoja);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('carregando, depois título, subtítulo, contador e a lista da empresa ativa', async () => {
    render(<UsuariosPage />);
    expect(screen.getByRole('status', { name: 'Carregando usuários' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Usuários da Loja da Ana' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByText('Quem acessa Loja da Ana e o que cada pessoa pode fazer.')).toBeInTheDocument();
    expect(screen.getByText('3 de 5 usuários do seu plano')).toBeInTheDocument();
    expect(servico.listar).toHaveBeenCalledWith('t-1');
    expect(servico.papeis).toHaveBeenCalledWith('t-1');
    expect(screen.getByRole('button', { name: 'Convidar pessoa' })).toBeEnabled();
  });

  it('sem limite no plano, sem contador', async () => {
    servico.listar.mockResolvedValue({ ...listaDaLoja, limite: { maximo: null, em_uso: 3 } });
    render(<UsuariosPage />);
    await screen.findByRole('table');
    expect(screen.queryByText(/usuários do seu plano/)).not.toBeInTheDocument();
  });

  it('no limite, aviso e Convidar desabilitado com o motivo', async () => {
    servico.listar.mockResolvedValue({ ...listaDaLoja, limite: { maximo: 3, em_uso: 3 } });
    render(<UsuariosPage />);
    await screen.findByRole('table');
    const aviso = 'Você chegou ao limite de 3 usuários do seu plano.';
    expect(screen.getByText(aviso)).toBeInTheDocument();
    const convidar = screen.getByRole('button', { name: 'Convidar pessoa' });
    expect(convidar).toBeDisabled();
    expect(convidar).toHaveAccessibleDescription(aviso);
  });

  it('erro ao carregar: mensagem e Tentar de novo, que recarrega', async () => {
    servico.listar.mockRejectedValueOnce({ response: { status: 500, data: { error: 'interno' } } });
    render(<UsuariosPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os usuários. Tente de novo.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(servico.listar).toHaveBeenCalledTimes(2);
  });

  it('erro nos papéis também é erro de carregamento', async () => {
    servico.papeis.mockRejectedValueOnce(new Error('Network Error'));
    render(<UsuariosPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os usuários. Tente de novo.');
  });

  it('403: sem permissão, sem botões de ação', async () => {
    servico.listar.mockRejectedValue({ response: { status: 403, data: { error: 'forbidden' } } });
    render(<UsuariosPage />);
    expect(await screen.findByText('Você não pode gerir os usuários desta empresa. Fale com um administrador do Portal.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Convidar pessoa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('enquanto a empresa ativa carrega, não busca', () => {
    tenant.isLoadingTenants = true;
    render(<UsuariosPage />);
    expect(servico.listar).not.toHaveBeenCalled();
  });

  it('troca de empresa recarrega a lista', async () => {
    const { rerender } = render(<UsuariosPage />);
    await screen.findByRole('table');
    tenant.activeTenantId = 't-2';
    rerender(<UsuariosPage />);
    await waitFor(() => expect(servico.listar).toHaveBeenLastCalledWith('t-2'));
  });

  it('convidar: abre a caixa, envia, avisa e recarrega', async () => {
    servico.convidar.mockResolvedValue(listaDaLoja.usuarios[0]);
    render(<UsuariosPage />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Convidar pessoa' }));
    const dialogo = screen.getByRole('dialog', { name: 'Convidar pessoa' });
    await userEvent.type(within(dialogo).getByLabelText('Nome'), 'Edu');
    await userEvent.type(within(dialogo).getByLabelText('E-mail'), 'edu@loja.com');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar convite' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Convite enviado para edu@loja.com.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(servico.listar).toHaveBeenCalledTimes(2));
  });

  it('editar a própria conta: Portal desabilitado', async () => {
    render(<UsuariosPage />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Ana Souza' }));
    const dialogo = screen.getByRole('dialog', { name: 'Ana Souza' });
    expect(within(dialogo).getByLabelText('Portal do Cliente')).toBeDisabled();
  });

  it('editar outra pessoa: salva, avisa e recarrega', async () => {
    servico.atualizar.mockResolvedValue(listaDaLoja.usuarios[0]);
    render(<UsuariosPage />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Editar Bia Lima' }));
    const dialogo = screen.getByRole('dialog', { name: 'Bia Lima' });
    expect(within(dialogo).getByLabelText('Portal do Cliente')).toBeEnabled();
    await userEvent.selectOptions(within(dialogo).getByLabelText('CRM'), 'gestor');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar alterações' }));
    expect(servico.atualizar).toHaveBeenCalledWith('bia@loja.com', { acessos: { crm: 'gestor' } }, 't-1');
    expect(await screen.findByRole('status')).toHaveTextContent('Alterações salvas.');
    await waitFor(() => expect(servico.listar).toHaveBeenCalledTimes(2));
  });

  it('remover: confirma, avisa e recarrega', async () => {
    servico.remover.mockResolvedValue(undefined);
    render(<UsuariosPage />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Remover Bia Lima' }));
    const dialogo = screen.getByRole('dialog', { name: 'Remover Bia Lima?' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Remover' }));
    expect(servico.remover).toHaveBeenCalledWith('bia@loja.com', 't-1');
    expect(await screen.findByRole('status')).toHaveTextContent('Bia Lima não tem mais acesso a Loja da Ana.');
    await waitFor(() => expect(servico.listar).toHaveBeenCalledTimes(2));
  });

  it('fechar a caixa sem salvar não recarrega nem avisa', async () => {
    render(<UsuariosPage />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Convidar pessoa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(servico.listar).toHaveBeenCalledTimes(1);
  });
});
