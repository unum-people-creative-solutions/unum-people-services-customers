## 📚 Documentação Oficial (Arquitetura e TDDs)

**Nota Importante:** A documentação técnica detalhada, as regras de IA (Harness), os Technical Design Documents (TDDs) e o log de estado contínuo deste projeto **não ficam armazenados neste repositório**.

Para obter o contexto arquitetural completo e consultar o *Single Source of Truth* do ecossistema, acesse o repositório centralizado de documentação:
👉 **[unum-people-docs](https://github.com/unum-people-creative-solutions/unum-people-docs.git)**

# unum-people-services-customers

Portal do Cliente (Next.js App Router, `customer.unumpeople.com.br`) — superfície universal de aceite de termos legais e visão geral dos produtos contratados, independente de qual ferramenta (CRM/blog) o tenant usa.

## 1. Funcionalidades
- **Termos pendentes** (`/termos`): lista os tipos pendentes do usuário/tenant atual (Termo de Contratação de Serviço, Termos de Uso, Política de Privacidade — 0 a 3 itens), com link de leitura e ação de aceite. Itens já aceitos na sessão atual aparecem em estado somente-leitura.
- **Meus Produtos** (`/produtos`): card do site institucional (link ou selo "Em produção"), cards de CRM/Blog condicionados aos serviços contratados (`enabled_services`).
- **`?return_to`**: quando presente e a lista de pendências fica vazia (todos os itens aceitos), redireciona de volta pra URL informada — usado pelo `PendingTermsGate` do CRM/blog-admin (Fase 4) pra retomar o fluxo original após o aceite. Redireciona só quando não resta nenhuma pendência, nunca a cada aceite individual.
- Rota raiz (`/`) redireciona pra `/termos` — não há tela própria em `/`.

## 2. Autenticação (Cognito Hosted UI / SSO)
Não existe tela de login própria — nasce direto integrado ao Hosted UI (mesmo mecanismo do CRM/blog-admin, App Client dedicado provisionado em `Infraestrutura/unum-people-services-infra`). Fluxo:
- Sem sessão válida em qualquer rota privada → `AuthGuard` redireciona (`window.location.href`, PKCE) pro `/oauth2/authorize` do domínio Hosted UI, preservando pathname **e query string** (necessário pro `?return_to` sobreviver ao round-trip de login).
- `src/app/auth/callback/page.tsx` troca `code`+`code_verifier` por tokens e popula a sessão só com `email`/`token` — diferente do CRM, este app **não resolve tenant/onboarding/papel**; toda decisão de autorização (ex.: `can_accept` de cada termo) já vem pronta do backend via `GET /me/terms/status`.
- Logout ("Sair") usa `logoutFromHostedUI()` (`/oauth2/logout` — encerra a sessão SSO de verdade); reautenticação silenciosa (401 da API, guard sem sessão) usa `redirectToHostedUI` (reaproveita a sessão SSO ainda válida).
- **Variáveis de ambiente necessárias:** `NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN`, `NEXT_PUBLIC_COGNITO_CUSTOMERS_CLIENT_ID`, `NEXT_PUBLIC_API_GATEWAY_URL`, `NEXT_PUBLIC_CRM_URL`, `NEXT_PUBLIC_BLOG_ADMIN_URL`.

## 3. Backend consumido
`GET /me/terms/status`, `POST /me/terms/{type}/accept`, `GET /me/tenant` — endpoints do lambda `admin` (`Backend/unum-people-services-api`), aditivos e já em produção desde a Fase 1 desta feature.

## 4. Testes
**Vitest** + **React Testing Library**.
- **Execução:** `npm test`
- **Cobertura crítica:** `src/lib/pkce.ts`, `AuthGuard`, `auth/callback`, `/termos` (incl. o cenário de 2+ pendências no redirect de `return_to`), `/produtos`.
