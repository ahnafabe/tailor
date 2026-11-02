import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without Vitest globals, Testing Library can't register its own cleanup, so unmount between tests here.
afterEach(() => cleanup());
