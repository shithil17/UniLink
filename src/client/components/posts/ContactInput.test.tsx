// @vitest-environment happy-dom
import { zodResolver } from "@hookform/resolvers/zod";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CONTACT_MESSAGES, CONTACT_REQUIRED_MESSAGE } from "../../../shared/contact";
import { contacts, type ContactsFormValues } from "../../../shared/schemas/common";
import { ContactInput } from "./ContactInput";

afterEach(cleanup);

const schema = z.object({ contacts });

function Harness({ onValid }: { onValid: (v: unknown) => void }) {
  const form = useForm<{ contacts: ContactsFormValues }>({
    resolver: zodResolver(schema),
    defaultValues: { contacts: { phone: "", whatsapp: "", messenger: "" } },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit((v) => onValid(v))} noValidate>
        <ContactInput />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("ContactInput", () => {
  it("asks for at least one contact before it sends anything", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(CONTACT_REQUIRED_MESSAGE)).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("shows a bad value under its own field", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    type("Phone", "0171");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(CONTACT_MESSAGES.phone)).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("passes the shared schema's trimmed values on, leaving blanks out", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    type("WhatsApp link", " https://wa.me/8801712345678 ");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(onValid.mock.calls[0]![0]).toEqual({
      contacts: { phone: undefined, whatsapp: "https://wa.me/8801712345678", messenger: undefined },
    });
  });
});
