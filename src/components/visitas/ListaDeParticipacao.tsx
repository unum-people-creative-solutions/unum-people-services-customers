import type { AparelhoDaVisita, OrigemDaVisita } from "@/types/visitas";

// metricas-de-visitas MV-77 e MV-78: a parte de cada origem e de cada aparelho, sempre na
// mesma ordem, com número em pt-BR, percentual inteiro e barra.
const ORIGENS: [OrigemDaVisita, string][] = [
  ["google", "Google"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["whatsapp", "WhatsApp"],
  ["outros", "Outros sites"],
  ["direto", "Direto ou não identificado"],
];

const APARELHOS: [AparelhoDaVisita, string][] = [
  ["celular", "Celular"],
  ["computador", "Computador"],
];

function Lista({ id, titulo, linhas }: { id: string; titulo: string; linhas: [string, number][] }) {
  const total = linhas.reduce((soma, [, valor]) => soma + valor, 0);
  return (
    <section className="flex flex-col gap-3">
      <h3 id={id} className="text-base font-bold text-gray-900">
        {titulo}
      </h3>
      <ul aria-labelledby={id} className="flex flex-col gap-3">
        {linhas.map(([rotulo, valor]) => {
          const percentual = total > 0 ? Math.round((valor * 100) / total) : 0;
          return (
            <li key={rotulo} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-700">{rotulo}</span>
                <span className="flex items-baseline gap-2 shrink-0">
                  <span className="font-bold text-gray-900">{valor.toLocaleString("pt-BR")}</span>
                  <span className="text-gray-500 w-10 text-right">{`${percentual}%`}</span>
                </span>
              </div>
              <div aria-hidden="true" className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-blue" style={{ width: `${percentual}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ListaDeParticipacao({
  origens,
  aparelhos,
}: {
  origens: Record<OrigemDaVisita, number>;
  aparelhos: Record<AparelhoDaVisita, number>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Lista id="visitas-origens" titulo="De onde vieram" linhas={ORIGENS.map(([chave, rotulo]) => [rotulo, origens[chave]])} />
      <Lista id="visitas-aparelhos" titulo="Aparelho" linhas={APARELHOS.map(([chave, rotulo]) => [rotulo, aparelhos[chave]])} />
    </div>
  );
}
