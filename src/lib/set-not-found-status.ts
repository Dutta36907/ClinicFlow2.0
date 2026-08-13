import { createIsomorphicFn } from "@tanstack/react-start";

export const setNotFoundStatus = createIsomorphicFn()
  .client(() => {})
  .server(() => {
    // Dynamic import keeps the server-only module out of the client graph.
    void import("./set-not-found-status.server").then((m) => m.setNotFoundStatus());
  });
