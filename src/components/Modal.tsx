'use client';

// gestao-de-acesso-f3-portal-cliente RF-20: diálogo do Portal, com a mecânica de SubscriptionCancel.
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

const FOCAVEIS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focoVisivel =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2';

type ModalProps = {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  fecharBloqueado?: boolean;
  focoInicialRef?: RefObject<HTMLElement>;
  children: ReactNode;
  rodape?: ReactNode;
};

export default function Modal({
  aberto,
  titulo,
  descricao,
  onFechar,
  fecharBloqueado = false,
  focoInicialRef,
  children,
  rodape,
}: ModalProps) {
  const idTitulo = useId();
  const idDescricao = useId();
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const indicado = focoInicialRef?.current;
    if (indicado) {
      indicado.focus();
    } else {
      caixaRef.current?.querySelector<HTMLElement>(FOCAVEIS)?.focus();
    }

    return () => {
      if (anterior && document.contains(anterior)) {
        anterior.focus();
      }
    };
  }, [aberto, focoInicialRef]);

  function aoTeclar(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !fecharBloqueado) {
      event.preventDefault();
      onFechar();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCAVEIS));

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descricao ? idDescricao : undefined}
        onKeyDown={aoTeclar}
        className="w-full max-w-lg bg-white shadow-xl flex flex-col max-h-screen sm:max-h-[90vh] h-full sm:h-auto rounded-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <h2 id={idTitulo} className="text-lg font-black text-gray-900">
            {titulo}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            disabled={fecharBloqueado}
            onClick={onFechar}
            className={`shrink-0 rounded-lg p-1 text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 ${focoVisivel}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {descricao ? (
          <p id={idDescricao} className="px-6 pt-2 text-sm text-gray-600">
            {descricao}
          </p>
        ) : null}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {rodape ? (
          <div className="border-t border-gray-100 px-6 py-4 flex flex-wrap justify-end gap-3">{rodape}</div>
        ) : null}
      </div>
    </div>
  );
}
