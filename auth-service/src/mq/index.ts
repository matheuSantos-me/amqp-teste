import { FastifyInstance } from "fastify";
import amqp, { Channel, Connection } from "amqplib/callback_api";

export const setupAMQP = (
  server: FastifyInstance,
  rabbitMQUrl: string,
  queue: string
) => {
  amqp.connect(rabbitMQUrl, (error0, connection: Connection) => {
    if (error0) {
      throw new Error(`AMQP connection error: ${error0.message}`);
    }

    connection.createChannel((error1, channel: Channel) => {
      if (error1) {
        throw new Error(`AMQP channel error: ${error1.message}`);
      }

      channel.assertQueue(queue, { durable: false });

      channel.consume(queue, (msg) => {
        if (!msg) {
          throw new Error("Received empty message");
        }

        const token = msg.content.toString();

        try {
          const decoded = server.jwt.verify(token);

          channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(
              JSON.stringify({ code: 200, valid: true, user: decoded })
            ),
            { correlationId: msg.properties.correlationId }
          );
        } catch (err) {
          channel.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(
              JSON.stringify({
                code: 401,
                valid: false,
                error: "Usuário não autorizado!",
              })
            ),
            { correlationId: msg.properties.correlationId }
          );
        } finally {
          channel.ack(msg);
        }
      });
    });
  });
};
