import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toastPostFailure, useSubmitLink } from "@/lib/resources";
import { toast } from "@/lib/toast";
import {
  resourceSubmissionInput,
  RESOURCE_NOTE_MAX_LENGTH,
  type ResourceSubmissionInput,
} from "../../../shared/schemas/resources";

/**
 * Sends a link to someone's request: an https link from any public site and an optional note, both
 * checked by the shared schema. Only the student who asked sees it, with the sender's username.
 */
export function SubmitForm({ requestId }: { requestId: number }) {
  const send = useSubmitLink(requestId);
  const form = useForm({
    resolver: zodResolver(resourceSubmissionInput),
    defaultValues: { url: "", note: "" },
  });
  const { errors } = form.formState;
  const note = useWatch({ control: form.control, name: "note" }) ?? "";

  const submit = form.handleSubmit((values: ResourceSubmissionInput) => {
    send.mutate(values, {
      onSuccess: (link) => {
        toast.success(
          link.status === "pending_review"
            ? "Link saved. It goes to the student once a moderator approves it."
            : "Link sent. You'll get a notification if it is accepted.",
        );
        form.reset();
      },
      onError: toastPostFailure,
    });
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.url)}>
          <FieldLabel htmlFor="link-url">Link</FieldLabel>
          <Input
            id="link-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://drive.google.com/..."
            aria-invalid={Boolean(errors.url)}
            {...form.register("url")}
          />
          <FieldDescription>
            Any https link: Google Drive, YouTube, Samsung Cloud, transfer.it and so on. Make sure
            anyone with the link can open it.
          </FieldDescription>
          <FieldError errors={[errors.url]} />
        </Field>
        <Field data-invalid={Boolean(errors.note)}>
          <FieldLabel htmlFor="link-note">Note (optional)</FieldLabel>
          <Textarea
            id="link-note"
            placeholder="What is in it, for example Midterm notes, Spring 2026"
            aria-invalid={Boolean(errors.note)}
            {...form.register("note")}
          />
          <FieldDescription className="tabular-nums">
            {note.length} / {RESOURCE_NOTE_MAX_LENGTH}
          </FieldDescription>
          <FieldError errors={[errors.note]} />
        </Field>
        <Button type="submit" loading={send.isPending}>
          Send link
        </Button>
      </FieldGroup>
    </form>
  );
}
