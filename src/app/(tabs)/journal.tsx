import { ComingSoon } from "@/components/ComingSoon";

export default function JournalScreen() {
  return (
    <ComingSoon
      title="Trading Journal"
      icon="book-outline"
      webPath="/trades"
      description="Catat & edit trade, aturan risiko, target bulanan, statistik, dan import MT4/MT5 akan hadir di update berikutnya."
    />
  );
}
