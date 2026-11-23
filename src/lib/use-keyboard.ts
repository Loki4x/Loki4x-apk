import { useEffect, useState } from "react";
import { Keyboard, LayoutAnimation, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Tinggi keyboard yang perlu "diganjal" di bawah layar chat.
 *
 * Android 15+ (edge-to-edge) tidak lagi mengecilkan layar otomatis saat keyboard muncul, jadi
 * KeyboardAvoidingView bawaan tidak bekerja dan kolom chat tertutup keyboard. Hook ini membaca
 * tinggi keyboard langsung dari event sistem; jarak aman bawah (gesture bar) sudah ditangani
 * SafeAreaView, jadi dikurangkan supaya tidak dobel.
 */
export function useKeyboardInset(): number {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const animate = (duration?: number) => {
      LayoutAnimation.configureNext({
        duration: duration && duration > 10 ? duration : 220,
        update: { type: LayoutAnimation.Types.keyboard ?? LayoutAnimation.Types.easeInEaseOut },
      });
    };
    const show = Keyboard.addListener(showEvent, (e) => {
      animate(e.duration);
      setHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, (e) => {
      animate(e?.duration);
      setHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return Math.max(0, height - insets.bottom);
}
