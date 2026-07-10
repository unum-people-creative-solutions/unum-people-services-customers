import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./authStore";

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it("deve inicializar com estado padrao vazio", () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("deve preencher a sessao e marcar isAuthenticated como true ao chamar setSession", () => {
    useAuthStore.getState().setSession({
      email: "user@example.com",
      token: "some-jwt-token",
    });

    const state = useAuthStore.getState();
    expect(state.session).toEqual({
      email: "user@example.com",
      token: "some-jwt-token",
    });
    expect(state.isAuthenticated).toBe(true);
  });

  it("deve limpar a sessao e marcar isAuthenticated como false ao chamar setSession(null)", () => {
    useAuthStore.getState().setSession({
      email: "user@example.com",
      token: "some-jwt-token",
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().setSession(null);
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("deve limpar a sessao e marcar isAuthenticated como false ao chamar logout", () => {
    useAuthStore.getState().setSession({
      email: "user@example.com",
      token: "some-jwt-token",
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
