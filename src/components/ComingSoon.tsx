import { Linking, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { WEB_URL } from "@/lib/config";

/** Layar sementara untuk fitur yang menyusul di update aplikasi berikutnya. */
export function ComingSoon({
  title,
  description,
  icon,
  webPath,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  webPath: string;
}) {
  const { colors } = useTheme();
  return (
    <Screen>
      <T variant="h2">{title}</T>
      <Card style={{ alignItems: "center", paddingVertical: 32 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySubtle,
          }}
        >
          <Ionicons name={icon} size={30} color={colors.primary} />
        </View>
        <T variant="h3" style={{ textAlign: "center" }}>Segera hadir di aplikasi</T>
        <T variant="bodySm" color="textSecondary" style={{ textAlign: "center" }}>{description}</T>
        <Button
          title="Buka di web dulu"
          variant="secondary"
          onPress={() => Linking.openURL(`${WEB_URL}${webPath}`)}
          style={{ alignSelf: "stretch", marginTop: 8 }}
        />
      </Card>
    </Screen>
  );
}
