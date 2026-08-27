import { Badge } from "@/components/ui/badge"

export function FactcheckBadge({ verdict }: { verdict?: string }) {
  if (verdict === "PASS")
    return (
      <Badge variant="success" className="whitespace-normal">
        ✓ Checked against product facts
      </Badge>
    )
  if (verdict === "FAIL")
    return (
      <Badge variant="destructive" className="whitespace-normal text-left leading-snug">
        ⚠ Some claims couldn&apos;t be verified — read before approving
      </Badge>
    )
  if (verdict === "STALE")
    return (
      <Badge variant="secondary" className="whitespace-normal text-left leading-snug">
        ⚠ Edited since last fact-check
      </Badge>
    )
  return <Badge variant="secondary">Not checked yet</Badge>
}
