// Receipt image pipeline: validate → re-encode (strips EXIF/payloads) → hash →
// store privately outside web root with random names.
import sharp from "sharp";
import { createHash, randomBytes } from "crypto";
import path from "path";
import fs from "fs/promises";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const receiptsDir = path.join(dataDir, "receipts");

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

export interface StoredReceipt {
  /** relative path inside the private data dir, e.g. receipts/ab12...cd.webp */
  relPath: string;
  /** sha256 of the ORIGINAL upload (for exact-duplicate detection) */
  hash: string;
}

/**
 * Process an uploaded receipt image.
 * Throws with a Persian message if the file is not a decodable image.
 */
export async function storeReceipt(buf: Buffer): Promise<StoredReceipt> {
  if (buf.length > MAX_RECEIPT_BYTES) {
    throw new Error("حجم تصویر بیشتر از ۵ مگابایت است");
  }
  const hash = createHash("sha256").update(buf).digest("hex");

  let out: Buffer;
  try {
    // Re-encode: proves it's a real image, strips EXIF, normalizes format,
    // and shrinks multi-MB phone screenshots.
    out = await sharp(buf, { failOn: "error" })
      .rotate() // apply EXIF orientation before it's stripped
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new Error("فایل ارسالی تصویر معتبری نیست");
  }

  await fs.mkdir(receiptsDir, { recursive: true });
  const name = randomBytes(16).toString("hex") + ".webp";
  await fs.writeFile(path.join(receiptsDir, name), out);
  return { relPath: path.posix.join("receipts", name), hash };
}

/** Absolute path for serving a stored receipt through the authed route. */
export function receiptAbsPath(relPath: string): string {
  const abs = path.resolve(dataDir, relPath);
  // prevent traversal outside the receipts dir
  if (!abs.startsWith(path.resolve(receiptsDir))) throw new Error("مسیر نامعتبر");
  return abs;
}
