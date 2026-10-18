// gestao-de-acesso-f3-portal-cliente RF-16
import { useEffect, useState } from "react";
import { AcessosService, type MeusAcessos } from "@/services/usuarios";

export function useMeusAcessos(tenantId: string): {
  acessos: MeusAcessos | null;
  carregando: boolean;
  erro: boolean;
  podeGerirUsuarios: boolean;
} {
  const [acessos, setAcessos] = useState<MeusAcessos | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setAcessos(null);
      setCarregando(false);
      setErro(false);
      return;
    }

    let active = true;

    setCarregando(true);
    setErro(false);
    setAcessos(null);

    void (async () => {
      try {
        const next = await AcessosService.meus(tenantId);
        if (active) setAcessos(next);
      } catch {
        if (active) {
          setAcessos(null);
          setErro(true);
        }
      } finally {
        if (active) setCarregando(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [tenantId]);

  const portal = acessos?.ferramentas.find((f) => f.id === "portal");
  const podeGerirUsuarios = portal?.permissoes.includes("portal.usuarios.gerir") ?? false;

  return { acessos, carregando, erro, podeGerirUsuarios };
}
