import { Icon } from "./Icon";
import type { Evidence } from "@/lib/types";

export function EvidenceBlock({
  evidence,
  accent = "primary",
  onViewInTranscript,
}: {
  evidence: Evidence;
  accent?: "primary" | "secondary" | "error";
  onViewInTranscript?: (turnId: string) => void;
}) {
  const bar = accent === "error" ? "bg-error" : accent === "secondary" ? "bg-secondary" : "bg-primary";
  const iconColor = accent === "error" ? "text-error" : accent === "secondary" ? "text-secondary" : "text-primary";

  return (
    <div className="bg-surface-container-low p-space-md rounded-lg mb-space-md pl-space-lg relative">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar} rounded-l`} />
      <div className="flex items-start gap-space-sm">
        <Icon name="format_quote" className={`${iconColor} text-base mt-0.5`} />
        <div className="flex-1">
          <p className="font-body-md text-body-md text-on-surface italic">&ldquo;{evidence.quote}&rdquo;</p>
          <div className="flex items-center justify-between mt-space-xs flex-wrap gap-space-xs">
            <span className="font-label-sm text-label-sm text-outline font-mono-code">
              [{evidence.timestamp}] {evidence.speaker}
              {evidence.speakerRole ? ` (${evidence.speakerRole})` : ""}
            </span>
            {onViewInTranscript && (
              <button
                type="button"
                onClick={() => onViewInTranscript(evidence.turnIds[0])}
                className="quote-sync-btn flex items-center gap-space-2xs text-secondary hover:text-on-secondary-fixed font-label-sm text-label-sm group"
              >
                <span>View in transcript</span>
                <Icon name="arrow_forward" className="text-xs group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
