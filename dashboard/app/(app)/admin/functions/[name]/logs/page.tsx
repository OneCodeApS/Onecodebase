import { Card } from "../../../../_components/Card";

export default function LogsPage() {
  return (
    <Card padded>
      <p className="text-sm text-neutral-400">
        Function stdout/stderr capture isn't wired yet. For now, see the{" "}
        <span className="font-mono">Invocations</span> tab for status + error
        messages, or check the dashboard process console for{" "}
        <span className="font-mono">console.log</span> output.
      </p>
    </Card>
  );
}
