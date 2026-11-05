import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Etag from "effect/http/Etag";
import * as HttpPlatform from "effect/http/HttpPlatform";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import {
  Authentication,
  CloneToken,
  CreateRepoResponse,
  Metadata,
  RepoApi,
  RepoConflict,
  RepoInfo,
  RepoNotFound,
  Session,
  Unauthorized,
} from "./Api.ts";
import Repo from "./Repo.ts";
import { Repos } from "./Repos.ts";

// Workers don't have a FileSystem, so HttpPlatform's file-response surface
// is stubbed. The repo API never serves files.
const HttpPlatformStub = Layer.succeed(HttpPlatform.HttpPlatform, {
  fileResponse: () => Effect.die("HttpPlatform.fileResponse not supported"),
  fileWebResponse: () => Effect.die("HttpPlatform.fileWebResponse not supported"),
});

export default class Worker extends Cloudflare.Worker<Worker>()(
  "Api",
  {
    main: import.meta.url,
    observability: { enabled: true },
    compatibility: {
      date: "2026-08-31",
    },
  },
  Effect.gen(function* () {
    const artifacts = yield* Repos;
    const repos = yield* Repo;

    const findRepo = (name: string) =>
      artifacts.list({ limit: 100 }).pipe(
        Effect.flatMap((res) => {
          const found = res.repos.find((r: { name: string }) => r.name === name);
          return found ? Effect.succeed(found) : Effect.fail(new RepoNotFound({ name }));
        }),
        Effect.catchTag("ArtifactsError", () => Effect.fail(new RepoNotFound({ name }))),
      );

    const AuthLive = Layer.effect(
      Authentication,
      Effect.succeed({
        bearer: (httpEffect: any, { credential }: { credential: Redacted.Redacted<string> }) =>
          Effect.gen(function* () {
            const token = Redacted.value(credential);
            if (!token) return yield* new Unauthorized();
            return yield* Effect.provideService(httpEffect, Session, {
              user: { id: token },
            });
          }),
      }),
    );

    const verifyOwner = (name: string) =>
      Effect.gen(function* () {
        const { user } = yield* Session;
        const meta = yield* repos
          .getByName(name)
          .get()
          .pipe(Effect.catchAll(() => Effect.fail(new RepoNotFound({ name }))));
        if (meta.owner !== user.id) {
          return yield* Effect.fail(new RepoNotFound({ name }));
        }
        return meta;
      });

    const handlers = HttpApiBuilder.group(RepoApi, "repos", (h) =>
      h
        .handle("createRepo", ({ payload }) =>
          Effect.gen(function* () {
            const { user } = yield* Session;
            const c = yield* artifacts
              .create(payload.name, {
                description: payload.description,
                setDefaultBranch: "main",
              })
              .pipe(
                Effect.catchTag("ArtifactsError", (err) =>
                  Effect.fail(new RepoConflict({ message: err.message })),
                ),
              );
            yield* repos
              .getByName(payload.name)
              .init(payload.description ?? "", user.id)
              .pipe(Effect.orDie);
            return new CreateRepoResponse({
              name: c.name,
              remote: c.remote,
              token: c.token,
              defaultBranch: c.defaultBranch,
            });
          }),
        )
        .handle("getRepo", ({ params }) =>
          Effect.gen(function* () {
            const found = yield* findRepo(params.name);
            const meta = yield* verifyOwner(params.name);
            return new RepoInfo({
              id: found.id,
              name: found.name,
              description: found.description ?? null,
              defaultBranch: found.defaultBranch,
              remote: found.remote,
              status: found.status,
              readOnly: found.readOnly,
              createdAt: found.createdAt,
              updatedAt: found.updatedAt,
              lastPushAt: found.lastPushAt ?? null,
              metadata: new Metadata(meta),
            });
          }),
        )
        .handle("updateRepo", ({ params, payload }) =>
          Effect.gen(function* () {
            yield* findRepo(params.name);
            yield* verifyOwner(params.name);
            const updated = yield* repos
              .getByName(params.name)
              .update({
                description: payload.description,
                topics: payload.topics ? [...payload.topics] : undefined,
              })
              .pipe(Effect.orDie);
            return new Metadata(updated);
          }),
        )
        .handle("deleteRepo", ({ params }) =>
          Effect.gen(function* () {
            yield* verifyOwner(params.name);
            yield* artifacts.delete(params.name).pipe(
              Effect.asVoid,
              Effect.catchTag("ArtifactsError", () =>
                Effect.fail(new RepoNotFound({ name: params.name })),
              ),
            );
          }),
        )
        .handle("starRepo", ({ params }) =>
          Effect.gen(function* () {
            yield* findRepo(params.name);
            yield* verifyOwner(params.name);
            const updated = yield* repos.getByName(params.name).star().pipe(Effect.orDie);
            return new Metadata(updated);
          }),
        )
        .handle("cloneToken", ({ params, payload }) =>
          Effect.gen(function* () {
            yield* verifyOwner(params.name);
            const handle = yield* artifacts.get(params.name).pipe(
              Effect.catchTag("ArtifactsError", () =>
                Effect.fail(new RepoNotFound({ name: params.name })),
              ),
            );
            const t = yield* handle.createToken(payload.scope ?? "read", payload.ttl ?? 3600);
            return new CloneToken({
              id: t.id,
              plaintext: t.plaintext,
              scope: t.scope as "read" | "write",
              expiresAt: t.expiresAt,
            });
          }),
        ),
    );

    return {
      fetch: HttpApiBuilder.layer(RepoApi).pipe(
        Layer.provide(handlers),
        Layer.provide(AuthLive),
        Layer.provide([Etag.layer, HttpPlatformStub, Path.layer]),
        HttpRouter.toHttpEffect,
      ),
    };
  }).pipe(Effect.provide(Layer.mergeAll(Binding))),
) {}
