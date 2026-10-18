'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, UserPlus } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import ListaDeUsuarios from '@/components/usuarios/ListaDeUsuarios';
import RemoverUsuarioDialog from '@/components/usuarios/RemoverUsuarioDialog';
import UsuarioDialog from '@/components/usuarios/UsuarioDialog';
import { useTenant } from '@/contexts/TenantContext';
import {
  erroDaApi,
  UsuariosService,
  type ListaDeUsuarios as ListaPayload,
  type UsuarioDaEmpresa,
} from '@/services/usuarios';
import { useAuthStore } from '@/store/authStore';

type PapeisDaEmpresa = Awaited<ReturnType<typeof UsuariosService.papeis>>;

type DialogoAberto =
  | { tipo: 'convidar' }
  | { tipo: 'editar'; usuario: UsuarioDaEmpresa }
  | { tipo: 'remover'; usuario: UsuarioDaEmpresa };

const ID_AVISO_LIMITE = 'aviso-limite-usuarios';

function mesmoEmail(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

// Convidado guardado com a empresa em que foi convidado (Verifier da 1b, G2).
type Pendente = { tenantId: string; usuario: UsuarioDaEmpresa };

/** Pendentes da empresa cujo e-mail a lista ainda não trouxe (gestao-de-acesso-f1b RF-04). */
function pendentesAindaForaDaLista(
  pendentes: Pendente[],
  usuarios: UsuarioDaEmpresa[],
  tenantId: string,
): Pendente[] {
  return pendentes.filter(
    (pendente) =>
      pendente.tenantId === tenantId &&
      !usuarios.some((usuario) => mesmoEmail(usuario.email, pendente.usuario.email)),
  );
}

export default function UsuariosPage() {
  const { activeTenantId, activeTenantName, isLoadingTenants } = useTenant();
  const emailLogado = useAuthStore((s) => s.session?.email ?? '');

  const [lista, setLista] = useState<ListaPayload | null>(null);
  const [papeis, setPapeis] = useState<PapeisDaEmpresa | null>(null);
  const [erro, setErro] = useState<'proibido' | 'geral' | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // gestao-de-acesso-f1b RF-04: convidados ainda não vistos no índice eventualmente consistente.
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const seqRef = useRef(0);

  const [tenantVisto, setTenantVisto] = useState(activeTenantId);
  if (activeTenantId !== tenantVisto) {
    setTenantVisto(activeTenantId);
    setLista(null);
    setPapeis(null);
    setErro(null);
    setDialogo(null);
    setPendentes([]);
  } else if (lista !== null) {
    const restantes = pendentesAindaForaDaLista(pendentes, lista.usuarios, activeTenantId);
    if (restantes.length !== pendentes.length) {
      setPendentes(restantes);
    }
  }

  useEffect(() => {
    if (isLoadingTenants || !activeTenantId) return;

    const seq = ++seqRef.current;
    const tenantId = activeTenantId;
    let cancelado = false;
    setErro(null);

    void (async () => {
      try {
        const [listaResp, papeisResp] = await Promise.all([
          UsuariosService.listar(tenantId),
          UsuariosService.papeis(tenantId),
        ]);
        if (cancelado || seq !== seqRef.current) return;
        setLista(listaResp);
        setPapeis(papeisResp);
      } catch (err: unknown) {
        if (cancelado || seq !== seqRef.current) return;
        setLista(null);
        setPapeis(null);
        setErro(erroDaApi(err).status === 403 ? 'proibido' : 'geral');
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [isLoadingTenants, activeTenantId, tentativa]);

  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(id);
  }, [aviso]);

  function fecharDialogo() {
    setDialogo(null);
  }

  // A empresa vai fixada quando a caixa abre: um convite que responde depois da
  // troca de empresa fica guardado na empresa certa.
  const aoConcluirNa = (tenantId: string) => (mensagem: string, convidado?: UsuarioDaEmpresa) => {
    if (convidado) {
      setPendentes((atuais) =>
        atuais.some((p) => p.tenantId === tenantId && mesmoEmail(p.usuario.email, convidado.email))
          ? atuais
          : [...atuais, { tenantId, usuario: convidado }],
      );
    }
    aoConcluir(mensagem);
  };

  function aoConcluir(mensagem: string) {
    setDialogo(null);
    setAviso(mensagem);
    // Recarrega pela mesma carga do efeito; a lista atual fica na tela até a nova chegar.
    setTentativa((n) => n + 1);
  }

  const nomeDaEmpresa = activeTenantName || 'a empresa';
  const noLimite =
    lista !== null && lista.limite.maximo !== null && lista.limite.em_uso >= lista.limite.maximo;
  // Lista da API primeiro; pendentes só enquanto o índice não os trouxer. O contador segue lista.limite.
  const usuariosExibidos =
    lista === null
      ? []
      : [
          ...lista.usuarios,
          ...pendentesAindaForaDaLista(pendentes, lista.usuarios, activeTenantId).map((p) => p.usuario),
        ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {erro === 'proibido' ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <p className="text-gray-800">
              Você não pode gerir os usuários desta empresa. Fale com um administrador do Portal.
            </p>
          </div>
        ) : erro === 'geral' ? (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex gap-3 items-start shadow-sm"
          >
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} aria-hidden="true" />
            <div>
              <h3 className="font-bold text-red-800 text-sm">Erro</h3>
              <p className="text-sm text-red-700 mt-1">
                Não foi possível carregar os usuários. Tente de novo.
              </p>
              <button
                type="button"
                onClick={() => setTentativa((n) => n + 1)}
                className="mt-3 text-sm font-bold text-red-800 underline"
              >
                Tentar de novo
              </button>
            </div>
          </div>
        ) : !lista || !papeis || !activeTenantId ? (
          <div role="status" aria-label="Carregando usuários" className="space-y-3">
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-gray-900">Usuários</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Quem acessa {nomeDaEmpresa} e o que cada pessoa pode fazer.
                </p>
                {lista.limite.maximo !== null &&
                  (noLimite ? (
                    <p id={ID_AVISO_LIMITE} className="text-sm text-amber-700 mt-2">
                      Você chegou ao limite de {lista.limite.maximo} usuários do seu plano.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-2">
                      {lista.limite.em_uso} de {lista.limite.maximo} usuários do seu plano
                    </p>
                  ))}
              </div>
              <button
                type="button"
                disabled={noLimite}
                aria-describedby={noLimite ? ID_AVISO_LIMITE : undefined}
                onClick={() => setDialogo({ tipo: 'convidar' })}
                className="inline-flex items-center justify-center gap-2 shrink-0 bg-brand-blue text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
              >
                <UserPlus aria-hidden="true" size={18} />
                Convidar pessoa
              </button>
            </div>

            <ListaDeUsuarios
              usuarios={usuariosExibidos}
              papeis={papeis}
              emailLogado={emailLogado}
              nomeDaEmpresa={nomeDaEmpresa}
              onEditar={(usuario) => setDialogo({ tipo: 'editar', usuario })}
              onRemover={(usuario) => setDialogo({ tipo: 'remover', usuario })}
            />

            {dialogo?.tipo === 'convidar' ? (
              <UsuarioDialog
                modo="convidar"
                papeis={papeis}
                tenantId={activeTenantId}
                maximo={lista.limite.maximo}
                onFechar={fecharDialogo}
                onSalvo={aoConcluirNa(activeTenantId)}
              />
            ) : null}

            {dialogo?.tipo === 'editar' ? (
              <UsuarioDialog
                key={dialogo.usuario.email}
                modo="editar"
                usuario={dialogo.usuario}
                ehVoce={dialogo.usuario.email.toLowerCase() === emailLogado.toLowerCase()}
                papeis={papeis}
                tenantId={activeTenantId}
                maximo={lista.limite.maximo}
                onFechar={fecharDialogo}
                onSalvo={aoConcluirNa(activeTenantId)}
              />
            ) : null}

            {dialogo?.tipo === 'remover' ? (
              <RemoverUsuarioDialog
                usuario={dialogo.usuario}
                nomeDaEmpresa={nomeDaEmpresa}
                tenantId={activeTenantId}
                onFechar={fecharDialogo}
                onRemovido={(mensagem) => {
                  // Quem ainda estava pendente sai da tela junto (Verifier da 1b, G1).
                  const removido = dialogo.usuario.email;
                  setPendentes((atuais) => atuais.filter((p) => !mesmoEmail(p.usuario.email, removido)));
                  aoConcluir(mensagem);
                }}
              />
            ) : null}
          </>
        )}
      </main>

      {aviso ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-sm bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg"
        >
          {aviso}
        </div>
      ) : null}
    </div>
  );
}
