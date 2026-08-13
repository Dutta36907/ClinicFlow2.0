import { setResponseStatus } from "@tanstack/react-start/server";

export function setNotFoundStatus() {
  try {
    setResponseStatus(404);
  } catch {
    /* outside request scope — no-op */
  }
}
