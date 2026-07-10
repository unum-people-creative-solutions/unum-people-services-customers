"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { jwtDecode } from "jwt-decode";
import { redirectToHostedUI } from "@/lib/pkce";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, session, logout } = useAuthStore();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    if (useAuthStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => unsub();
  }, []);

  const publicPaths = ["/auth/callback"];
  const isPublicPath = publicPaths.includes(pathname);

  useEffect(() => {
    if (isHydrated) {
      if (!isPublicPath) {
        const search = typeof window !== 'undefined' ? window.location.search : "";
        const fullPath = pathname + search;

        if (!isAuthenticated || !session?.token) {
          void redirectToHostedUI(fullPath);
          return;
        }

        try {
          const decoded: any = jwtDecode(session.token);
          const currentTime = Date.now() / 1000;

          if (decoded.exp < currentTime) {
            console.warn("Sessão expirada. Redirecionando...");
            logout();
            void redirectToHostedUI(fullPath);
            return;
          }
        } catch (err) {
          logout();
          void redirectToHostedUI(fullPath);
          return;
        }
      }
    }
  }, [isHydrated, isAuthenticated, session, pathname, isPublicPath, logout]);

  if (!isHydrated || (!isPublicPath && (!isAuthenticated || !session?.token))) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div role="status" className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
