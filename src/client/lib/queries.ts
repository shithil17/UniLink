import { queryOptions } from "@tanstack/react-query";
import { healthResponse } from "../../shared/schemas/health";
import { apiGet } from "./api";

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: () => apiGet("/api/health", healthResponse),
});
