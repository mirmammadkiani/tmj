export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/");
}

/**
 * Resolve a relative path (like Tiled's tileset image paths) against a base file path.
 * Both paths are treated as POSIX-style with "/" separators.
 */
export function resolveRelativePath(baseFilePath: string, relativePath: string): string {
  const rel = relativePath.replace(/\\/g, "/");

  // Absolute (within zip) path-like – keep as-is, just normalize
  if (rel.startsWith("/")) {
    return rel.replace(/^\/+/, "");
  }

  const baseDir = dirname(baseFilePath);
  const stack = baseDir ? baseDir.split("/") : [];

  for (const segment of rel.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      stack.pop();
    } else {
      stack.push(segment);
    }
  }

  return stack.join("/");
}

export function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "";
}