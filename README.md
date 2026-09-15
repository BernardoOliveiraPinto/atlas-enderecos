# Atlas — gestão de endereços

Entrega do teste técnico para cadastro de pessoas e gestão de múltiplos endereços. O projeto tem uma interface React e uma API REST em Java 17/Spring Boot com banco relacional H2 persistido em arquivo.

## O que foi entregue

- Login real por CPF e senha, com credenciais protegidas por BCrypt e sessão de servidor; a senha não é salva no navegador.
- Perfis **ADMIN** e **USER**, com autorização aplicada na API — e não apenas escondida na interface.
- CPF validado e único no cadastro de usuários.
- Cadastro, leitura, edição e remoção de endereços.
- Regra de endereço principal: há no máximo um por usuário; ao escolher outro, o anterior deixa de ser principal; ao remover o principal, outro endereço é promovido automaticamente.
- Busca de usuário/endereço e filtro por estado.
- Consulta ViaCEP com preenchimento automático e cache durante a sessão.
- Interface responsiva, navegação por teclado, foco visível, rótulos de formulário e mensagens acessíveis.
- React Query para cache, invalidação e estados de carregamento das consultas.
- Componente shadcn/ui em `src/components/ui`, com Radix Slot, CVA, `components.json` e variantes reutilizáveis.
- Docker Compose para subir API e interface juntas.
- Testes de integração para autenticação, autorização, CPF duplicado e regras de endereço principal.

## Acessos de demonstração

| Perfil         | CPF              | Senha       | O que pode fazer                                                        |
| -------------- | ---------------- | ----------- | ----------------------------------------------------------------------- |
| Administradora | `529.982.247-25` | `Atlas@123` | Criar usuários e criar, editar ou excluir todos os endereços            |
| Usuário        | `111.444.777-35` | `Atlas@123` | Consultar e editar apenas seus endereços, inclusive definir o principal |

## Executar com Docker

```bash
docker compose up --build
```

Abra [http://localhost:5173](http://localhost:5173). O compose disponibiliza a API na porta `8080` e já aponta a interface para ela.

## Executar localmente

Pré-requisitos: Node 20+, Java 17+ e Maven 3.9+.

Em um terminal, inicie a API:

```bash
cd backend
mvn spring-boot:run
```

Em outro terminal, inicie a interface:

```bash
npm install
npm run dev
```

Abra o endereço informado pelo Vite. Por padrão, a interface consome `http://localhost:8080`; para outro ambiente, copie `.env.example` para `.env.local` e altere `VITE_API_URL`.

## Testes e qualidade

```bash
cd backend
mvn test
```

Os testes cobrem requisição sem autenticação, bloqueio de acesso administrativo para usuário comum, tentativa de alterar endereço de outra pessoa, CPF duplicado e manutenção do único endereço principal.

Para gerar a versão de produção da interface:

```bash
npm run build
```

## Rotas da API

A senha é enviada somente no login. A API cria uma sessão no servidor e retorna um cookie de sessão; as demais rotas não recebem nem armazenam a senha no frontend. O controle de papel é validado no serviço.

| Método | Rota                                    | Acesso                     |
| ------ | --------------------------------------- | -------------------------- |
| POST   | `/api/auth/login`                       | Público                    |
| POST   | `/api/auth/logout`                      | Usuário autenticado        |
| GET    | `/api/auth/me`                          | Usuário autenticado        |
| GET    | `/api/users`                            | ADMIN                      |
| GET    | `/api/users/{id}`                       | ADMIN ou o próprio usuário |
| POST   | `/api/users`                            | ADMIN                      |
| POST   | `/api/users/{id}/addresses`             | ADMIN                      |
| PUT    | `/api/users/{id}/addresses/{addressId}` | ADMIN ou o próprio usuário |
| DELETE | `/api/users/{id}/addresses/{addressId}` | ADMIN                      |

> Em uma publicação de produção, a sessão deve operar exclusivamente sobre HTTPS, com cookie `Secure` e configurações de domínio apropriadas.
