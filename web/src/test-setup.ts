import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// The suite runs on a loaded machine (jsdom per file, many workers): the 1 s default of
// `findBy*` / `waitFor` times out on screens that mount fine alone.
configure({ asyncUtilTimeout: 4000 });
