import * as Context from "effect/Context";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
import * as Schema from "effect/Schema";

export const User = Schema.Struct({
  id: Schema.String,
});

export class CurrentUser extends Context.Service<CurrentUser, typeof User.Type>()(
  "app/CurrentUser",
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("app/Authentication", {
  error: Unauthorized,
}) {}
