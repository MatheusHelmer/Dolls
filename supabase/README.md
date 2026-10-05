# Supabase do Livre

Projeto: https://xowgrbnnefhqywilmlnq.supabase.co

O armazenamento usa o schema livre: contas, cartões, transações, categorias, orçamentos, metas, conexões e histórico de sincronização. As tabelas têm RLS e vínculos que impedem relacionamentos entre proprietários diferentes.

O login privado do Site via ChatGPT identifica o proprietário. O servidor valida o e-mail autorizado e chama a Edge Function livre-backend com um segredo exclusivo. A função verifica o segredo por hash, associa a identidade do Site a um usuário Supabase Auth e executa operações restritas ao servidor. Chaves administrativas nunca chegam ao navegador.

backend.sql contém o backend aplicado pela migração livre_authenticated_site_backend. As tabelas backend_auth e site_users têm RLS sem políticas para clientes: acesso exclusivo do servidor, intencional.

Na primeira abertura autenticada, lib/storage.ts copia o snapshot existente do D1 em uma transação, confere as quantidades e registra a conclusão. Os registros originais permanecem no D1. As credenciais bancárias continuam criptografadas no cofre D1; os dados financeiros passam a ser gravados no PostgreSQL.

Testes de integração executados contra a Edge Function: rejeição de credencial inválida e e-mail divergente, migração, CRUD normalizado, rollback de valores inválidos, três conexões simuladas, importação, proteção dos valores bancários e remoção isolada. Identidade e dados de teste foram removidos. Isso não estabelece três conexões reais com bancos.

Variáveis de produção: FINANCE_STORAGE=supabase, SUPABASE_URL, SUPABASE_OWNER_EMAIL e SUPABASE_BACKEND_TOKEN (segredo). PLUGGY_VAULT_KEY permanece necessária para o cofre. Nenhum segredo deve ser colocado neste arquivo.
