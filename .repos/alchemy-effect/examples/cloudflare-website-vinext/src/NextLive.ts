import * as FileSystem from "effect/FileSystem";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { Authentication } from "./Authentication";
import { BackendClient } from "./BackendClient";
import { FrontendApi } from "./NextApi";
import { NotesHandlers, PublicHandlers } from "./NextHandlers";

const platformLayer = Layer.mergeAll(
  Etag.layer,
  HttpPlatform.layer.pipe(Layer.provide(FileSystem.layerNoop({}))),
  FileSystem.layerNoop({}),
  Path.layer,
);

const FrontendLive = HttpApiBuilder.layer(FrontendApi).pipe(
  Layer.provide([
    PublicHandlers.pipe(Layer.provide(BackendClient.Default)),
    NotesHandlers.pipe(Layer.provide(BackendClient.Default)),
  ]),
  Layer.provide(Authentication.layer),
  Layer.provide(platformLayer),
);

const httpHandler = HttpRouter.toWebHandler(FrontendLive, {
  disableLogger: true,
});

export const handleApiRequest = (request: Request) => httpHandler.handler(request);
