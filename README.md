# Livre

## Fluxo das contas e cartões

O resumo mensal apresenta entradas e saídas das contas, incluindo lançamentos pendentes. Compras e estornos de cartões aparecem separados; o débito de pagamento da fatura entra no fluxo apenas na conta bancária. Transferências PIX, TED ou DOC com CPF/CNPJ completo e igual no remetente e destinatário são identificadas como internas e excluídas do fluxo. Dados incompletos ou mascarados não são suficientes para essa identificação.

O saldo de uma conta conectada é o snapshot informado pelo banco, sem somar novamente lançamentos manuais. Contas manuais usam o saldo inicial e os lançamentos concluídos até hoje.

Na próxima importação pelo Open Finance, o Livre consulta `/bills` e preserva os metadados de parcelas e faturas. O painel Cartões exibe faturas por mês de vencimento, pagamento mínimo e parcelas fornecidas pelo banco. Não deduz quitação, não cria parcelas futuras e não confunde compras do mês com o total oficial da fatura. Se a consulta de faturas falhar, mantém o histórico anterior com aviso e ainda importa contas e transações. Essa cobertura depende do banco e do conector: [documentação Pluggy](https://v2.docs.pluggy.ai/en/docs/products/credit-card-bills).

Execute `pnpm test:finance` para verificar cálculos e a importação com respostas simuladas, sem acessar bancos reais.

Controle financeiro pessoal em Next.js, com banco e autenticação Supabase. Preparado para importar na Vercel a partir deste repositório.

## Publicar

1. Na Vercel, importe `MatheusHelmer/Dolls`, usando a raiz do repositório e o framework Next.js.
2. Copie as variáveis de `.env.example` para Environment Variables. Use os valores reais; mantenha `SUPABASE_BACKEND_TOKEN` e `PLUGGY_VAULT_KEY` como segredos apenas do servidor.
3. `SUPABASE_SITE_USER_ID` deve ser o identificador já associado ao proprietário em `livre.site_users`. Isso mantém os mesmos dados do app anterior. Não crie uma nova identidade vazia.
4. Publique. A compilação é `pnpm build`; o lockfile fixa as dependências.
5. Ative o provedor Google no Supabase conforme supabase/SOCIAL_LOGIN.md e entre com a conta Google proprietária. Não há login por senha nesta versão.

O backend `livre-backend` e os schemas em `supabase/` já estão aplicados no projeto atual. Não execute os SQL novamente nesse projeto. Os arquivos documentam a estrutura.

## Desenvolvimento

Copie `.env.example` para `.env.local`, preencha os valores, execute `pnpm install` e `pnpm dev`.

O login verifica a sessão no Supabase, restringe o acesso ao e-mail proprietário e mantém cookies HttpOnly. A sessão é renovada pelo proxy. Todas as APIs financeiras exigem autenticação; as escritas conferem a origem da requisição.

Credenciais Pluggy são criptografadas com AES-GCM no servidor e guardadas em `livre.server_credentials`, sem acesso por clientes. Para a primeira configuração na Vercel, informe novamente Client ID e Client Secret na tela Open Finance. Nunca coloque esses valores no GitHub. O app anterior permanece disponível durante a migração.

Conexões reais exigem autorização no provedor. O app restringe importações ao conector MeuPluggy (200), até cinco conexões pessoais; uma conta gratuita do provedor não é garantida por este aplicativo.

Não há dependência de Cloudflare D1, Workers ou login ChatGPT nesta versão.

