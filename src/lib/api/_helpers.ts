/**
 * Internal helpers for domain modules.
 *
 * Domain modules under `src/lib/api/*` are the ONLY place allowed to talk to
 * the backend directly. Consumers (hooks, pages, components) must never import
 * from this file or from `./client`.
 */

/** Unwrap a `{ data, error }` PostgREST response, throwing on error. */
export async function unwrap<T>(
  builder: PromiseLike<{ data: T; error: { message: string } | null }>
): Promise<T> {
  const { data, error } = await builder;
  if (error) throw error;
  return data as T;
}

/** Same as `unwrap` but ignores the returned data. */
export async function run(
  builder: PromiseLike<{ error: { message: string } | null }>
): Promise<void> {
  const { error } = await builder;
  if (error) throw error;
}
