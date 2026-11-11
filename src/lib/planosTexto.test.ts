import { describe, it, expect } from 'vitest';
import { diferencasDoPlano, fraseDasDiferencas, textoDoIndisponivel } from './planosTexto';
import { basicoDowngrade, captacaoUpgrade, presencaAtual } from '@/test/planosFixtures';
import type { PlanoParaTroca } from '@/types/planos';

// spec: cobranca-e-plano-do-cliente RF5-01, T81 (BP-T §11.2, §11.3, §11.5, §11.7).

describe('diferencasDoPlano', () => {
  it('Presença → Captação: CRM, até 5 páginas, sem a assinatura e até 10 usuários, nessa ordem', () => {
    expect(diferencasDoPlano(presencaAtual, captacaoUpgrade)).toEqual([
      'CRM',
      'até 5 páginas',
      'sem a assinatura “Feito com Unum People”',
      'até 10 usuários',
    ]);
  });

  it('só o que é melhor que o atual: nada do que o atual já tem ou tem mais', () => {
    expect(diferencasDoPlano(captacaoUpgrade, presencaAtual)).toEqual([]);
    expect(diferencasDoPlano(presencaAtual, presencaAtual)).toEqual([]);
  });

  it('domínio próprio entra depois dos serviços; blog e usuários sem limite', () => {
    const maior: PlanoParaTroca = {
      ...captacaoUpgrade,
      servicos: ['site', 'blog'],
      sem_marca: false,
      paginas: 1,
      usuarios: null,
    };
    expect(diferencasDoPlano(basicoDowngrade, maior)).toEqual(['blog', 'domínio próprio', 'usuários sem limite']);
  });
});

describe('fraseDasDiferencas', () => {
  it('lista com vírgulas e "e" antes da última', () => {
    expect(fraseDasDiferencas(presencaAtual, captacaoUpgrade)).toBe(
      'CRM, até 5 páginas, sem a assinatura “Feito com Unum People” e até 10 usuários',
    );
  });

  it('uma diferença só: sem vírgula nem "e"', () => {
    expect(fraseDasDiferencas(presencaAtual, { ...presencaAtual, paginas: 5 })).toBe('até 5 páginas');
  });
});

describe('textoDoIndisponivel (BP-T §11.3)', () => {
  it('domínio ligado', () => {
    expect(textoDoIndisponivel('dominio_ligado', basicoDowngrade)).toBe(
      'Este plano não tem domínio próprio, e sua conta tem um domínio ligado. Remova o domínio em Páginas para escolher este plano.',
    );
  });

  it('páginas acima do limite, com o limite do plano', () => {
    expect(textoDoIndisponivel('paginas_acima_do_limite', captacaoUpgrade)).toBe(
      'Sua conta tem mais páginas do que este plano inclui (5). Apague páginas para escolher este plano.',
    );
  });

  it('usuários acima do limite, com o limite do plano', () => {
    expect(textoDoIndisponivel('usuarios_acima_do_limite', captacaoUpgrade)).toBe(
      'Sua conta tem mais usuários do que este plano permite (10). Remova pessoas em Usuários para escolher este plano.',
    );
  });
});
