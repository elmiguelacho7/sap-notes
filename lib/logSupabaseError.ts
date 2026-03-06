export function logSupabaseError(label: string, err: unknown) {
  if (!err) {
    console.error(label, "NO_ERROR_OBJECT");
    return;
  }

  const obj = err as Record<string, unknown>;
  const own = Object.getOwnPropertyNames(err);
  const serialized = JSON.stringify(err, own);

  console.error(label, {
    name: obj?.name,
    message: obj?.message,
    details: obj?.details,
    hint: obj?.hint,
    code: obj?.code,
    status: obj?.status,
    statusText: obj?.statusText,
    ownProps: own,
    serialized,
  });
}
