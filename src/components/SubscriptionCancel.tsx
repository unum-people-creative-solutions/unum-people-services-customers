'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  CancellationService,
  MENSAGEM_SEM_PERMISSAO,
  ehRecusaPorPermissao,
  type CancellationPreview,
} from '@/services/api';
import {
  formatDateBR,
  kindText,
  refundStatusText,
} from '@/lib/cancellationCopy';

type SubscriptionCancelProps = {
  tenantId?: string;
};

const buttonFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2';

// portal-cancelamento RF-C2/RF-C3.
export default function SubscriptionCancel({
  tenantId,
}: SubscriptionCancelProps) {
  const sectionTitleId = useId();
  const dialogTitleId = useId();
  const dialogTextId = useId();

  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const wasDialogOpenRef = useRef(false);

  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [dialogPreview, setDialogPreview] =
    useState<CancellationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [kindChanged, setKindChanged] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setLoadError(false);
    setPreview(null);
    setDialogOpen(false);
    setDialogPreview(null);

    void (async () => {
      try {
        const nextPreview = await CancellationService.getPreview(tenantId);
        if (active) setPreview(nextPreview);
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [tenantId]);

  useEffect(() => {
    if (dialogOpen) {
      backButtonRef.current?.focus();
    } else if (wasDialogOpenRef.current) {
      cancelButtonRef.current?.focus();
    }

    wasDialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);

  function openDialog() {
    if (!preview) return;

    setDialogPreview(preview);
    setSubmitError(null);
    setKindChanged(false);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (submitting) return;

    setDialogOpen(false);
    setDialogPreview(null);
    setSubmitError(null);
    setKindChanged(false);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !submitting) {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );

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

  async function confirmCancellation() {
    if (!dialogPreview?.kind || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await CancellationService.request(
        dialogPreview.kind,
        tenantId,
      );

      setPreview(result.preview);

      if (result.status === 'kind_changed') {
        setDialogPreview(result.preview);
        setKindChanged(true);
        return;
      }

      setDialogOpen(false);
      setDialogPreview(null);
      setKindChanged(false);
    } catch (err) {
      setSubmitError(
        ehRecusaPorPermissao(err)
          ? MENSAGEM_SEM_PERMISSAO
          : 'Não foi possível cancelar agora. Nada foi alterado. Tente de novo em alguns minutos.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Carregando assinatura…</p>;
  }

  if (loadError || !preview) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Não foi possível carregar os dados da assinatura.
      </p>
    );
  }

  if (preview.reason === 'plan_livre') {
    return null;
  }

  let statusText = '';

  if (preview.reason === 'already_scheduled' && preview.scheduled) {
    statusText = `Cancelamento agendado. Sua página sai do ar em ${formatDateBR(preview.scheduled.cancel_at)}.`;
  } else if (
    preview.reason === 'already_cancelled' &&
    preview.refund_status &&
    preview.refund
  ) {
    statusText = refundStatusText(
      preview.refund_status,
      preview.refund.value,
    );
  } else if (preview.reason === 'already_cancelled') {
    statusText = 'Assinatura cancelada.';
  } else if (preview.reason === 'not_admin') {
    statusText =
      'Só o administrador da conta pode cancelar a assinatura.';
  }

  return (
    <>
      <section
        aria-labelledby={sectionTitleId}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h3
          id={sectionTitleId}
          className="text-xl font-black text-gray-900"
        >
          Assinatura
        </h3>

        {statusText ? (
          <p className="mt-3 text-sm text-gray-600">{statusText}</p>
        ) : null}

        {preview.can_cancel ? (
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={openDialog}
            className={`mt-4 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 ${buttonFocus}`}
          >
            Cancelar assinatura
          </button>
        ) : null}
      </section>

      {dialogOpen && dialogPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogTextId}
            onKeyDown={handleDialogKeyDown}
            className="mx-4 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
          >
            <h2
              id={dialogTitleId}
              className="text-xl font-black text-gray-900"
            >
              Cancelar assinatura
            </h2>

            <p id={dialogTextId} className="mt-3 text-sm text-gray-600">
              {kindText(dialogPreview)}
            </p>

            {kindChanged ? (
              <p className="mt-4 text-sm font-semibold text-amber-700">
                O prazo mudou desde que você abriu esta janela. Confira antes
                de confirmar.
              </p>
            ) : null}

            {submitError ? (
              <p role="alert" className="mt-4 text-sm font-semibold text-red-700">
                {submitError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={backButtonRef}
                type="button"
                onClick={closeDialog}
                disabled={submitting}
                className={`rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 ${buttonFocus}`}
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => void confirmCancellation()}
                disabled={submitting}
                className={`rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 ${buttonFocus}`}
              >
                {submitting ? 'Cancelando…' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
