import type { components } from "@/types/openapi";

/** Request body schema from the OpenAPI contract. */
export type Req<K extends keyof components["schemas"]> = components["schemas"][K];

/** Every profile-scoped list/create accepts the profile being viewed. */
export type ProfileArg = { profile?: string | null };
export type ListArgs = ProfileArg & {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  [filter: string]: string | number | boolean | null | undefined;
};
