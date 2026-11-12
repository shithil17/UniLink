import { zodResolver } from "@hookform/resolvers/zod";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { CoursePicker } from "@/components/courses/CoursePicker";
import { FacultyPicker } from "@/components/courses/FacultyPicker";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioChip, RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { CourseChoice } from "@/lib/courseSearch";
import {
  DEFAULT_EXPIRY_MS,
  EXPIRY_CHOICES,
  expiresAtFor,
  purgeNotice,
  toastPostFailure,
  useCreateRequest,
} from "@/lib/resources";
import { toast } from "@/lib/toast";
import {
  resourceRequestInput,
  RESOURCE_NOTE_MAX_LENGTH,
  type ResourceRequest,
  type ResourceRequestFormValues,
} from "../../../shared/schemas/resources";

/** The refine on the shared schema ("a course, a faculty, or both") reports against the form itself, under an empty key. */
const needOneMessage = (errors: object) =>
  (errors as Record<string, { message?: string } | undefined>)[""]?.message;

/**
 * Asks for materials: a course, a faculty member or both, a short note, and when the request
 * lapses. The expiry is the requester's pick from a few fixed spans, turned into an instant when
 * they send, so a form left open does not send a stale time. The words under it say what is
 * deleted and when.
 */
export function RequestForm({
  choices,
  onSent,
  onCancel,
}: {
  choices: readonly CourseChoice[];
  onSent: (request: ResourceRequest) => void;
  onCancel: () => void;
}) {
  const create = useCreateRequest();
  const [expiryMs, setExpiryMs] = useState(DEFAULT_EXPIRY_MS);
  const [initialExpiry] = useState(() => expiresAtFor(DEFAULT_EXPIRY_MS));
  const form = useForm<ResourceRequestFormValues>({
    resolver: zodResolver(resourceRequestInput) as Resolver<ResourceRequestFormValues>,
    defaultValues: { note: "", expiresAt: initialExpiry },
  });
  const { errors } = form.formState;
  const note = useWatch({ control: form.control, name: "note" }) ?? "";
  const notice = purgeNotice();
  const needOne = needOneMessage(errors);

  const submit = form.handleSubmit((values) => {
    create.mutate(resourceRequestInput.parse({ ...values, expiresAt: expiresAtFor(expiryMs) }), {
      onSuccess: (request) => {
        toast.success(
          request.status === "pending_review"
            ? "Request saved. It goes out once a moderator approves it."
            : "Request posted. You'll get a notification when someone sends a link.",
        );
        onSent(request);
      },
      onError: toastPostFailure,
    });
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(needOne)}>
          <FieldLabel htmlFor="request-course">Course (optional)</FieldLabel>
          <Controller
            control={form.control}
            name="courseCode"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <CoursePicker
                    id="request-course"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    choices={choices}
                    placeholder="Any course"
                    title="Which course?"
                  />
                </div>
                {field.value ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Clear the course"
                    onClick={() => field.onChange(undefined)}
                  >
                    <XIcon aria-hidden />
                  </Button>
                ) : null}
              </div>
            )}
          />
        </Field>
        <Field data-invalid={Boolean(needOne)}>
          <FieldLabel htmlFor="request-faculty">Faculty (optional)</FieldLabel>
          <Controller
            control={form.control}
            name="facultyId"
            render={({ field }) => (
              <FacultyPicker
                id="request-faculty"
                title="Which faculty member?"
                value={field.value ?? null}
                onChange={(next) => field.onChange(next ?? undefined)}
              />
            )}
          />
          <FieldDescription>
            Pick a course, a faculty member, or both. Students who took what you pick are told.
          </FieldDescription>
          <FieldError errors={[needOne ? { message: needOne } : undefined]} />
        </Field>
        <Field data-invalid={Boolean(errors.note)}>
          <FieldLabel htmlFor="request-note">What are you looking for? (optional)</FieldLabel>
          <Textarea
            id="request-note"
            placeholder="Midterm notes, past papers, lecture slides"
            aria-invalid={Boolean(errors.note)}
            {...form.register("note")}
          />
          <FieldDescription className="tabular-nums">
            {note.length} / {RESOURCE_NOTE_MAX_LENGTH}
          </FieldDescription>
          <FieldError errors={[errors.note]} />
        </Field>
        <Field>
          <FieldLabel id="request-expiry-label">Keep it open for</FieldLabel>
          <RadioGroup
            aria-labelledby="request-expiry-label"
            value={String(expiryMs)}
            onValueChange={(v) => setExpiryMs(Number(v))}
            className="grid-cols-5 gap-1.5"
          >
            {EXPIRY_CHOICES.map((c) => (
              <RadioChip key={c.ms} value={String(c.ms)} aria-label={c.label}>
                <span aria-hidden className="text-[15px] leading-none font-bold tabular-nums">
                  {c.label.split(" ")[0]}
                </span>
                <span
                  aria-hidden
                  className="text-[12px] leading-none font-medium text-faint group-data-checked/radio-chip:text-brand-ink"
                >
                  {c.label.split(" ")[1]}
                </span>
              </RadioChip>
            ))}
          </RadioGroup>
          <FieldDescription>
            {notice.open} {notice.fulfilled}
          </FieldDescription>
        </Field>
        <div className="flex flex-col gap-2">
          <Button type="submit" loading={create.isPending}>
            Post request
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
