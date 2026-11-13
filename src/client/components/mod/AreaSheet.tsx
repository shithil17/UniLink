import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { OptionSelect } from "@/components/courses/OptionSelect";
import { PinPicker } from "@/components/map/PinPicker";
import { PlaceSearch } from "@/components/map/PlaceSearch";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError, errorMessage } from "@/lib/api";
import { useAddArea, useRenameArea, useSetAreaHidden, useSetAreaPoint } from "@/lib/areas";
import { useMapParam } from "@/lib/map/useMapParam";
import {
  areaAddConfirm,
  areaHiddenConfirm,
  areaRenameConfirm,
  NOTHING_TO_SAVE,
} from "@/lib/modConfirm";
import { toastFirstFieldError } from "@/lib/formErrors";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/lib/useConfirm";
import {
  AREA_NAME_MAX_LENGTH,
  areaInput,
  areaPatch,
  NO_POINT_AREA_SLUG,
  type AreaInput,
  type AreaPatch,
  type ModArea,
} from "../../../shared/schemas/areas";
import { ReasonForm } from "./ReasonForm";

/**
 * What the sheet is showing: a new area (under `parent`, or top level when null), an existing one
 * to rename, hide or show, or nothing (closed). `parents` are the top-level areas a new area can sit under.
 */
/** The map name in the URL while the point picker is open. */
export const AREA_POINT_MAP = "area-point";

export const AREA_POINT_HINT =
  "Place the pin at the centre of the area, where students would expect it.";

export type AreaSheetTarget =
  | { mode: "add"; parent: ModArea | null }
  | { mode: "edit"; area: ModArea; parent: ModArea | null }
  | null;

const TOP_LEVEL = "top";

export function AreaSheet({
  target,
  parents,
  onTarget,
}: {
  target: AreaSheetTarget;
  /** Every top-level area, for the "Under" choice of a new area. */
  parents: readonly ModArea[];
  onTarget: (target: AreaSheetTarget) => void;
}) {
  const onClose = () => onTarget(null);
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        {target?.mode === "add" ? (
          <AddArea
            key={`add-${target.parent?.id ?? "top"}`}
            initialParent={target.parent}
            parents={parents}
            onClose={onClose}
          />
        ) : target?.mode === "edit" ? (
          <EditArea
            key={target.area.id}
            area={target.area}
            parent={target.parent}
            onAddSub={() => onTarget({ mode: "add", parent: target.area })}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function AddArea({
  initialParent,
  parents,
  onClose,
}: {
  initialParent: ModArea | null;
  parents: readonly ModArea[];
  onClose: () => void;
}) {
  const add = useAddArea();
  const form = useForm<AreaInput>({
    resolver: zodResolver(areaInput),
    defaultValues: { name: "", parentId: initialParent?.id },
  });
  const { errors } = form.formState;
  const confirm = useConfirm();

  const options = [
    { value: TOP_LEVEL, label: "Nothing, a top-level area" },
    ...parents.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  const submit = form.handleSubmit((values) => {
    const parent = parents.find((p) => p.id === values.parentId) ?? null;
    confirm.ask({
      ...areaAddConfirm(values.name, parent?.name ?? null),
      run: async () => {
        await add.mutateAsync(values).catch((err: unknown) => {
          // The confirm sheet toasts the error thrown on below.
          if (err instanceof ApiError && err.code === "name_taken") {
            form.setError("name", { message: errorMessage(err) });
          }
          throw err;
        });
        toast.success("Area added");
        onClose();
      },
    });
  }, toastFirstFieldError);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{initialParent ? "Add sub-area" : "Add area"}</SheetTitle>
        <SheetDescription>New areas show in the ride pickers right away.</SheetDescription>
      </SheetHeader>
      <div className="px-5 pb-4">
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="area-name">Name</FieldLabel>
              <Input
                id="area-name"
                autoComplete="off"
                maxLength={AREA_NAME_MAX_LENGTH}
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.parentId)}>
              <FieldLabel htmlFor="area-parent">Under</FieldLabel>
              <Controller
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <OptionSelect
                    id="area-parent"
                    value={field.value === undefined ? TOP_LEVEL : String(field.value)}
                    onChange={(v) => field.onChange(v === TOP_LEVEL ? undefined : Number(v))}
                    options={options}
                  />
                )}
              />
              <FieldDescription>
                A sub-area sits one level under a top-level area. Students can pick either.
              </FieldDescription>
              <FieldError errors={[errors.parentId]} />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              Add area
            </Button>
          </FieldGroup>
        </form>
      </div>
      {confirm.element}
    </>
  );
}

