import { useSyncExternalStore } from 'react';

const CONSULTA = '(min-width: 768px)';

function temMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function inscrever(aoMudar: () => void): () => void {
  if (!temMatchMedia()) {
    return () => {};
  }
  const consulta = window.matchMedia(CONSULTA);
  consulta.addEventListener('change', aoMudar);
  return () => consulta.removeEventListener('change', aoMudar);
}

function lerTelaLarga(): boolean {
  if (!temMatchMedia()) {
    return true;
  }
  return window.matchMedia(CONSULTA).matches;
}

function lerNoServidor(): boolean {
  return true;
}

// A lista vira tabela na tela larga e cartões no celular (blueprint UI-2).
export function useTelaLarga(): boolean {
  return useSyncExternalStore(inscrever, lerTelaLarga, lerNoServidor);
}
