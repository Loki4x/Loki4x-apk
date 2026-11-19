import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Pilih gambar dari galeri lalu perkecil (maks lebar 1600 px, JPEG) supaya di bawah batas 2 MB server. */
export async function pickPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const ctx = ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > 1600) ctx.resize({ width: 1600 });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return saved.uri;
}
