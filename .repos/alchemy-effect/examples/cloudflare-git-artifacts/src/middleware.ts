import { RuntimeContext } from "alchemy";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import * as HttpApiSecurity from "effect/http-api/HttpApiSecurity";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class ApiToken extends Context.Service<ApiToken, Redacted.Redacted<string>>()(
  "repos/ApiToken",
) {}

export class CallerIdentity extends Context.Service<CallerIdentity, { readonly token: string }>()(
  "repos/CallerIdentity",
) {}

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CallerIdentity }
>()("repos/Authentication", { error: Unauthorized }) {
  static readonly layer = Layer.effect(
    Authentication,
    Effect.gen(function* () {
      const expectedToken = yield* ApiToken;
      return (httpEffect) =>
        Effect.gen(function* () {
          const token = yield* HttpApiBuilder.securityDecode(HttpApiSecurity.bearer).pipe(
            Effect.mapError(() => new Unauthorized()),
          );
          if (Redacted.value(token) !== Redacted.value(expectedToken)) {
            return yield* new Unauthorized();
          }
          return yield* Effect.provideService(httpEffect, CallerIdentity, {
            token: Redacted.value(token),
          });
        }).pipe(Effect.provide(RuntimeContext.phantom));
    }),
  );
}
