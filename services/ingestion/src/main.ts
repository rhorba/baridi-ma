import Fastify from "fastify";

const PORT = Number(process.env.PORT ?? 4003);

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok", service: "ingestion" }));

app.listen({ port: PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
