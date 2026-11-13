import { Trash2Icon } from "lucide-react";
import { deletePostConfirm, useDeletePost } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/lib/useConfirm";

/**
 * The author's delete for their own post, behind a confirm sheet that says what happens (gone for
 * everyone at once, removed for good after the purge window). `basePath` is the type's API path
 * (`/api/rides`); the delete is `DELETE <basePath>/:id`. `what` names the post in the sentence
 * ("ride"). `onDeleted` runs after it worked, to leave a detail screen that no longer exists.
 */
export function DeletePostButton({
  basePath,
  id,
  what,
  onDeleted,
}: {
  basePath: `/api/${string}`;
  id: number;
  what: string;
  onDeleted?: () => void;
}) {
  const remove = useDeletePost(basePath);
  const { ask, element } = useConfirm();

  const confirm = () =>
    ask(
      deletePostConfirm(what, async () => {
        await remove.mutateAsync(id);
        toast.success(`Your ${what} was deleted.`);
        onDeleted?.();
      }),
    );

  return (
    <>
      <Button variant="ghost" size="sm" className="text-danger" onClick={confirm}>
        <Trash2Icon aria-hidden strokeWidth={1.75} />
        {`Delete this ${what}`}
      </Button>
      {element}
    </>
  );
}
