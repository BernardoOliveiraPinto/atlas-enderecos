# Atlas — gestão de endereços

Entrega do teste técnico para cadastro de pessoas e gestão de múltiplos endereços. O projeto tem uma interface React e uma API REST em Java 17/Spring Boot com banco relacional H2 persistido em arquivo.

## O que foi entregue

- Login real por CPF e senha, com credenciais protegidas por BCrypt e sessão de servidor; a senha não é salva no navegador.
- Perfis **ADMIN** e **USER**, com autorização aplicada na API e não apenas escondida na interface.
- CPF validado e único no cadastro de usuários.
- Cadastro, leitura, edição e remoção de endereços.
- Regra de endereço principal: há no máximo um por usuário; ao escolher outro, o anterior deixa de ser principal; ao remover o principal, outro endereço é promovido automaticamente.
- Busca de usuário/endereço e filtro por estado.
- Consulta ViaCEP com preenchimento automático e cache durante a sessão.
- Interface responsiva, navegação por teclado, foco visível, rótulos de formulário e mensagens acessíveis.
- React Query para cache, invalidação e estados de carregamento das consultas.
- Botão no padrão shadcn/ui em `src/components/ui`, construído com Radix Slot e CVA; `components.json` mantém a configuração dos componentes.
- Docker Compose para subir API e interface juntas.
- Testes de integração para autenticação, autorização, CPF e CEP inválidos e regras de endereço principal.

## Acessos de demonstração

| Perfil         | CPF              | Senha       | O que pode fazer                                                        |
| -------------- | ---------------- | ----------- | ----------------------------------------------------------------------- |
| Administradora | `529.982.247-25` | `Atlas@123` | Criar usuários e criar, editar ou excluir todos os endereços            |
| Usuário        | `111.444.777-35` | `Atlas@123` | Consultar e editar apenas seus endereços, inclusive definir o principal |

## Executar com Docker

Pré-requisitos: Docker Desktop com Docker Compose e suporte a contêineres Linux. No Windows, mantenha o Docker Desktop aberto e o WSL 2 ativo. As portas `8080` e `5173` devem estar livres.

O Docker está configurado em `docker-compose.yml` e `backend/Dockerfile`. O Compose cria a imagem da API com Java 17, inicia a interface com Node 20 e conecta ambos pela rede interna (`web` → `api:8080`). Os dados da API ficam no volume nomeado `atlas-data`, persistindo entre reinícios dos contêineres.

```bash
docker compose up --build
```

Abra [http://localhost:5173](http://localhost:5173). O compose disponibiliza a API na porta `8080` e já aponta a interface para ela.

O Compose foi validado no Windows com Docker Desktop e WSL 2: a imagem da API foi construída, os dois contêineres iniciaram, a interface respondeu com HTTP 200 e a API respondeu na porta `8080` (HTTP 401 em `/api/auth/me` sem login, como esperado).

Para parar sem apagar os cadastros, use `docker compose down`. Para iniciar novamente, use `docker compose up -d`. Não use `docker compose down -v` se quiser preservar os dados do volume.

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

Abra o endereço informado pelo Vite, normalmente [http://localhost:5173](http://localhost:5173). Durante o desenvolvimento, a interface chama `/api` no próprio endereço e o Vite encaminha as requisições à API local em `127.0.0.1:8080`. Para apontar o proxy a outra API, copie `.env.example` para `.env.local`, ajuste `VITE_API_URL` e reinicie o Vite. Para uma implantação de produção, configure a URL da API e os cookies para o domínio/HTTPS usado.

### Onde ficam os cadastros

Na execução local, usuários e endereços ficam no banco H2 `backend/data/atlas.mv.db`. Essa pasta está no `.gitignore` e não é enviada ao GitHub por commits de código. Os dois acessos de demonstração acima, por outro lado, fazem parte do código e do README público. No Docker, os cadastros ficam no volume `atlas-data`, separado do arquivo H2 usado na execução local. Portanto, os cadastros criados em um modo não aparecem automaticamente no outro.

As contas de demonstração só são inseridas quando o banco está vazio. Atualizar o código ou enviar commits ao GitHub não apaga nem publica as contas criadas no arquivo H2 local.

## Testes e qualidade

```bash
cd backend
mvn test
```

Os testes cobrem requisição sem autenticação, bloqueio de acesso administrativo para usuário comum, tentativa de alterar endereço de outra pessoa, CPF duplicado, CEP inválido, promoção após exclusão e escolha do endereço principal pelo usuário comum.

Última validação: 10 testes de integração aprovados, `npm run build` concluído e execução do Compose verificada com API e interface respondendo. A interface também foi conferida no navegador com os dois perfis, consulta automática de CEP, CPF duplicado, edição de endereço próprio e viewport de 390 px. Os testes de integração podem ser executados com Maven 3.9+ sem Docker.

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
