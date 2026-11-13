'use client';

// dados-do-negocio: seção "Você" em /meus-dados (RF-DNG-30, TASK-FE-301).
import { useState, useId } from 'react';
import { buildForgotPasswordUrl } from '@/lib/pkce';
import { PerfilService } from '@/services/meusDados';
import { useAuthStore } from '@/store/authStore';
import type { Perfil } from '@/types/meusDados';

export interface SecaoVoceProps {
  perfilInicial: Perfil;
  onSalvo?: (perfil: Perfil) => void;
}

export default function SecaoVoce({ perfilInicial, onSalvo }: SecaoVoceProps) {
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial);
  const [nome, setNome] = useState(perfilInicial.nome ?? '');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const idNome = useId();
  const atualizarNomeStore = useAuthStore((s) => s.atualizarNome);

  const urlTrocarSenha = buildForgotPasswordUrl();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;

    setSalvando(true);
    setSucesso(false);
    setErroNome(null);
    setErroGeral(null);

    try {
      const atualizado = await PerfilService.salvarNome(nome);
      setPerfil(atualizado);
      setSucesso(true);
      atualizarNomeStore(atualizado.nome);
      if (onSalvo) onSalvo(atualizado);
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { motivo?: unknown; detalhe?: unknown } } })?.response;
      if (response?.status === 400) {
        const motivo = (response.data?.motivo || response.data?.detalhe) as string | undefined;
        setErroNome(motivo || 'Nome inválido. Deve ter entre 2 e 80 caracteres.');
      } else {
        setErroGeral('Não foi possível salvar agora. Tente de novo em alguns minutos.');
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Você</h2>

      {sucesso && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium"
        >
          Dados salvos.
        </div>
      )}

      {erroGeral && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium"
        >
          {erroGeral}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nome */}
          <div>
            <label htmlFor={idNome} className="block text-sm font-semibold text-gray-700 mb-1">
              Nome
            </label>
            <input
              id={idNome}
              type="text"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                if (erroNome) setErroNome(null);
              }}
              aria-invalid={erroNome ? 'true' : undefined}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500"
            />
            {erroNome && <p className="mt-1 text-xs text-rose-600 font-medium">{erroNome}</p>}
          </div>

          {/* E-mail (Somente leitura) */}
          <div>
            <span className="block text-sm font-semibold text-gray-700 mb-1">E-mail</span>
            <p className="text-sm text-gray-900 font-medium py-1">{perfil.email || '—'}</p>
            <p className="text-xs text-gray-500">É o seu login.</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <a
            href={urlTrocarSenha}
            className="text-sm font-semibold text-brand-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg"
          >
            Trocar senha
          </a>

          <button
            type="submit"
            disabled={salvando}
            className="bg-brand-blue text-white rounded-xl font-bold py-2.5 px-5 text-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>

      {/* Suas empresas */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <h3 className="text-base font-bold text-gray-900 mb-4">Suas empresas</h3>
        {perfil.empresas && perfil.empresas.length > 0 ? (
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
            {perfil.empresas.map((empresa) => (
              <div
                key={empresa.id}
                className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition"
              >
                <span className="text-sm font-medium text-gray-900">{empresa.nome_negocio}</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-700">
                  {empresa.papel_portal}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Nenhuma empresa associada.</p>
        )}
      </div>
    </section>
  );
}
