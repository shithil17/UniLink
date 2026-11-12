import { useCallback, useRef, useState, type Ref } from "react";
import { useController, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  BD_PREFIX,
  contactValuesFromNumbers,
  normalizeLocalDigits,
  numbersFromContacts,
  type ContactNumbers,
} from "@/lib/contactForm";
import { toast } from "@/lib/toast";
import type { ContactsFormValues } from "../../../shared/schemas/common";

/**
 * A number field with a fixed "+880" inside its frame. The prefix is a label for the field, not text the
 * student types: they enter the ten digits ("1712345678"), and a pasted "01712345678" or
 * "+880 1712-345678" is cut down to those ten. The frame looks and focuses like `Input`.
 */
function NumberField({
  id,
  value,
  invalid,
  onChange,
  inputRef,
}: {
  id: string;
  value: string;
  invalid: boolean;
  onChange: (digits: string) => void;
  inputRef: Ref<HTMLInputElement>;
}) {
  return (
    <div
      className="flex min-h-12 w-full items-center rounded-control border-[1.5px] border-input bg-surface pl-3.5 focus-within:border-brand focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-solid focus-within:outline-brand has-aria-invalid:border-destructive has-aria-invalid:outline-destructive"
      data-slot="number-field"
    >
      <label htmlFor={id} className="text-base text-soft tabular-nums select-none">
        {BD_PREFIX}
      </label>
      <Input
        id={id}
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="1712345678"
        value={value}
        aria-invalid={invalid}
        onChange={(e) => onChange(normalizeLocalDigits(e.target.value))}
        className="min-h-[45px] flex-1 rounded-none border-0 bg-transparent pl-2 tabular-nums outline-none focus-visible:border-0 focus-visible:outline-none aria-invalid:border-0 aria-invalid:outline-none"
      />
    </div>
  );
}

/**
 * The contact block of a post form: one Bangladeshi mobile number ("+880" fixed, ten digits typed),
 * "Reach me on" toggles for calls and WhatsApp, and an optional Messenger or Facebook link. The form
 * holds them under `contacts` (`{ contacts: ContactsFormValues }`), is wrapped in a react-hook-form
 * `FormProvider`, and validates with a shared schema that includes `contacts` from
 * `src/shared/schemas/common.ts`. The number becomes the stored values (`phone` as "+880...",
 * `whatsapp` as a wa.me link) in `src/client/lib/contactForm.ts`, so the formats and the "at least one"
 * rule are the server's own and the contact buttons open the dialer or WhatsApp. Opening an existing
 * post, a WhatsApp number that differs from the phone gets its own field so neither is lost. Errors are
 * toasts from the form; their text here is for screen readers, and focus lands on the number.
 */
export function ContactInput() {
  const {
    control,
    getValues,
    register,
    formState: { errors },
  } = useFormContext<{ contacts: ContactsFormValues }>();
  const phone = useController({ control, name: "contacts.phone" });
  const whatsapp = useController({ control, name: "contacts.whatsapp" });
  const [numbers, setNumbers] = useState<ContactNumbers>(() =>
    numbersFromContacts(getValues("contacts") ?? {}),
  );
  const e = errors.contacts;
  const split = numbers.otherWhatsapp !== null;

  const apply = (next: ContactNumbers) => {
    setNumbers(next);
    const values = contactValuesFromNumbers(next);
    phone.field.onChange(values.phone);
    whatsapp.field.onChange(values.whatsapp);
  };

  // Both stored values are typed in the first field, unless WhatsApp has its own. A failed submit
  // focuses the field of the first error, and either way that has to be an input on screen.
  const { ref: phoneRef } = phone.field;
  const { ref: whatsappRef } = whatsapp.field;
  const primary = useRef<HTMLInputElement | null>(null);
  const setPrimary = useCallback(
    (el: HTMLInputElement | null) => {
      primary.current = el;
      phoneRef(el);
      if (!split) whatsappRef(el);
    },
    [phoneRef, whatsappRef, split],
  );

  const setToggle = (key: "calls" | "whatsapp", on: boolean) => {
    if (!on && !(key === "calls" ? numbers.whatsapp : numbers.calls)) {
      toast("Keep at least one on, so students know how to reach you.");
      return;
    }
    apply({ ...numbers, [key]: on });
  };

  const primaryInvalid = Boolean(e?.phone) || (!split && Boolean(e?.whatsapp));

  return (
    <FieldGroup>
      <Field data-invalid={primaryInvalid}>
        <FieldLabel htmlFor="contact-phone">Phone number</FieldLabel>
        <NumberField
          id="contact-phone"
          value={numbers.digits}
          invalid={primaryInvalid}
          inputRef={setPrimary}
          onChange={(digits) => apply({ ...numbers, digits })}
        />
        <FieldError errors={[e?.phone, split ? undefined : e?.whatsapp]} />
      </Field>
      {split ? (
        <Field data-invalid={Boolean(e?.whatsapp)}>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="contact-whatsapp">WhatsApp number</FieldLabel>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="-my-3.5 -mr-1.5"
              onClick={() =>
                apply({ ...numbers, calls: true, whatsapp: true, otherWhatsapp: null })
              }
            >
              Use the same number
            </Button>
          </div>
          <NumberField
            id="contact-whatsapp"
            value={numbers.otherWhatsapp ?? ""}
            invalid={Boolean(e?.whatsapp)}
            inputRef={whatsappRef}
            onChange={(digits) => apply({ ...numbers, otherWhatsapp: digits })}
          />
          <FieldError errors={[e?.whatsapp]} />
        </Field>
      ) : (
        <Field role="group" aria-labelledby="contact-reach-label">
          <div className="flex items-center justify-between gap-3">
            <span
              id="contact-reach-label"
              className="text-[13px] leading-[1.3] font-medium text-soft"
            >
              Reach me on
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="-my-3.5 -mr-1.5"
              onClick={() =>
                apply(
                  numbers.calls
                    ? { ...numbers, otherWhatsapp: "" }
                    : { ...numbers, digits: "", otherWhatsapp: numbers.digits },
                )
              }
            >
              Use a different WhatsApp number
            </Button>
          </div>
          <div className="flex gap-2">
            <Chip pressed={numbers.calls} onPressedChange={(on) => setToggle("calls", on)}>
              Calls
            </Chip>
            <Chip pressed={numbers.whatsapp} onPressedChange={(on) => setToggle("whatsapp", on)}>
              WhatsApp
            </Chip>
          </div>
        </Field>
      )}
      <Field data-invalid={Boolean(e?.messenger)}>
        <FieldLabel htmlFor="contact-messenger">Messenger or Facebook link</FieldLabel>
        <Input
          id="contact-messenger"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://m.me/yourname"
          aria-invalid={Boolean(e?.messenger)}
          {...register("contacts.messenger")}
        />
        <FieldDescription>
          Add at least one. Students only see it after they tap to show your contact.
        </FieldDescription>
        <FieldError errors={[e?.messenger]} />
      </Field>
    </FieldGroup>
  );
}
