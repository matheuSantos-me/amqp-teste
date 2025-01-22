import Fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import env from "@fastify/env";
import cors from "@fastify/cors";
import axios from "axios";

import { db } from "./db";
import { validateToken } from "./mq";
import { DataCep } from "interfaces";

const server: FastifyInstance = Fastify({ logger: true });

server.register(env, {
  dotenv: true,
  schema: {
    type: "object",
    required: ["PORT", "DATABASE_URL", "RABBITMQ_URL", "QUEUE"],
    properties: {
      PORT: { type: "string" },
      DATABASE_URL: { type: "string" },
      RABBITMQ_URL: { type: "string" },
      QUEUE: { type: "string" },
    },
  },
});
server.register(cors, {});

const PORT = process.env.PORT;

const isAuthorize = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.headers.authorization?.split(" ")[1];

  if (!token) {
    return reply.status(401).send({ message: "Usuário não autorizado!" });
  }

  validateToken(token, (error, valid, userId) => {
    if (error.length && !valid) {
      return reply.status(401).send({ message: "Usuário não autorizado!" });
    }

    return userId;
  });
};

server.get<{ Params: { zipCode: string } }>(
  "/address/:zipCode",
  { preHandler: isAuthorize },
  async (request, reply) => {
    try {
      const { zipCode } = request.params;

      const findAddessByZipCode = await db.address.findFirst({
        where: { zipCode },
      });

      if (findAddessByZipCode) {
        return reply.code(200).send({
          message: "Endereço encontrado com sucesso!",
          address: findAddessByZipCode,
        });
      }

      const { data } = await axios.get<DataCep>(
        `https://viacep.com.br/ws/${zipCode}/json/`
      );

      const newAddress = {
        zipCode: data.cep.split("-").join(""),
        street: data.logradouro,
        neighborhood: data.bairro,
        complement: data.complemento,
        city: data.localidade,
        state: data.estado,
        uf: data.uf,
        region: data.regiao,
      };

      const address = await db.address.create({
        data: newAddress,
      });

      return reply.code(200).send({
        message: "Endereço encontrado com sucesso!",
        address,
      });
    } catch (e) {
      return reply.code(500).send({
        message: "INTERNAL SERVER ERROR!",
      });
    }
  }
);

server.get<{
  Querystring: { page?: string; limit?: string; city?: string; state?: string };
}>("/addresses", { preHandler: isAuthorize }, async (request, reply) => {
  try {
    const { page = "1", limit = "100", city, state } = request.query;

    const skip = (Number(page) - 1) * Number(limit);

    const total = await db.address.count();

    const addresses = await db.address.findMany({
      skip,
      take: Number(limit),
      where: {
        city: {
          contains: city,
        },
        state: {
          contains: state,
        },
      },
    });

    return reply.code(200).send({
      addresses,
      total,
      page: skip,
      totalPages: Math.ceil(total / Number(limit)),
      limit,
    });
  } catch (e) {
    return reply.code(500).send({
      message: "INTERNAL SERVER ERROR!",
    });
  }
});

const start = async () => {
  try {
    server.listen({ host: "0.0.0.0", port: Number(PORT) }, (err) => {
      if (err) {
        server.log.error(err);
        process.exit(1);
      }

      // eslint-disable-next-line no-console
      console.log(`Server listening at ${PORT}`);
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
