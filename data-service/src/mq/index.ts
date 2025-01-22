import { v4 as uuidv4 } from "uuid";
import amqp from "amqplib/callback_api";

const RABBITMQ_URL = String(process.env.RABBITMQ_URL);
const QUEUE = String(process.env.QUEUE);

export const validateToken = async (
  token: string,
  callback: (error: string, valid: boolean, userId?: string) => void
) => {
  amqp.connect(RABBITMQ_URL, (error0, connection) => {
    if (error0) {
      return callback("Usuário não autorizado!", false);
    }

    connection.createChannel((error1, channel) => {
      if (error1) {
        return callback("Usuário não autorizado!", false);
      }

      channel.assertQueue(QUEUE, { durable: false });

      channel.assertQueue("", { exclusive: true }, (error2, q) => {
        if (error2) {
          return callback("Usuário não autorizado!", false);
        }

        const correlationId = uuidv4();

        channel.sendToQueue(QUEUE, Buffer.from(token), {
          replyTo: q.queue,
          correlationId: correlationId,
        });

        channel.consume(
          q.queue,
          (msg) => {
            if (msg && msg.properties.correlationId === correlationId) {
              const response = JSON.parse(msg.content.toString());
              channel.ack(msg);
              connection.close();

              if (response.valid) {
                callback("", true, response.user.id);
              } else {
                callback("Usuário não autorizado!", false);
              }
            }
          },
          { noAck: true }
        );
      });
    });
  });
};
