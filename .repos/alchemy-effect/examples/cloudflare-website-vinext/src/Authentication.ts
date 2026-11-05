import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class CurrentUser extends Context.Tag("app/CurrentUser")<
  CurrentUser,
  { readonly userId: string }
>() {}

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("app/Authentication", {
  error: [Unauthorized],
}) {
  static readonly layer = Layer.succeed(
    Authentication,
    (httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const authorization = request.headers["authorization"];
        if (!authorization || !authorization.startsWith("Bearer ")) {
          return yield* new Unauthorized();
        }
        const token = authorization.slice(7);
        if (!token) return yield* new Unauthorized();
        return yield* Effect.provideService(httpEffect, CurrentUser, {
          userId: token,
        });
      }),
  );
}