function EditArea({
  area,
  parent,
  onAddSub,
  onClose,
}: {
  area: ModArea;
  parent: ModArea | null;
  onAddSub: () => void;
  onClose: () => void;
}) {
  const rename = useRenameArea(area.id);
  const setHidden = useSetAreaHidden(area.id);
  const setPoint = useSetAreaPoint(area.id);
  const pointMap = useMapParam(AREA_POINT_MAP);
  const point = area.lat !== null && area.lng !== null ? { lat: area.lat, lng: area.lng } : null;
  const hasPoint = area.slug !== NO_POINT_AREA_SLUG;
  const savePoint = (next: { lat: number; lng: number } | null) =>
    setPoint.mutateAsync(next).then(
      () => toast.success(next ? "Map point saved" : "Map point removed"),
      (err: unknown) => toast.error(errorMessage(err)),
    );
  const form = useForm<AreaPatch>({
    resolver: zodResolver(areaPatch),
    defaultValues: { name: area.name },
  });
  const { errors } = form.formState;
  const confirm = useConfirm();

  const submit = form.handleSubmit((values) => {
    if (values.name === area.name) {
      toast(NOTHING_TO_SAVE);
      return;
    }
    confirm.ask({
      ...areaRenameConfirm(area.name, values.name),
      run: async () => {
        await rename.mutateAsync(values.name).catch((err: unknown) => {
          // The confirm sheet toasts the error thrown on below.
          if (err instanceof ApiError && err.code === "name_taken") {
            form.setError("name", { message: errorMessage(err) });
          }
          throw err;
        });
        toast.success("Area renamed");
        onClose();
      },
    });
  }, toastFirstFieldError);

  return (
    <>
      <SheetHeader>
        <SheetTitle>Edit area</SheetTitle>
        <SheetDescription>
          {parent ? `A sub-area of ${parent.name}. ` : ""}
          Changes show for students right away.
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-5 pb-4">
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="area-name">Name</FieldLabel>
              <Input
                id="area-name"
                autoComplete="off"
                maxLength={AREA_NAME_MAX_LENGTH}
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              Save changes
            </Button>
          </FieldGroup>
        </form>

        {parent === null ? (
          <Button type="button" variant="outline" size="lg" className="w-full" onClick={onAddSub}>
            Add a sub-area
          </Button>
        ) : null}

        <Separator />
        <div className="space-y-3">
          <h3 className="text-lg leading-[1.3] font-semibold text-ink">
            {point ? "On the map" : "Not on the map"}
          </h3>
          <p className="text-[15px] text-soft">
            {hasPoint
              ? "Rides in this area show at its map point. A sub-area with no point stands where its parent does."
              : "Outside Dhaka never has a map point."}
          </p>
          {hasPoint ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={pointMap.open}
            >
              {point ? "Move the map point" : "Set the map point"}
            </Button>
          ) : null}
        </div>

        <Separator />
        <div className="space-y-3">
          <h3 className="text-lg leading-[1.3] font-semibold text-ink">
            {area.hidden ? "Hidden from students" : "Visibility"}
          </h3>
          <p className="text-[15px] text-soft">
            {area.hidden
              ? `Students can't pick this area. Rides that already use it keep it. Reason: ${area.hiddenReason ?? "none recorded"}.`
              : "Hiding removes this area, and its sub-areas, from the ride form and filters. Rides that already use it keep it."}
          </p>
          <ReasonForm
            id={`area-reason-${area.id}`}
            submitLabel={area.hidden ? "Show again" : "Hide"}
            variant="outline"
            onSubmit={(reason) =>
              confirm.ask({
                ...areaHiddenConfirm(area.name, !area.hidden, reason),
                run: async () => {
                  await setHidden.mutateAsync({ hidden: !area.hidden, reason });
                  toast.success(area.hidden ? "Area shown again" : "Area hidden");
                  onClose();
                },
              })
            }
          />
        </div>
      </div>
      {confirm.element}
      {hasPoint ? (
        <PinPicker
          open={pointMap.isOpen}
          onClose={pointMap.close}
          label={`Place ${area.name} on the map`}
          hint={AREA_POINT_HINT}
          point={point}
          fallback={
            parent && parent.lat !== null && parent.lng !== null
              ? { lat: parent.lat, lng: parent.lng }
              : null
          }
          onConfirm={(next) => void savePoint(next)}
          onRemove={() => void savePoint(null)}
          search={(controls) => <PlaceSearch controls={controls} />}
        />
      ) : null}
    </>
  );
}
