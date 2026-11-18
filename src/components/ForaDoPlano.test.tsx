import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { captacaoUpgrade } from '@/test/planosFixtures';
import ForaDoPlano from './ForaDoPlano';

// spec: metricas-de-visitas MV-75 (TASK-PORTAL-504): o mesmo HTML e texto dos cartões
// de CRM e Blog de /produtos.

describe('ForaDoPlano', () => {
  it('com plano: "Disponível no plano X" e o link "Ver planos" para /plano/mudar', () => {
    render(<ForaDoPlano plano={captacaoUpgrade} />);
    expect(screen.getByText('Disponível no plano Captação')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver planos' })).toHaveAttribute('href', '/plano/mudar');
    expect(screen.queryByText('Não incluso neste plano')).not.toBeInTheDocument();
  });

  it('sem plano: "Não incluso neste plano", sem link', () => {
    render(<ForaDoPlano plano={null} />);
    expect(screen.getByText('Não incluso neste plano')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/Disponível no plano/)).not.toBeInTheDocument();
  });
});
