import { Linking, Text, type StyleProp, type TextStyle } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/lib/theme";

// http(s)://… atau www.… sampai spasi berikutnya.
const URL_RE = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+\.[^\s<>"]+)/gi;
// Tanda baca di akhir kalimat bukan bagian dari link ("cek https://contoh.com.").
const TRAILING = /[.,!?;:)\]}'"]+$/;

/** Buka link dari pesan: web di browser dalam aplikasi, link aplikasi (WhatsApp, Telegram, dll) lewat sistem. */
export async function openMessageLink(raw: string) {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    if (/(wa\.me|whatsapp\.com|t\.me|instagram\.com|tiktok\.com|youtube\.com|youtu\.be)/i.test(url)) await Linking.openURL(url);
    else await WebBrowser.openBrowserAsync(url);
  } catch {
    Linking.openURL(url).catch(() => {});
  }
}

const SIZE = { body: 15, bodySm: 13, caption: 11 } as const;

/**
 * Teks pesan dengan link yang berwarna biru dan bisa ditekan (seperti WhatsApp).
 * Memakai <Text> biasa (bukan <T>) supaya isi pesan user tidak ikut "diterjemahkan".
 */
export function LinkText({ text, variant = "bodySm", style }: { text: string; variant?: "body" | "bodySm" | "caption"; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  const parts: { text: string; url?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let match = m[0];
    const trail = match.match(TRAILING)?.[0] ?? "";
    if (trail) match = match.slice(0, -trail.length);
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: match, url: match });
    last = start + match.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });

  return (
    <Text style={[{ fontSize: SIZE[variant], lineHeight: Math.round(SIZE[variant] * 1.4), color: colors.text }, style]}>
      {parts.map((p, i) =>
        p.url ? (
          <Text key={i} onPress={() => openMessageLink(p.url!)} suppressHighlighting={false} style={{ color: "#4F8CFF", textDecorationLine: "underline" }}>
            {p.text}
          </Text>
        ) : (
          p.text
        )
      )}
    </Text>
  );
}
