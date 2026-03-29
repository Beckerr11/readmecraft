import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import pino from "pino";

const env = z.object({ NODE_ENV:z.enum(["development","test","production"]).default("development"), PORT:z.coerce.number().default(4000), APP_NAME:z.string().default("ReadmeCraft"), APP_VERSION:z.string().default("1.0.0") }).parse(process.env);
const app = express();
const logger = pino({ name: env.APP_NAME, level: env.NODE_ENV === "development" ? "debug" : "info" });
app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => res.status(200).json({ ok:true, service:env.APP_NAME, version:env.APP_VERSION, timestamp:new Date().toISOString() }));
app.get("/api/meta", (_req, res) => res.status(200).json({ project:{ name:"ReadmeCraft", slug:"readmecraft", tagline:"Editor profissional para README com preview e padrao senior.", vertical:"developer-tools" } }));
app.use((req, res) => res.status(404).json({ success:false, error:{ code:"ROUTE_NOT_FOUND", message:`Rota ${req.originalUrl} nao encontrada` } }));
app.listen(env.PORT, () => logger.info({ port: env.PORT }, "server_started"));
