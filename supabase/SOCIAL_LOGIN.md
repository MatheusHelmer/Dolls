# Login Google e GitHub

O app inicia OAuth com PKCE em `/auth/start` e troca o código pela sessão em `/auth/callback`. Apenas o e-mail definido em SUPABASE_OWNER_EMAIL pode entrar. A conta usada no Google ou GitHub precisa ter esse e-mail verificado.

## Ativar os provedores

No Supabase, Authentication → Sign In / Providers, habilite Google e/ou GitHub e salve o Client ID e Client Secret do respectivo aplicativo OAuth. Esses segredos ficam no Supabase, nunca no GitHub ou no navegador.

Em ambos os provedores, o callback a cadastrar é:

`https://xowgrbnnefhqywilmlnq.supabase.co/auth/v1/callback`

Google: crie um OAuth Client do tipo Web Application no Google Auth Platform. Adicione o domínio de produção da Vercel como origem autorizada e o callback Supabase acima como URI de redirecionamento. Use apenas openid, email e profile. Se o aplicativo estiver em teste, adicione o proprietário aos usuários de teste.

GitHub: Settings → Developer settings → OAuth Apps → New OAuth App. Homepage URL = URL de produção na Vercel; Authorization callback URL = callback Supabase acima. Copie Client ID e Client Secret para o provedor GitHub no Supabase.

No Supabase, Authentication → URL Configuration: Site URL = domínio de produção; Redirect URLs = `https://SEU-DOMINIO-VERCEL/auth/callback`. Use o domínio real e não autorize domínios desconhecidos. Para testar localmente, adicione `http://localhost:5182/auth/callback`.

Abra o Livre e escolha Continuar com Google ou Continuar com GitHub. Se usar outra conta, a sessão será encerrada e o aplicativo continuará privado. A configuração das credenciais é necessária antes do teste completo com o provedor.
