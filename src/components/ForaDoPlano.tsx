import { ArrowRight, Lock } from "lucide-react";
import type { PlanoParaTroca } from "@/types/planos";

// cobranca-e-plano-do-cliente RF5-03 e metricas-de-visitas MV-75: o upgrade que libera
// a ferramenta, ou "Não incluso neste plano" quando não há (cartões de /produtos e /visitas).
export default function ForaDoPlano({ plano }: { plano: PlanoParaTroca | null }) {
  if (!plano) {
    return (
      <div className="w-full bg-gray-100 text-gray-400 border border-gray-200 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
        <Lock size={14} />
        Não incluso neste plano
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-700 text-center">{`Disponível no plano ${plano.nome}`}</p>
      <a
        href="/plano/mudar"
        className="w-full bg-white border border-brand-blue text-brand-blue py-2.5 px-4 rounded-xl font-bold hover:bg-blue-50 transition flex items-center justify-center gap-2 text-sm"
      >
        Ver planos
        <ArrowRight size={16} />
      </a>
    </div>
  );
}
