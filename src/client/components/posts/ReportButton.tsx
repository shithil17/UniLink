import { FlagIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PostTargetType } from "@/lib/posts";
import { ReportSheet } from "./ReportSheet";

/**
 * The report trigger of a post: a quiet ghost button that opens the report sheet for it. `label` is the
 * button's words and the sheet's title ("Report this ride"). A post type adds its `target_type` to the
 * shared `reportTargetType` list and the report queue, then passes it here.
 */
export function ReportButton({
  type,
  id,
  label,
  description,
}: {
  type: PostTargetType;
  id: number;
  label: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <FlagIcon aria-hidden strokeWidth={1.75} />
        {label}
      </Button>
      <ReportSheet
        target={open ? { type, id } : null}
        title={label}
        description={description}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
