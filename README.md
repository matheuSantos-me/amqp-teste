# AMQP Teste

## Pré-requisitos

Antes de rodar o projeto, é necessário garantir que você tenha as seguintes dependências instaladas:

- **Node.js**: A versão recomendada do Node.js é `v20.x` ou superior. Você pode verificar a versão instalada com o comando:

```bash
node -v
```

PS: Adicione as `.env` como no `.env.example`!
  
---

## Scripts

Execure os seguintes comandos em ordem e em guias de terminal distintas.

```bash
npx prisma migrate dev
```

```bash
npx prisma generate
```

```bash
yarn run:rabbitmq
```

```bash
yarn run:auth-service
```

```bash
yarn run:data-service
```

---

## Tecnologias Utilizadas

- Node.js
- Docker
- Fastify
- Axios
- Prisma
- Postgres
- RabbitMQ
- JWT (JSON Web Tokens)
