export function hasPermission(user, permission) {
  const permissions = user?.permissions || [];
  if (permissions.includes(permission)) return true;
  const resource = String(permission || "").split(".")[0];
  return Boolean(resource && permissions.includes(`${resource}.manage_all`));
}

export function isRequesterPersona(user) {
  return user?.roles?.includes("requester")
    && !hasPermission(user, "issues.read_all");
}
