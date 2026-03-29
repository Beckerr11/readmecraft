import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { app } from "../src/server";

test("health endpoint responds 200", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
});

test("supports filters by status, priority and search", async () => {
  const response = await request(app).get("/api/work-items").query({
    status: "open",
    priority: "high",
    q: "erro"
  });

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body.items), true);
  assert.equal(typeof response.body.stats.filtered, "number");
});

test("exports work items as csv", async () => {
  const response = await request(app).get("/api/work-items/export.csv").query({
    status: "all",
    priority: "all"
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"].includes("text/csv"), true);
  assert.equal(response.text.includes("id,title,details,priority,status,createdAt"), true);
});

test("creates, toggles and removes work item", async () => {
  const createResponse = await request(app).post("/api/work-items").send({
    title: "Aprimorar fluxo de aprovacao",
    details: "Implementar etapa adicional de verificacao com auditoria.",
    priority: "high"
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.item.status, "open");

  const itemId = createResponse.body.item.id;

  const toggleResponse = await request(app)
    .patch(`/api/work-items/${itemId}/toggle`)
    .send();

  assert.equal(toggleResponse.status, 200);
  assert.equal(toggleResponse.body.item.status, "done");

  const deleteResponse = await request(app).delete(`/api/work-items/${itemId}`);

  assert.equal(deleteResponse.status, 204);
});
