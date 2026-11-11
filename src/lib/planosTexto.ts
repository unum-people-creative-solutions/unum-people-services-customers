// Textos da troca de plano no Portal (cobranca-e-plano-do-cliente RF5-01, BP-T §11.2,
// §11.3, §11.5, §11.7).
import type { MotivoIndisponivel, PlanoParaTroca } from '@/types/planos';

function paginasNoTexto(paginas: number): string {
  return `até ${paginas} ${paginas === 1 ? 'página' : 'páginas'}`;
}

function usuariosNoTexto(usuarios: number | null): string {
  if (usuarios === null) return 'usuários sem limite';
  return `até ${usuarios} ${usuarios === 1 ? 'usuário' : 'usuários'}`;
}

function temMaisUsuarios(atual: PlanoParaTroca, novo: PlanoParaTroca): boolean {
  if (novo.usuarios === null) return atual.usuarios !== null;
  return atual.usuarios !== null && novo.usuarios > atual.usuarios;
}

// Só o que o plano novo tem de melhor que o atual.
// SPEC_DEVIATION: T81 diz "na ordem serviços → domínio → marca → páginas → usuários", mas o
// valor esperado do mesmo T81 (e a frase do T85) põe páginas antes da marca. Vale o valor
// literal: serviços → domínio → páginas → marca → usuários.
export function diferencasDoPlano(atual: PlanoParaTroca, novo: PlanoParaTroca): string[] {
  const diferencas: string[] = [];
  if (novo.servicos.includes('crm') && !atual.servicos.includes('crm')) diferencas.push('CRM');
  if (novo.servicos.includes('blog') && !atual.servicos.includes('blog')) diferencas.push('blog');
  if (atual.sem_dominio_proprio && !novo.sem_dominio_proprio) diferencas.push('domínio próprio');
  if (novo.paginas > atual.paginas) diferencas.push(paginasNoTexto(novo.paginas));
  if (novo.sem_marca && !atual.sem_marca) diferencas.push('sem a assinatura “Feito com Unum People”');
  if (temMaisUsuarios(atual, novo)) diferencas.push(usuariosNoTexto(novo.usuarios));
  return diferencas;
}

export function fraseDasDiferencas(atual: PlanoParaTroca, novo: PlanoParaTroca): string {
  const diferencas = diferencasDoPlano(atual, novo);
  if (diferencas.length <= 1) return diferencas.join('');
  return `${diferencas.slice(0, -1).join(', ')} e ${diferencas[diferencas.length - 1]}`;
}

export function textoDoIndisponivel(motivo: MotivoIndisponivel, plano: PlanoParaTroca): string {
  switch (motivo) {
    case 'dominio_ligado':
      return 'Este plano não tem domínio próprio, e sua conta tem um domínio ligado. Remova o domínio em Páginas para escolher este plano.';
    case 'paginas_acima_do_limite':
      return `Sua conta tem mais páginas do que este plano inclui (${plano.paginas}). Apague páginas para escolher este plano.`;
    case 'usuarios_acima_do_limite':
      return `Sua conta tem mais usuários do que este plano permite (${plano.usuarios ?? 'sem limite'}). Remova pessoas em Usuários para escolher este plano.`;
  }
}
