import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import dados30 from '@/services/__fixtures__/visitas/me-visitas-30.json';
import dados7Vazio from '@/services/__fixtures__/visitas/me-visitas-7-vazio.json';
import GraficoDeVisitas from './GraficoDeVisitas';

// spec: metricas-de-visitas MV-76, MV-78 (TASK-PORTAL-506), com os `dias` de
// me-visitas-30.json (cópia do contrato da API).

describe('GraficoDeVisitas', () => {
  it('é uma figura com o nome "Visitas por dia"', () => {
    render(<GraficoDeVisitas dias={dados30.dias} />);
    expect(screen.getByRole('figure', { name: 'Visitas por dia' })).toBeInTheDocument();
  });

  it('a tabela "Visitas e toques por dia" tem as colunas Dia, Visitas e Toques e uma linha por dia', () => {
    render(<GraficoDeVisitas dias={dados30.dias} />);
    const tabela = screen.getByRole('table', { name: 'Visitas e toques por dia' });
    const [cabecalho, corpo] = within(tabela).getAllByRole('rowgroup');
    expect(within(cabecalho).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Dia',
      'Visitas',
      'Toques',
    ]);
    expect(within(corpo).getAllByRole('row')).toHaveLength(30);
  });

  it('a linha de 03/11/2026 tem 12 visitas e 2 toques; a primeira e a última são 19/10 e 17/11', () => {
    render(<GraficoDeVisitas dias={dados30.dias} />);
    const tabela = screen.getByRole('table', { name: 'Visitas e toques por dia' });
    expect(within(tabela).getByRole('row', { name: '03/11/2026 12 2' })).toBeInTheDocument();
    const linhas = within(within(tabela).getAllByRole('rowgroup')[1]).getAllByRole('row');
    expect(linhas[0]).toHaveAccessibleName('19/10/2026 5 0');
    expect(linhas[29]).toHaveAccessibleName('17/11/2026 10 1');
  });

  it('rótulos de data só no primeiro dia, no do meio (Math.floor(30 / 2)) e no último', () => {
    render(<GraficoDeVisitas dias={dados30.dias} />);
    expect(screen.getByText('19/10')).toBeInTheDocument();
    expect(screen.getByText('03/11')).toBeInTheDocument();
    expect(screen.getByText('17/11')).toBeInTheDocument();
    expect(screen.queryByText('20/10')).not.toBeInTheDocument();
    expect(screen.queryByText('02/11')).not.toBeInTheDocument();
    expect(screen.queryByText('16/11')).not.toBeInTheDocument();
  });

  it('com número ímpar de dias, o rótulo do meio é Math.floor(7 / 2): 14/11, e não 15/11', () => {
    render(<GraficoDeVisitas dias={dados7Vazio.dias} />);
    expect(screen.getByText('11/11')).toBeInTheDocument();
    expect(screen.getByText('14/11')).toBeInTheDocument();
    expect(screen.getByText('17/11')).toBeInTheDocument();
    expect(screen.queryByText('15/11')).not.toBeInTheDocument();
  });
});
