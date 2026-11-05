import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import * as HttpApiSecurity from "effect/http-api/HttpApiSecurity";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

export class CurrentUser extends Context.Service<CurrentUser, { readonly id: string }>()(
  "app/CurrentUser",
) {}

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("app/Authentication", {
  error: HttpApiError.Unauthorized,
}) {
  static readonly layer = Layer.succeed(
    Authentication,
    (httpEffect) =>
      HttpApiBuilder.securityDecode(HttpApiSecurity.bearer).pipe(
        Effect.mapError(() => new HttpApiError.Unauthorized()),
        Effect.flatMap((credential) => {
          const token = Redacted.value(credential);
          if (!token) {
            return Effect.fail(new HttpApiError.Unauthorized());
          }
          return Effect.provideService(httpEffect, CurrentUser, { id: token });
        }),
      ),
  );
}
