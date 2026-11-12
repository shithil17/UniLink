import { useFormContext } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ContactsFormValues } from "../../../shared/schemas/common";

/**
 * The three contact fields of a post form: phone, WhatsApp link, Messenger or Facebook link. The form
 * holds them under `contacts` (`{ contacts: ContactsFormValues }`), is wrapped in a react-hook-form
 * `FormProvider`, and validates with a shared schema that includes `contacts` from
 * `src/shared/schemas/common.ts`, so the formats and the "at least one" rule are the server's own.
 * Each message shows under its field; "add at least one" shows under the phone.
 */
export function ContactInput() {
  const {
    register,
    formState: { errors },
  } = useFormContext<{ contacts: ContactsFormValues }>();
  const e = errors.contacts;

  return (
    <FieldGroup>
      <Field data-invalid={Boolean(e?.phone)}>
        <FieldLabel htmlFor="contact-phone">Phone</FieldLabel>
        <Input
          id="contact-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="+8801712345678"
          aria-invalid={Boolean(e?.phone)}
          {...register("contacts.phone")}
        />
        <FieldError errors={[e?.phone]} />
      </Field>
      <Field data-invalid={Boolean(e?.whatsapp)}>
        <FieldLabel htmlFor="contact-whatsapp">WhatsApp link</FieldLabel>
        <Input
          id="contact-whatsapp"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://wa.me/8801712345678"
          aria-invalid={Boolean(e?.whatsapp)}
          {...register("contacts.whatsapp")}
        />
        <FieldError errors={[e?.whatsapp]} />
      </Field>
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
