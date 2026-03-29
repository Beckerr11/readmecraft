import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => vi.unstubAllGlobals());

it("renderiza heading principal", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  expect(await screen.findByText("API online e pronta para integracao.")).toBeInTheDocument();
});
