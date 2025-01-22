import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { db } from "../db";

export const isAuthorized = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const decodedToken = await request.jwtVerify();
    request.user = decodedToken;
  } catch (err) {
    const expiredToken = request.headers.authorization?.split(" ")[1];

    if (expiredToken?.length) {
      const verifyDubleToken = await db.blackList.findFirst({
        where: { token: expiredToken },
      });

      if (!verifyDubleToken) {
        const decoded = request.server.jwt.decode(expiredToken) as {
          exp: number;
        };
        const expirationDate = new Date(decoded.exp * 1000);

        await db.blackList.create({
          data: { expirationDate, token: expiredToken },
        });
      }
    }

    return reply.status(401).send({ message: "Usuário não autorizado!" });
  }
};

export const registerAuthHook = (server: FastifyInstance) => {
  server.decorate("isAuthorized", isAuthorized);
};
