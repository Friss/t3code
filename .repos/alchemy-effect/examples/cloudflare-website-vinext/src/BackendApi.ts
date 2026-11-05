import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as Schema from "effect/Schema";

export class Note extends Schema.Class<Note>("Note")({
  id: Schema.String,
  title: Schema.String,
  source: Schema.String,
  owner: Schema.String,
  createdAt: Schema.Number,
}) {}

export class NotesList extends Schema.Class<NotesList>("NotesList")({
  notes: Schema.Array(Note),
}) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  message: Schema.String,
}) {}

export const AuthorizationHeader = Schema.Struct({
  authorization: Schema.String,
});

export const listNotes = HttpApiEndpoint.get("listNotes", "/notes", {
  success: NotesList,
});

export const createNote = HttpApiEndpoint.post("createNote", "/notes", {
  success: Note.pipe(HttpApiSchema.status(201)),
  payload: Schema.Struct({
    title: Schema.String,
  }),
  headers: AuthorizationHeader,
});

export const deleteNote = HttpApiEndpoint.delete("deleteNote", "/notes/:id", {
  params: Schema.Struct({
    id: Schema.String,
  }),
  headers: AuthorizationHeader,
  success: HttpApiSchema.NoContent,
});

export class BackendGroup extends HttpApiGroup.make("Backend")
  .add(listNotes, createNote, deleteNote)
  .addError(Forbidden) {}

/** Backend Worker HttpApi — D1 only. KV lives on the vinext frontend. */
export class BackendApi extends HttpApi.make("BackendApi").add(BackendGroup) {}
