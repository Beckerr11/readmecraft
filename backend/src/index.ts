import { z } from "zod";
import { app, env, logger } from "./server.js";

const runtimeEnv = z
  .object({
    PORT: z.coerce.number().default(4000)
  })
  .parse(process.env);

app.listen(runtimeEnv.PORT, () => {
  logger.info(
    {
      port: runtimeEnv.PORT,
      app: env.APP_NAME,
      version: env.APP_VERSION
    },
    "server_started"
  );
});
