import type { ListaDeUsuarios, PapeisDaEmpresa, UsuarioDaEmpresa } from '@/services/usuarios';

// gestao-de-acesso-f3-portal-cliente: dados no formato exato de GET /me/papeis e GET /me/usuarios
// (internal/handler/me_usuarios_handler.go). Empresa com CRM contratado; Blog e Páginas não.

export const papeisDaLoja: PapeisDaEmpresa = {
  ferramentas: [
    {
      id: 'portal',
      nome: 'Portal do Cliente',
      contratada: true,
      papel_mais_alto: 'administrador',
      permissoes: [
        { id: 'portal.empresa.ver', nome: 'Ver a empresa, os produtos e o contrato' },
        { id: 'portal.usuarios.gerir', nome: 'Gerir usuários da empresa' },
        { id: 'portal.contrato.aceitar', nome: 'Aceitar o termo de contratação' },
        { id: 'portal.contrato.cancelar', nome: 'Cancelar o contrato' },
      ],
      papeis: [
        { id: 'administrador', nome: 'Administrador', descricao: '', sistema: true, permissoes: ['portal.empresa.ver', 'portal.usuarios.gerir', 'portal.contrato.aceitar', 'portal.contrato.cancelar'] },
        { id: 'membro', nome: 'Membro', descricao: '', sistema: true, permissoes: ['portal.empresa.ver'] },
      ],
    },
    {
      id: 'crm',
      nome: 'CRM',
      contratada: true,
      papel_mais_alto: 'gestor',
      permissoes: [
        { id: 'crm.lead.ver', nome: 'Ver e buscar leads' },
        { id: 'crm.lead.criar', nome: 'Criar lead' },
        { id: 'crm.lead.editar', nome: 'Editar lead e registrar venda' },
        { id: 'crm.lead.excluir', nome: 'Excluir lead' },
        { id: 'crm.integracoes.gerir', nome: 'Conectar o Google Ads' },
      ],
      papeis: [
        { id: 'gestor', nome: 'Gestor', descricao: '', sistema: true, permissoes: ['crm.lead.ver', 'crm.lead.criar', 'crm.lead.editar', 'crm.lead.excluir', 'crm.integracoes.gerir'] },
        { id: 'vendedor', nome: 'Vendedor', descricao: '', sistema: true, permissoes: ['crm.lead.ver', 'crm.lead.criar', 'crm.lead.editar'] },
        { id: 'sem_acesso', nome: 'Sem acesso', descricao: '', sistema: true, permissoes: [] },
        { id: 'p-aaaaaaaaaaaa', nome: 'Atendente', descricao: 'Só consulta', sistema: false, permissoes: ['crm.lead.ver'] },
      ],
    },
    {
      id: 'blog',
      nome: 'Blog',
      contratada: false,
      papel_mais_alto: 'editor',
      permissoes: [{ id: 'blog.post.ver', nome: 'Ver posts' }],
      papeis: [
        { id: 'editor', nome: 'Editor', descricao: '', sistema: true, permissoes: ['blog.post.ver'] },
        { id: 'sem_acesso', nome: 'Sem acesso', descricao: '', sistema: true, permissoes: [] },
      ],
    },
    {
      id: 'lp',
      nome: 'Páginas',
      contratada: false,
      papel_mais_alto: 'administrador',
      permissoes: [{ id: 'lp.pagina.ver', nome: 'Ver as páginas, o rascunho e o domínio' }],
      papeis: [
        { id: 'administrador', nome: 'Administrador', descricao: '', sistema: true, permissoes: ['lp.pagina.ver'] },
        { id: 'sem_acesso', nome: 'Sem acesso', descricao: '', sistema: true, permissoes: [] },
      ],
    },
  ],
};

function acessos(portal: [string, boolean], crm: [string, boolean]): UsuarioDaEmpresa['acessos'] {
  const admin = portal[0] === 'administrador';
  return {
    portal: { papel: portal[0], implicito: portal[1] },
    crm: { papel: crm[0], implicito: crm[1] },
    blog: { papel: admin ? 'editor' : 'sem_acesso', implicito: true },
    lp: { papel: admin ? 'administrador' : 'sem_acesso', implicito: true },
  };
}

export const ana: UsuarioDaEmpresa = {
  email: 'ana@loja.com',
  nome: 'Ana Souza',
  status: 'ativo',
  criado_em: '2026-10-01T12:00:00Z',
  acessos: acessos(['administrador', false], ['gestor', true]),
};

export const bia: UsuarioDaEmpresa = {
  email: 'bia@loja.com',
  nome: 'Bia Lima',
  status: 'ativo',
  criado_em: '2026-10-02T12:00:00Z',
  acessos: acessos(['membro', false], ['vendedor', false]),
};

export const caio: UsuarioDaEmpresa = {
  email: 'caio@loja.com',
  nome: 'Caio Reis',
  status: 'bloqueado',
  criado_em: '2026-10-03T12:00:00Z',
  acessos: acessos(['membro', true], ['sem_acesso', true]),
};

export const listaDaLoja: ListaDeUsuarios = { usuarios: [bia, caio, ana], limite: { maximo: 5, em_uso: 3 } };
