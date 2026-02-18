import { AlertCircle } from "lucide-react";

interface SourceErrorProps {
  source: string;
}

export function SourceError({ source }: SourceErrorProps) {
  return (
    <div className="flex items-center gap-2.5 p-4 rounded-lg bg-destructive/[0.04] border border-destructive/15 text-[15px] text-destructive/90 mb-4">
      <AlertCircle className="h-4.5 w-4.5 shrink-0" />
      <span>{source} data unavailable for this digest</span>
    </div>
  );
}
