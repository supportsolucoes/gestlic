# Gestor de Licitações — Pós-ganho

Sistema de controle de processos de licitação, contratos/ATA, empenhos e entregas.
Construído em React + Vite, com banco de dados Supabase (Postgres + autenticação + regras de segurança em nível de linha).

## O que o sistema garante

- **Bloqueio de saldo**: nenhum empenho pode ultrapassar a quantidade contratada de um item. A trava está no banco de dados (trigger Postgres), não só na tela — então vale mesmo se alguém acessar os dados por outra via.
- **Bloqueio de entrega**: nenhuma entrega pode ultrapassar a quantidade empenhada.
- **Perfis de acesso**: `admin` cadastra processos/contratos/itens e gerencia usuários; `operador` lança empenhos e entregas no dia a dia, mas não altera os parâmetros do contrato.
- **Alertas automáticos**: vencimento de ATA em até 30 dias, entregas atrasadas (com base no prazo contratual de cada item), e itens com saldo de empenho acima de 90%.

## Banco de dados (Supabase)

- Projeto: `gestor-licitacoes` (região São Paulo — sa-east-1)
- URL: `https://aglcddrltzhiosdavfgz.supabase.co`
- As credenciais públicas (URL + chave anônima) já estão no arquivo `.env` deste projeto.
- **Nunca exponha a Service Role Key do Supabase no frontend** — o frontend usa apenas a chave anônima (`anon`/`publishable`), que é segura para expor porque todo o controle de acesso está nas políticas de RLS do banco.

### Estrutura de dados
```
processos (a disputa/licitação)
  └─ contratos (nasce quando processo = GANHOU; é a ATA)
       └─ itens_contrato (produto + quantidade contratada + prazo de entrega)
            └─ empenhos (consome o saldo do item; bloqueado se ultrapassar)
                 └─ entregas (consome o saldo do empenho; bloqueado se ultrapassar)
```

## Como rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Crie uma conta pelo formulário de cadastro — o primeiro usuário nasce como "operador". Para torná-lo administrador, rode no SQL Editor do Supabase:

```sql
update perfis set papel = 'admin' where nome = 'Nome do usuário';
```

## Como publicar (Vercel)

1. Suba esta pasta para um repositório no GitHub (ou use `vercel` CLI direto na pasta).
2. Em vercel.com → New Project → importe o repositório.
3. Em "Environment Variables", adicione:
   - `VITE_SUPABASE_URL` = `https://aglcddrltzhiosdavfgz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (copie do arquivo `.env` deste projeto)
4. Build command: `npm run build` — Output directory: `dist` (Vercel detecta automaticamente para projetos Vite).
5. Deploy.

## Como publicar (Netlify)

1. Mesma lógica: suba o repositório, conecte ao Netlify.
2. Build command: `npm run build` — Publish directory: `dist`.
3. Configure as mesmas variáveis de ambiente em Site settings → Environment variables.
4. Como o app usa rotas client-side (React Router), adicione um arquivo `public/_redirects` com o conteúdo:
   ```
   /*  /index.html  200
   ```
   (sem isso, recarregar a página em `/contratos` ou `/empenhos` retorna 404 no Netlify)

## Próximos passos recomendados

- Migrar a tela de "Produto do contrato" para usar o cadastro de produtos (hoje aceita texto livre — comece a vincular ao cadastro central conforme for usando).
- Avaliar se quer notificação por e-mail nos alertas de vencimento/atraso (hoje eles só aparecem no Painel quando alguém abre o sistema).
- As planilhas antigas (Empenhos.xlsx e RESULTADOS_2026) ficam como histórico de referência — não foram migradas, por decisão consciente dado que continham dados incompletos.
