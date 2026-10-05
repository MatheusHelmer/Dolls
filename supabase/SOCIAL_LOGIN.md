# Login somente com Google

O Livre usa OAuth Google com PKCE e cookies HttpOnly. O login por senha e o provedor GitHub estão desativados no aplicativo. Apenas o e-mail SUPABASE_OWNER_EMAIL pode entrar.

No Google Auth Platform, crie um cliente OAuth Web Application. Use apenas openid, email e profile. Adicione o domínio de produção da Vercel como origem autorizada e este URI de redirecionamento:

https://xowgrbnnefhqywilmlnq.supabase.co/auth/v1/callback

Se estiver em modo de teste, adicione o proprietário como usuário de teste. Salve Client ID e Client Secret em Supabase → Authentication → Sign In / Providers → Google; nunca no GitHub.

Em Supabase → URL Configuration, Site URL = URL de produção do Livre e Redirect URLs = essa URL acrescida de /auth/callback.

A conta escolhida no Google deve usar o e-mail proprietário do Livre. Contas diferentes são recusadas e a sessão é encerrada.
