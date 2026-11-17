import type { DiaDoGrafico } from "@/types/visitas";

// metricas-de-visitas MV-76 e MV-78: barras em CSS, sem biblioteca (E-P7). A data sai do
// texto AAAA-MM-DD, sem passar por Date (nada de fuso deslocando o dia).
function diaEMes(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function dataCompleta(dia: string): string {
  return `${diaEMes(dia)}/${dia.slice(0, 4)}`;
}

function numero(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

export default function GraficoDeVisitas({ dias }: { dias: DiaDoGrafico[] }) {
  const maior = Math.max(0, ...dias.map((d) => d.visitas));
  const meio = Math.floor(dias.length / 2);
  const rotulos = dias.length > 0 ? [0, meio, dias.length - 1] : [];

  return (
    <figure className="flex flex-col gap-3" aria-labelledby="grafico-de-visitas-titulo">
      <figcaption id="grafico-de-visitas-titulo" className="text-base font-bold text-gray-900">
        Visitas por dia
      </figcaption>
      <div aria-hidden="true">
        <div className="flex items-end gap-px h-40 border-b border-gray-200">
          {dias.map((d) => (
            <div
              key={d.dia}
              className="flex-1 min-w-0 bg-brand-blue rounded-t-sm"
              style={{ height: d.visitas > 0 && maior > 0 ? `${(d.visitas * 100) / maior}%` : "2px" }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          {rotulos.map((i) => (
            <span key={dias[i].dia}>{diaEMes(dias[i].dia)}</span>
          ))}
        </div>
      </div>
      {/* sr-only no div: tabela ignora overflow e, com a classe nela, estica a página. */}
      <div className="sr-only">
        <table>
          <caption>Visitas e toques por dia</caption>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Visitas</th>
              <th scope="col">Toques</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.dia}>
                <th scope="row">{dataCompleta(d.dia)}</th>
                <td>{numero(d.visitas)}</td>
                <td>{numero(d.toques)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
