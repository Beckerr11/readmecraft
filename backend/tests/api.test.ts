import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import express from "express";

test("health endpoint responds 200", async () => {
  const app = express();
  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});
