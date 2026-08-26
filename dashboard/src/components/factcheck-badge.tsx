import { Badge } from "@/components/ui/badge"

export function FactcheckBadge({ verdict }: { verdict?: string }) {
  if (verdict === "PASS") return <Badge variant="success">fact-check PASS</Badge>
  if (verdict === "FAIL") return <Badge variant="destructive">fact-check FAIL</Badge>
  return <Badge variant="secondary">unchecked</Badge>
}
