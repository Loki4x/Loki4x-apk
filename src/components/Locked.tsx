import { router } from "expo-router";
import { Button, Card, T } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** Kartu "fitur terkunci" dengan tombol ke layar Upgrade. */
export function Locked({ tier, description }: { tier: "VIP" | "MEMBERSHIP"; description: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ borderColor: colors.primary }}>
      <T variant="h3">{tier === "VIP" ? "Khusus member VIP 🔒" : "Khusus Membership 🔒"}</T>
      <T variant="bodySm" color="textSecondary">{description}</T>
      <Button title="Upgrade sekarang" onPress={() => router.push("/upgrade")} />
    </Card>
  );
}
