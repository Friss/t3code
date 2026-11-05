import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class Caller extends Context.Tag("Caller")<Caller, { readonly sub: string }>() {}

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: Caller }
>()("app/Authentication", { error: Unauthorized }) {
  static readonly layer = Layer.effect(
    Authentication,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("JOB_API_KEY");

      return (httpEffect) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest;
          const header = request.headers["authorization"] ?? "";
          const token = header.startsWith("Bearer ") ? header.slice(7) : "";
          if (token === "" || token !== Redacted.value(apiKey)) {
            return yield* new Unauthorized();
          }
          return yield* Effect.provideService(httpEffect, Caller, { sub: "authenticated" });
        });
    }),
  );
}
