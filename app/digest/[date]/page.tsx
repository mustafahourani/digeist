import { getDigest } from "@/lib/storage";
import { getToday } from "@/lib/utils";
import { DayNav } from "@/components/nav/day-nav";
import { DigestPage } from "@/components/digest/digest-page";
import { Clock, Calendar } from "lucide-react";

interface DigestDatePageProps {
  params: Promise<{ date: string }>;
}

export default async function DigestDatePage({ params }: DigestDatePageProps) {
  const { date } = await params;
  const today = getToday();
  const isToday = date === today;
  const isFuture = date > today;
  const digest = await getDigest(date);

  if (!digest) {
    return (
      <div>
        <DayNav currentDate={date} hasNext={!isToday && !isFuture} />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          {isToday ? (
            <>
              <div className="w-12 h-12 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-4">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[15px] font-medium mb-1">Digest not ready yet</p>
              <p className="text-[13px] text-muted-foreground">
                Today&apos;s digest will be generated at 12:00 PM EST
              </p>
            </>
          ) : isFuture ? (
            <>
              <div className="w-12 h-12 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[15px] font-medium mb-1">Future date</p>
              <p className="text-[13px] text-muted-foreground">
                This digest hasn&apos;t been generated yet
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-foreground/[0.04] flex items-center justify-center mb-4">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[15px] font-medium mb-1">No digest available</p>
              <p className="text-[13px] text-muted-foreground">
                There&apos;s no digest for this date
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <DayNav currentDate={date} hasNext={!isToday} />
      <DigestPage digest={digest} />
    </div>
  );
}
