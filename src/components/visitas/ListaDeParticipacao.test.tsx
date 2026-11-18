import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import dados30 from '@/services/__fixtures__/visitas/me-visitas-30.json';
import ListaDeParticipacao from './ListaDeParticipacao';

// spec: metricas-de-visitas MV-77, MV-78 (TASK-PORTAL-507), com `origens` e `aparelhos` de
// me-visitas-30.json. Percentual = Math.round(valor × 100 / total), total 214.

// Cada item da lista, na ordem, tem o rótulo, o número e o percentual como textos próprios.
function conferir(nome: string, esperado: [string, string, string][]) {
  const itens = within(screen.getByRole('list', { name: nome })).getAllByRole('listitem');
  expect(itens).toHaveLength(esperado.length);
  esperado.forEach(([rotulo, numero, percentual], i) => {
    expect(within(itens[i]).getByText(rotulo)).toBeInTheDocument();
    expect(within(itens[i]).getByText(numero)).toBeInTheDocument();
    expect(within(itens[i]).getByText(percentual)).toBeInTheDocument();
  });
}

describe('ListaDeParticipacao', () => {
  it('"De onde vieram": seis linhas, nesta ordem, com rótulo, número e percentual', () => {
    render(<ListaDeParticipacao origens={dados30.origens} aparelhos={dados30.aparelhos} />);
    expect(screen.getByRole('heading', { level: 3, name: 'De onde vieram' })).toBeInTheDocument();
    conferir('De onde vieram', [
      ['Google', '80', '37%'],
      ['Instagram', '61', '29%'],
      ['Facebook', '4', '2%'],
      ['WhatsApp', '2', '1%'],
      ['Outros sites', '9', '4%'],
      ['Direto ou não identificado', '58', '27%'],
    ]);
  });

  it('"Aparelho": Celular e Computador, com número e percentual', () => {
    render(<ListaDeParticipacao origens={dados30.origens} aparelhos={dados30.aparelhos} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Aparelho' })).toBeInTheDocument();
    conferir('Aparelho', [
      ['Celular', '170', '79%'],
      ['Computador', '44', '21%'],
    ]);
  });

  it('números em pt-BR (1.234)', () => {
    render(
      <ListaDeParticipacao
        origens={{ ...dados30.origens, google: 1234 }}
        aparelhos={{ celular: 1234, computador: 0 }}
      />,
    );
    expect(within(screen.getByRole('list', { name: 'De onde vieram' })).getAllByRole('listitem')[0]).toHaveTextContent(
      /^Google\s*1\.234\s*90%$/,
    );
    conferir('Aparelho', [
      ['Celular', '1.234', '100%'],
      ['Computador', '0', '0%'],
    ]);
  });
});
