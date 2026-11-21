import { File } from "expo-file-system";

/**
 * Bagian file untuk FormData upload (foto trade, chat, komunitas, sinyal, bukti transfer, Link Page).
 *
 * Fetch bawaan Expo tidak menerima bentuk lama React Native `{ uri, name, type }` dan gagal dengan
 * "Unsupported FormDataPart implementation". Ia menerima objek yang punya `bytes()`, jadi isi file
 * dibaca dari `uri` saat request dikirim; `name` & `type` dipakai untuk header bagian multipart.
 */
export function filePart(uri: string, name: string, type = "image/jpeg"): Blob {
  return {
    name,
    type,
    bytes: async () => new Uint8Array(await new File(uri).arrayBuffer()),
  } as unknown as Blob;
}
