import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { OptionSelect } from "@/components/courses/OptionSelect";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { categoryLabel } from "@/lib/modQueue";
import {
  rejectCategory,
  rejectPostRequest,
  type ModQueuePost,
} from "../../../shared/schemas/moderation";
import { ReasonField } from "./ReasonField";

type Values = z.input<typeof rejectPostRequest>;

const options = rejectCategory.options.map((value) => ({ value, label: categoryLabel(value) }));

/** The reject form for a held post: a category the author will see as a message, and a reason for the audit log. */
export function RejectPostSheet({
  post,
  pending,
  onSubmit,
  onClose,
}: {
  post: ModQueuePost | null;
  pending: boolean;
  onSubmit: (values: z.output<typeof rejectPostRequest>) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={post !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        {post ? (
          <RejectForm
            key={`${post.targetType}:${post.id}`}
            post={post}
            pending={pending}
            onSubmit={onSubmit}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RejectForm({
  post,
  pending,
  onSubmit,
  onClose,
}: {
  post: ModQueuePost;
  pending: boolean;
  onSubmit: (values: z.output<typeof rejectPostRequest>) => void;
  onClose: () => void;
}) {
  const preset = rejectCategory.safeParse(post.category);
  const form = useForm<Values, unknown, z.output<typeof rejectPostRequest>>({
    resolver: zodResolver(rejectPostRequest),
    // "No issue found" is not a reason, so the mod picks one rather than getting a wrong default.
    defaultValues: { reason: "", category: preset.success ? preset.data : undefined },
  });
  const { errors } = form.formState;

  return (
    <>
      <SheetHeader>
        <SheetTitle>Reject this post</SheetTitle>
        <SheetDescription>
          {post.author ?? "A removed account"} gets a message for the category you choose. Your
          reason stays in the audit log.
        </SheetDescription>
      </SheetHeader>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4">
        <FieldGroup>
          <Field data-invalid={Boolean(errors.category)}>
            <FieldLabel htmlFor={`reject-category-${post.id}`}>Category</FieldLabel>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <OptionSelect
                  id={`reject-category-${post.id}`}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  options={options}
                  placeholder="Choose a category"
                  invalid={Boolean(errors.category)}
                />
              )}
            />
            <FieldDescription>The author sees a short message for this category.</FieldDescription>
            <FieldError errors={[errors.category]} />
          </Field>
          <ReasonField
            id={`reject-reason-${post.id}`}
            register={form.register("reason")}
            error={errors.reason}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" size="lg" disabled={pending}>
              {pending ? "Rejecting" : "Reject post"}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </>
  );
}
