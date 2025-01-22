import Fastify, { FastifyInstance } from "fastify";
import env from "@fastify/env";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";

import { db } from "./db";
import {
  decryptPassword,
  encryptPassword,
  isAuthorized,
  isValidEmail,
} from "./utils";
import { CreateUserInput, LoginInput } from "interfaces";
import { setupAMQP } from "./mq";

const server: FastifyInstance = Fastify({ logger: true });

server.register(env, {
  dotenv: true,
  schema: {
    type: "object",
    required: ["PORT", "DATABASE_URL", "JWT_SECRET", "RABBITMQ_URL", "QUEUE"],
    properties: {
      PORT: { type: "string" },
      DATABASE_URL: { type: "string" },
      JWT_SECRET: { type: "string" },
      RABBITMQ_URL: { type: "string" },
      QUEUE: { type: "string" },
    },
  },
});
server.register(cors, {});
server.register(jwt, { secret: String(process.env.JWT_SECRET) });

const PORT = process.env.PORT;

const RABBITMQ_URL = String(process.env.RABBITMQ_URL);
const QUEUE = String(process.env.QUEUE);

setupAMQP(server, RABBITMQ_URL, QUEUE);

server.post<{ Body: CreateUserInput }>("/user", async (request, reply) => {
  try {
    const data = request.body;

    if (!data.name.length) {
      return reply.code(400).send({
        message: "O Nome deve ser informado!",
      });
    }

    if (!isValidEmail(data.email)) {
      return reply.code(400).send({
        message: "O Email infromado é invalido!",
      });
    }

    const emailExists = await db.user.findFirst({
      where: {
        email: data.email,
      },
    });

    if (emailExists) {
      return reply.code(400).send({
        message: "O Email infromado estar indisponivel!",
      });
    }

    if (data.password.length < 8) {
      return reply.code(400).send({
        message: "A Senha deve ter no minimo 8 caracteres!",
      });
    }

    const hashPassword = await encryptPassword(data.password);

    const user = await db.user.create({
      data: {
        ...data,
        password: hashPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return reply.code(201).send({
      message: "Usuário criado com sucesso!",
      user,
    });
  } catch (e) {
    return reply.code(500).send({
      message: "INTERNAL SERVER ERROR!",
    });
  }
});

server.post<{ Body: LoginInput }>("/login", async (request, reply) => {
  try {
    const data = request.body;

    const user = await db.user.findFirst({
      where: { email: data.email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        createdAt: true,
      },
    });

    const matchPassword = decryptPassword(
      data.password,
      String(user?.password)
    );

    if (!user || !matchPassword) {
      return reply.code(400).send({
        message: "Email ou Senha informados estão incorretos!",
      });
    }

    const token = server.jwt.sign({ id: user.id }, { expiresIn: "1d" });

    return reply.code(200).send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (e) {
    return reply.code(500).send({
      message: "INTERNAL SERVER ERROR!",
    });
  }
});

server.get("/me", { preHandler: isAuthorized }, async (request, reply) => {
  try {
    const userToken = request.user as { id: string };

    const user = await db.user.findFirst({
      where: {
        id: userToken.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.code(404).send({ message: "Usuário não encontrado!" });
    }

    return reply.code(200).send({
      message: "Usuário encontrado com sucesso!",
      user,
    });
  } catch (e) {
    return reply.code(500).send({
      message: "INTERNAL SERVER ERROR!",
    });
  }
});

const start = async () => {
  try {
    server.listen(
      { host: "0.0.0.0", port: Number(process.env.PORT) },
      (err) => {
        if (err) {
          server.log.error(err);
          process.exit(1);
        }

        // eslint-disable-next-line no-console
        console.log(`Server listening at ${PORT}`);
      }
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
