import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";

export type Metadata = {
  owner: string;
  description: string;
  topics: string[];
  stars: number;
  createdAt: number;
};

export default class Repo extends Cloudflare.DurableObject<Repo>()(
  "Repo",
  Effect.gen(function* () {
    const state = yield* Cloudflare.DurableObjectState;
    return Effect.gen(function* () {
      let meta = (yield* state.storage.get<Metadata>("meta")) ?? null;

      const ensure = Effect.gen(function* () {
        if (meta === null) {
          return yield* Effect.fail(new Error("repo not initialized"));
        }
        return meta;
      });

      return {
        init: (description: string, owner: string) =>
          Effect.gen(function* () {
            if (meta !== null) return meta;
            meta = {
              owner,
              description,
              topics: [],
              stars: 0,
              createdAt: Date.now(),
            };
            yield* state.storage.put("meta", meta);
            return meta;
          }),
        get: () => ensure,
        update: (patch: Partial<Pick<Metadata, "description" | "topics">>) =>
          Effect.gen(function* () {
            const current = yield* ensure;
            meta = { ...current, ...patch };
            yield* state.storage.put("meta", meta);
            return meta;
          }),
        star: () =>
          Effect.gen(function* () {
            const current = yield* ensure;
            meta = { ...current, stars: current.stars + 1 };
            yield* state.storage.put("meta", meta);
            return meta;
          }),
      };
    });
  }),
) {}
