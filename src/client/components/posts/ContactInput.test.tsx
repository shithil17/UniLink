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

const blank = { phone: "", whatsapp: "", messenger: "" };

function Harness({
  onValid,
  initial = blank,
}: {
  onValid: (v: unknown) => void;
  initial?: ContactsFormValues;
}) {
  const form = useForm<{ contacts: ContactsFormValues }>({
    resolver: zodResolver(schema),
    defaultValues: { contacts: initial },
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
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));
const toggle = (name: "Calls" | "WhatsApp") =>
  fireEvent.click(screen.getByRole("button", { name: name }));
const submitted = async (onValid: ReturnType<typeof vi.fn>) => {
  await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
  return (onValid.mock.calls[0]![0] as { contacts: unknown }).contacts;
};

describe("ContactInput", () => {
  it("asks for at least one contact before it sends anything", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    save();
    expect(await screen.findByText(CONTACT_REQUIRED_MESSAGE)).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
  });

  it("marks a short number and says it with the shared message", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    type("Phone number", "0171");
    save();
    expect(await screen.findAllByText(CONTACT_MESSAGES.phone)).not.toHaveLength(0);
    expect(screen.getByLabelText("Phone number").getAttribute("aria-invalid")).toBe("true");
    expect(onValid).not.toHaveBeenCalled();
  });

  it("does not let a short number through as a WhatsApp link", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    toggle("Calls");
    type("Phone number", "1712");
    save();
    expect(await screen.findAllByText(CONTACT_MESSAGES.whatsapp)).not.toHaveLength(0);
    expect(onValid).not.toHaveBeenCalled();
  });

  it("shows a fixed +880 and sends the number as a phone and a WhatsApp link, both on by default", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    expect(screen.getByText("+880")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Calls" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "WhatsApp" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const input = screen.getByLabelText("Phone number") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("tel");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("autocomplete")).toBe("tel-national");
    type("Phone number", "01712345678");
    expect(input.value).toBe("1712345678");
    save();
    expect(await submitted(onValid)).toEqual({
      phone: "+8801712345678",
      whatsapp: "https://wa.me/8801712345678",
      messenger: undefined,
    });
  });

  it.each(["8801712345678", "+8801712345678", "+880 1712-345678"])(
    "reduces a pasted %s to the ten digits",
    (pasted) => {
      render(<Harness onValid={vi.fn()} />);
      type("Phone number", pasted);
      expect((screen.getByLabelText("Phone number") as HTMLInputElement).value).toBe("1712345678");
    },
  );

  it("sends no phone when only WhatsApp is on", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    type("Phone number", "1712345678");
    toggle("Calls");
    save();
    expect(await submitted(onValid)).toEqual({
      phone: undefined,
      whatsapp: "https://wa.me/8801712345678",
      messenger: undefined,
    });
  });

  it("keeps one toggle on", () => {
    render(<Harness onValid={vi.fn()} />);
    toggle("Calls");
    toggle("WhatsApp");
    expect(screen.getByRole("button", { name: "WhatsApp" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("opens a stored phone and WhatsApp on the same number as one number with both on", async () => {
    const onValid = vi.fn();
    render(
      <Harness
        onValid={onValid}
        initial={{ ...blank, phone: "+8801712345678", whatsapp: "https://wa.me/+8801712345678" }}
      />,
    );
    expect((screen.getByLabelText("Phone number") as HTMLInputElement).value).toBe("1712345678");
    expect(screen.getByRole("button", { name: "WhatsApp" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.queryByLabelText("WhatsApp number")).toBeNull();
  });

  it("keeps a different stored WhatsApp number in its own field", async () => {
    const onValid = vi.fn();
    render(
      <Harness
        onValid={onValid}
        initial={{ ...blank, phone: "+8801712345678", whatsapp: "https://wa.me/8801912345678" }}
      />,
    );
    expect((screen.getByLabelText("Phone number") as HTMLInputElement).value).toBe("1712345678");
    expect((screen.getByLabelText("WhatsApp number") as HTMLInputElement).value).toBe("1912345678");
    type("Phone number", "1812345678");
    save();
    expect(await submitted(onValid)).toEqual({
      phone: "+8801812345678",
      whatsapp: "https://wa.me/8801912345678",
      messenger: undefined,
    });
  });

  it("adds a separate WhatsApp number on request and takes it away again", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    type("Phone number", "1712345678");
    fireEvent.click(screen.getByRole("button", { name: "Use a different WhatsApp number" }));
    type("WhatsApp number", "01912345678");
    save();
    expect(await submitted(onValid)).toEqual({
      phone: "+8801712345678",
      whatsapp: "https://wa.me/8801912345678",
      messenger: undefined,
    });
    cleanup();

    const again = vi.fn();
    render(<Harness onValid={again} />);
    type("Phone number", "1712345678");
    fireEvent.click(screen.getByRole("button", { name: "Use a different WhatsApp number" }));
    fireEvent.click(screen.getByRole("button", { name: "Use the same number" }));
    expect(screen.queryByLabelText("WhatsApp number")).toBeNull();
    save();
    expect(await submitted(again)).toMatchObject({
      phone: "+8801712345678",
      whatsapp: "https://wa.me/8801712345678",
    });
  });

  it("still takes a Messenger link on its own", async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    type("Messenger or Facebook link", " https://m.me/some.one ");
    save();
    expect(await submitted(onValid)).toEqual({
      phone: undefined,
      whatsapp: undefined,
      messenger: "https://m.me/some.one",
    });
  });
});
