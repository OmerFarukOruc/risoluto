import { Type, type Static } from "@sinclair/typebox";

export const SecretKeyPattern = "^[\\w.:=-]+$";

export const SecretKeyParamsSchema = Type.Object({
  key: Type.String({ pattern: SecretKeyPattern }),
});

export const SecretValueBodySchema = Type.Object({
  value: Type.String({ minLength: 1 }),
});

export const SecretListResponseSchema = Type.Object({
  keys: Type.Array(Type.String()),
});

export type SecretKeyParams = Static<typeof SecretKeyParamsSchema>;
export type SecretValueBody = Static<typeof SecretValueBodySchema>;
export type SecretListResponse = Static<typeof SecretListResponseSchema>;
