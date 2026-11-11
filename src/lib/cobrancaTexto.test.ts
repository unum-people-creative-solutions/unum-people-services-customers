import { describe, it, expect, afterEach } from 'vitest';
import { formatarData, formatarReais, ferramentasCitadas, nomeDaSituacao } from './cobrancaTexto';
import type { ResumoDeCobranca, SituacaoDeCobranca } from '@/types/cobranca';
import { resumoEmAtraso } from '@/test/cobrancaFixtures';

// spec: cobranca-e-plano-do-cliente RF2-21, RF2-22, RF2-23, RF2-34 (tabela de nomes).

const tzOriginal = process.env.TZ;

afterEach(() => {
  process.env.TZ = tzOriginal;
});

describe('formatarData (RF2-21, DV-16)', () => {
  it('"2026-11-05" vira "05/11" com TZ=UTC e com TZ=America/Sao_Paulo', () => {
    process.env.TZ = 'UTC';
    expect(formatarData('2026-11-05')).toBe('05/11');
    expect(formatarData('2027-01-04')).toBe('04/01');

    process.env.TZ = 'America/Sao_Paulo';
    expect(formatarData('2026-11-05')).toBe('05/11');
    expect(formatarData('2027-01-04')).toBe('04/01');
  });
});

describe('formatarReais (RF2-22)', () => {
  it('39.9 vira "R$ 39,90" e 1198.8 vira "R$ 1.198,80"', () => {
    expect(formatarReais(39.9)).toBe('R$ 39,90');
    expect(formatarReais(1198.8)).toBe('R$ 1.198,80');
  });
});

describe('ferramentasCitadas (RF2-23)', () => {
  it('só Páginas', () => {
    expect(ferramentasCitadas(['site'])).toBe('Páginas');
    expect(ferramentasCitadas([])).toBe('Páginas');
  });

  it('Páginas e CRM', () => {
    expect(ferramentasCitadas(['site', 'crm'])).toBe('Páginas e CRM');
  });

  it('Páginas e blog', () => {
    expect(ferramentasCitadas(['blog', 'lp'])).toBe('Páginas e blog');
  });

  it('Páginas, CRM e blog', () => {
    expect(ferramentasCitadas(['crm', 'blog', 'lp'])).toBe('Páginas, CRM e blog');
    expect(ferramentasCitadas(['site', 'crm', 'blog'])).toBe('Páginas, CRM e blog');
  });
});

describe('nomeDaSituacao (RF2-34)', () => {
  const comSituacao = (situacao: SituacaoDeCobranca): ResumoDeCobranca => ({ ...resumoEmAtraso, situacao });

  it.each([
    ['em_dia', 'Em dia'],
    ['em_atraso', 'Fatura em atraso'],
    ['bloqueado', 'Acesso bloqueado'],
    ['fora_do_ar', 'Fora do ar'],
    ['pausada', 'Pausada'],
    ['cancelada', 'Cancelada'],
  ] as const)('%s mostra "%s"', (situacao, nome) => {
    expect(nomeDaSituacao(comSituacao(situacao), 'ATIVO')).toBe(nome);
  });

  it.each([
    ['AGUARDANDO_ATIVACAO', 'Aguardando o primeiro pagamento'],
    ['PENDENTE_ASAAS', 'Em ativação'],
    ['SUSPENSO', 'Suspensa'],
    ['EXCLUINDO', 'Cancelada'],
    ['QUALQUER_OUTRO', 'Fale com a gente'],
    ['', 'Fale com a gente'],
  ])('outra com tenant.status %s mostra "%s"', (status, nome) => {
    expect(nomeDaSituacao(comSituacao('outra'), status)).toBe(nome);
  });
});
