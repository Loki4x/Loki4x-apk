import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View, type StyleProp, type ImageStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { WEB_URL } from "@/lib/config";

/**
 * Foto privat chat/komunitas (bucket R2 privat): diambil lewat route web dengan token login,
 * jadi hanya member yang berhak yang bisa membukanya. Ketuk untuk ukuran penuh.
 */
export function AuthImage({ path, style }: { path: string; style?: StyleProp<ImageStyle> }) {
  const [token, setToken] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  if (!token) return <View style={[styles.placeholder, style]} />;
  const source = { uri: `${WEB_URL}${path}`, headers: { Authorization: `Bearer ${token}` } };
  return (
    <>
      <Pressable onPress={() => setFull(true)}>
        <Image source={source} style={style} resizeMode="cover" />
      </Pressable>
      <Modal visible={full} transparent animationType="fade" onRequestClose={() => setFull(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFull(false)}>
          <Image source={source} style={styles.full} resizeMode="contain" />
          <View style={styles.close}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export const communityImagePath = (key: string) => `/api/community/image?key=${encodeURIComponent(key)}`;
export const chatImagePath = (key: string) => `/api/chat/image?key=${encodeURIComponent(key)}`;

const styles = StyleSheet.create({
  placeholder: { backgroundColor: "rgba(127,127,127,0.2)" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  full: { width: "100%", height: "85%" },
  close: { position: "absolute", top: 48, right: 20 },
});
