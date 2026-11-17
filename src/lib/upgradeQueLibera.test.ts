import { describe, expect, it } from 'vitest';
import type { PlanoParaTroca } from '@/types/planos';
import { basicoDowngrade, captacaoUpgrade, presencaAtual } from '@/test/planosFixtures';
import { upgradeQueLibera } from './upgradeQueLibera';

// spec: metricas-de-visitas MV-75, T61, CA-MV-37 (TASK-PORTAL-503).

const temVisitas = (p: PlanoParaTroca) => p.metricas_de_visitas;
const temCrm = (p: PlanoParaTroca) => p.servicos.includes('crm');

// Cliente no Básico: os dois de cima são upgrades.
const basicoAtual: PlanoParaTroca = { ...basicoDowngrade, direcao: 'atual' };
const presencaUpgrade: PlanoParaTroca = { ...presencaAtual, direcao: 'upgrade' };

describe('upgradeQueLibera (T61)', () => {
  it('devolve o upgrade mais barato que passa no predicado, em qualquer ordem da lista', () => {
    expect(upgradeQueLibera([basicoAtual, captacaoUpgrade, presencaUpgrade], temVisitas)).toBe(presencaUpgrade);
    expect(upgradeQueLibera([captacaoUpgrade, basicoAtual, presencaUpgrade], temVisitas)).toBe(presencaUpgrade);
  });

  it('pula o upgrade mais barato quando ele não passa no predicado', () => {
    expect(upgradeQueLibera([basicoAtual, presencaUpgrade, captacaoUpgrade], temCrm)).toBe(captacaoUpgrade);
  });

  it('null sem lista (planos ilegíveis)', () => {
    expect(upgradeQueLibera(null, temVisitas)).toBeNull();
  });

  it('null quando nenhum upgrade passa no predicado', () => {
    const presencaSemVisitas: PlanoParaTroca = { ...presencaUpgrade, metricas_de_visitas: false };
    const captacaoSemVisitas: PlanoParaTroca = { ...captacaoUpgrade, metricas_de_visitas: false };
    expect(upgradeQueLibera([basicoAtual, presencaSemVisitas, captacaoSemVisitas], temVisitas)).toBeNull();
  });

  it('o item atual nunca volta, mesmo passando no predicado', () => {
    expect(upgradeQueLibera([presencaAtual], temVisitas)).toBeNull();
  });

  it('downgrade nunca volta, mesmo mais barato e passando no predicado', () => {
    const basicoComVisitas: PlanoParaTroca = { ...basicoDowngrade, metricas_de_visitas: true };
    expect(upgradeQueLibera([presencaAtual, basicoComVisitas], temVisitas)).toBeNull();
  });
});
