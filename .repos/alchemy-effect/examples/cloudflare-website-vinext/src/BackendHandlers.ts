import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { BackendApi, Forbidden, Note, NotesList } from "./BackendApi";
import { DB } from "./Bindings";

const extractOwner = (authorization: string): Effect.Effect<string, Forbidden> => {
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return Effect.fail(new Forbidden({ message: "Missing or invalid Bearer token" }));
  }
  return Effect.succeed(match[1]);
};

export const BackendHandlers = HttpApiBuilder.group(
  BackendApi,
  "Backend",
  Effect.fn(function* (handlers) {
    const db = yield* Cloudflare.D1.QueryDatabase(DB);

    return handlers
      .handle("listNotes", () =>
        db
          .prepare("SELECT id, title, source, owner, created_at FROM notes ORDER BY created_at DESC")
          .all<{
            id: string;
            title: string;
            source: string;
            owner: string;
            created_at: number;
          }>()
          .pipe(
            Effect.map(
              ({ results }) =>
                new NotesList({
                  notes: (results ?? []).map(
                    (row) =>
                      new Note({
                        id: row.id,
                        title: row.title,
                        source: row.source,
                        owner: row.owner,
                        createdAt: row.created_at,
                      }),
                  ),
                }),
            ),
            Effect.orDie,
          ),
      )
      .handle("createNote", ({ payload, headers }) =>
        Effect.gen(function* () {
          const owner = yield* extractOwner(headers.authorization);
          const note = new Note({
            id: crypto.randomUUID(),
            title: payload.title,
            source: "effect-httpapi",
            owner,
            createdAt: Date.now(),
          });
          yield* db
            .prepare("INSERT INTO notes (id, title, source, owner, created_at) VALUES (?, ?, ?, ?, ?)")
            .bind(note.id, note.title, note.source, note.owner, note.createdAt)
            .run()
            .pipe(Effect.orDie);
          return note;
        }),
      )
      .handle("deleteNote", ({ params, headers }) =>
        Effect.gen(function* () {
          const owner = yield* extractOwner(headers.authorization);
          yield* db
            .prepare("DELETE FROM notes WHERE id = ? AND owner = ?")
            .bind(params.id, owner)
            .run()
            .pipe(Effect.orDie);
        }),
      );
  }),
);
