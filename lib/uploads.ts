import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const MAX_BYTES = 8 * 1024 * 1024;

export function safeUploadPath(publicPath: string, folder: "members" | "gym") {
  if (!publicPath.startsWith(`/uploads/${folder}/`) || publicPath.includes("..")) {
    return null;
  }
  const full = path.resolve(process.cwd(), "public", publicPath.replace(/^\//, ""));
  const root = path.resolve(process.cwd(), "public", "uploads", folder);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return full;
}

export async function deleteUpload(publicPath: string | null | undefined) {
  if (!publicPath) return;
  const folder = publicPath.startsWith("/uploads/gym/")
    ? "gym"
    : publicPath.startsWith("/uploads/members/")
      ? "members"
      : null;
  if (!folder) return;
  const full = safeUploadPath(publicPath, folder);
  if (!full) return;
  await unlink(full).catch(() => undefined);
}

export async function saveImage(file: File, folder: "members" | "gym") {
  if (file.size <= 0) throw new Error("Le fichier est vide.");
  if (file.size > MAX_BYTES) throw new Error("La photo dépasse 8 Mo.");

  const input = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(input).metadata();
  if (metadata.format !== "jpeg" && metadata.format !== "png") {
    throw new Error("Format non pris en charge. Utilisez un fichier JPG ou PNG.");
  }

  const output = await sharp(input)
    .rotate()
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const filename = `${folder}-${Date.now()}-${randomBytes(4).toString("hex")}.jpg`;
  const directory = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), output);
  return `/uploads/${folder}/${filename}`;
}
