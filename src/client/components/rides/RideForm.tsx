import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { useRef, useState } from "react";
import { AreaPicker } from "@/components/areas/AreaPicker";
import { PinPicker } from "@/components/map/PinPicker";
import { PlaceSearch } from "@/components/map/PlaceSearch";
import { ContactInput } from "@/components/posts/ContactInput";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DateField } from "@/components/ui/date-field";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioChip, RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { TimeField } from "@/components/ui/time-field";
import { ApiError } from "@/lib/api";
import { areaNameOf, areaPointOf, areasQuery, areasWithPoints } from "@/lib/areas";
import { toastFirstFieldError } from "@/lib/formErrors";
import { tripOf } from "@/lib/map/trip";
import { useMapParam } from "@/lib/map/useMapParam";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { toastPostFailure } from "@/lib/resources";
import {
  emptyRideFields,
  fieldsFromRide,
  instantToDeparture,
  RIDE_DEFAULT_END_WORDS,
  RIDE_EDIT_END_WORDS,
  RIDE_EXPIRY_WORDS,
  rideBodyFromFields,
  rideFormResolver,
  ridePatchFromFields,
  useCreateRide,
  useUpdateRide,
  VEHICLE_LABELS,
  VEHICLES,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  type RideFormFields,
} from "@/lib/rides";
import { toast } from "@/lib/toast";
import { nearestArea, type GeoPoint } from "../../../shared/geo";
import { WEEKDAYS } from "../../../shared/rides";
import {
  RIDE_NOTES_MAX_LENGTH,
  RIDE_LANDMARK_MAX_LENGTH,
  RIDE_PRICE_MAX_TAKA,
  RIDE_SEATS_MAX,
  type RideDetail,
  type RideSummary,
} from "../../../shared/schemas/rides";
import { RidePinRow } from "./RidePinRow";
import { RideSafetyNotice } from "./RideSafetyNotice";
import { TripMap } from "./TripMap";

/**
 * From this width the form is two columns: the fields, and the trip map beside them. The same width
 * as the rides screen's side panel (`lg`).
 */
const FORM_SPLIT_QUERY = "(min-width: 64rem)";

type Contacts = { phone?: string; whatsapp?: string; messenger?: string };

/** What a save says in a toast: live, held for a moderator, or turned down. */
function savedToast(ride: RideSummary, edited: boolean) {
  if (ride.status === "pending_review") {
    toast.success(
      edited
        ? "Saved. Your ride shows again once a moderator approves it."
        : "Ride saved. It goes live once a moderator approves it.",
    );
  } else if (ride.status === "rejected") {
    toast.error("A moderator didn't approve this ride.", {
      description: "See why under My rides.",
    });
  } else {
    toast.success(edited ? "Ride updated." : "Ride posted.");
  }
}

/**
 * Posts a ride, or edits one when `ride` and its `contacts` are given. The values go through the shared
 * `rideInput` schema (the resolver), so the server's own messages show under the fields. A failed check
 * toasts the first message in form order and focuses its field. A new ride
 * picks one-off or recurring; an existing ride keeps its kind. The edit sends only what changed.
 */
export function RideForm({
  ride,
  contacts,
  onSaved,
  onCancel,
}: {
  ride?: RideDetail;
  /** The poster's current contacts, needed to edit a ride. */
  contacts?: Contacts;
  onSaved: (ride: RideSummary) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const create = useCreateRide();
  const update = useUpdateRide(ride?.id ?? 0);
  // The values the form opened with: the edit compares against them to send only what changed.
  const [original] = useState<RideFormFields>(() =>
    ride ? fieldsFromRide(ride, contacts ?? {}) : emptyRideFields(),
  );
  // A one-off cannot leave before today in Dhaka; the calendar greys out earlier days.
  const [earliest] = useState(() => instantToDeparture(Date.now()));
  // Fixed for the life of the form (the mode never changes), so the label cannot shift the layout.
  const endsOnLabel = ride ? "Runs until" : "Runs until (optional)";
  const form = useForm<RideFormFields>({ resolver: rideFormResolver, defaultValues: original });
  const { errors } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });
  const notes = useWatch({ control: form.control, name: "notes" }) ?? "";

  // The trip map and the pin pickers. At most one full-screen map is open, named in the URL.
  const wide = useMediaQuery(FORM_SPLIT_QUERY);
  const areas = useQuery(areasQuery);
  const pickupMap = useMapParam("pin-pickup");
  const destinationMap = useMapParam("pin-destination");
  const [pickupAreaId, destinationAreaId, pickupPoint, destinationPoint] = useWatch({
    control: form.control,
    name: ["pickupAreaId", "destinationAreaId", "pickupPoint", "destinationPoint"],
  });
  const [pickupLandmark, destinationLandmark] = useWatch({
    control: form.control,
    name: ["pickupLandmark", "destinationLandmark"],
  });
  const areaName = (value: string): string | null => {
    const id = Number(value);
    if (!value || !Number.isInteger(id)) return null;
    return (
      areaNameOf(areas.data, id) ??
      [ride?.pickupArea, ride?.destinationArea].find((a) => a?.id === id)?.name ??
      null
    );
  };
  const pickupAreaName = areaName(pickupAreaId);
  const destinationAreaName = areaName(destinationAreaId);
  const trip = tripOf(
    {
      pickup: {
        point: pickupPoint,
        areaId: pickupAreaId ? Number(pickupAreaId) : null,
        areaName: pickupAreaName,
      },
      destination: {
        point: destinationPoint,
        areaId: destinationAreaId ? Number(destinationAreaId) : null,
        areaName: destinationAreaName,
      },
    },
    areas.data,
  );

  /** Stores a confirmed pin and, when that end has no area yet, fills in the nearest one. A picked area is never replaced. */
  const setPin = async (end: "pickup" | "destination", point: GeoPoint | null) => {
    form.setValue(`${end}Point`, point, { shouldDirty: true });
    const field = `${end}AreaId` as const;
    if (!point || form.getValues(field) !== "") return;
    const list = await queryClient.ensureQueryData(areasQuery).catch(() => undefined);
    const nearest = nearestArea(point, areasWithPoints(list));
    if (nearest && form.getValues(field) === "") {
      form.setValue(field, String(nearest.id), {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      });
    }
  };

  // The last place picked in each end's open picker. It is offered as the landmark only when the
  // student confirms the spot, and forgotten whenever the picker opens or closes.
  const pickedPlace = useRef<Record<"pickup" | "destination", string | null>>({
    pickup: null,
    destination: null,
  });
  const forgetPlace = (end: "pickup" | "destination") => {
    pickedPlace.current[end] = null;
  };

  /** Offers a searched place's name as the landmark, never over one the student typed. */
  const offerLandmark = (end: "pickup" | "destination", name: string) => {
    const field = `${end}Landmark` as const;
    if (form.getValues(field).trim() !== "") return;
    const landmark = name.trim().slice(0, RIDE_LANDMARK_MAX_LENGTH).trim();
    if (!landmark) return;
    form.setValue(field, landmark, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    toast.success(`Landmark set to ${landmark}`);
  };

  const preview = (className: string) => (
    <TripMap
      id="trip"
      trip={trip}
      label="Map of your ride"
      openLabel="Open the map of your ride"
      pickup={{ area: pickupAreaName, landmark: pickupLandmark.trim() || null }}
      destination={{ area: destinationAreaName, landmark: destinationLandmark.trim() || null }}
      pause={pickupMap.isOpen || destinationMap.isOpen}
      previewClassName={className}
    />
  );

  // The server refuses an area that was hidden since the list was loaded without saying which one,
  // so check the changed areas against a fresh list and mark the ones that are gone.
  const failed = async (err: unknown) => {
    if (err instanceof ApiError && err.code === "invalid_area") {
      const options = await queryClient
        .fetchQuery({ ...areasQuery, staleTime: 0 })
        .catch(() => undefined);
      const gone = (name: "pickupAreaId" | "destinationAreaId") => {
        const value = form.getValues(name);
        return (
          value !== original[name] && (!options || areaNameOf(options, Number(value)) === undefined)
        );
      };
      const names = (["pickupAreaId", "destinationAreaId"] as const).filter(gone);
      for (const name of names.length > 0
        ? names
        : (["pickupAreaId", "destinationAreaId"] as const)) {
        form.setError(name, { message: "That area isn't available. Pick another." });
      }
    }
    toastPostFailure(err);
  };

  const submit = form.handleSubmit((values) => {
    if (ride) {
      const patch = ridePatchFromFields(values, original);
      if (!patch) {
        toast.success("Nothing to change.");
        onSaved(ride);
        return;
      }
      update.mutate(patch, {
        onSuccess: (saved) => {
          savedToast(saved, true);
          onSaved(saved);
        },
        onError: failed,
      });
      return;
    }
    create.mutate(rideBodyFromFields(values), {
      onSuccess: (saved) => {
        savedToast(saved, false);
        onSaved(saved);
      },
      onError: failed,
    });
  }, toastFirstFieldError);

  return (
    <FormProvider {...form}>
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:items-start lg:gap-8">
        <div className="min-w-0 rounded-panel bg-surface p-4 md:rounded-[24px] md:p-5">
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              {ride ? null : (
                <Field>
                  <FieldLabel id="ride-kind-label">How often</FieldLabel>
                  <Controller
                    control={form.control}
                    name="kind"
                    render={({ field }) => (
                      <RadioGroup
                        aria-labelledby="ride-kind-label"
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid-cols-2 gap-2"
                      >
                        <RadioChip value="one_off">One-off</RadioChip>
                        <RadioChip value="recurring">Recurring</RadioChip>
                      </RadioGroup>
                    )}
                  />
                </Field>
              )}

              <Field data-invalid={Boolean(errors.pickupAreaId)}>
                <FieldLabel htmlFor="ride-from">From</FieldLabel>
                <Controller
                  control={form.control}
                  name="pickupAreaId"
                  render={({ field }) => (
                    <AreaPicker
                      id="ride-from"
                      title="Where does it start?"
                      placeholder="Pick the pickup area"
                      value={field.value ? Number(field.value) : null}
                      current={ride?.pickupArea}
                      invalid={Boolean(errors.pickupAreaId)}
                      onChange={(next) => field.onChange(next === null ? "" : String(next))}
                    />
                  )}
                />
                <FieldError errors={[errors.pickupAreaId]} />
              </Field>
              <Field data-invalid={Boolean(errors.pickupLandmark)}>
                <FieldLabel htmlFor="ride-pickup">Pickup landmark (optional)</FieldLabel>
                <Input
                  id="ride-pickup"
                  placeholder="NSU gate"
                  maxLength={RIDE_LANDMARK_MAX_LENGTH}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.pickupLandmark)}
                  {...form.register("pickupLandmark")}
                />
                <FieldDescription>Gate, road or landmark where riders meet you.</FieldDescription>
                <FieldError errors={[errors.pickupLandmark]} />
              </Field>
              <RidePinRow
                kind="pickup"
                pinned={pickupPoint !== null}
                onPin={() => {
                  forgetPlace("pickup");
                  pickupMap.open();
                }}
                onRemove={() => void setPin("pickup", null)}
              />

              <Field data-invalid={Boolean(errors.destinationAreaId)}>
                <FieldLabel htmlFor="ride-to">To</FieldLabel>
                <Controller
                  control={form.control}
                  name="destinationAreaId"
                  render={({ field }) => (
                    <AreaPicker
                      id="ride-to"
                      title="Where does it go?"
                      placeholder="Pick the destination area"
                      value={field.value ? Number(field.value) : null}
                      current={ride?.destinationArea}
                      invalid={Boolean(errors.destinationAreaId)}
                      onChange={(next) => field.onChange(next === null ? "" : String(next))}
                    />
                  )}
                />
                <FieldError errors={[errors.destinationAreaId]} />
              </Field>
              <Field data-invalid={Boolean(errors.destinationLandmark)}>
                <FieldLabel htmlFor="ride-destination">Destination landmark (optional)</FieldLabel>
                <Input
                  id="ride-destination"
                  placeholder="Mirpur 10"
                  maxLength={RIDE_LANDMARK_MAX_LENGTH}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.destinationLandmark)}
                  {...form.register("destinationLandmark")}
                />
                <FieldDescription>Gate, road or landmark where it ends.</FieldDescription>
                <FieldError errors={[errors.destinationLandmark]} />
              </Field>
              <RidePinRow
                kind="destination"
                pinned={destinationPoint !== null}
                onPin={() => {
                  forgetPlace("destination");
                  destinationMap.open();
                }}
                onRemove={() => void setPin("destination", null)}
              />
              {wide ? null : preview("h-40")}

              <Field>
                <FieldLabel id="ride-vehicle-label">Vehicle</FieldLabel>
                <Controller
                  control={form.control}
                  name="vehicle"
                  render={({ field }) => (
                    <RadioGroup
                      aria-labelledby="ride-vehicle-label"
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid-cols-4 gap-1.5"
                    >
                      {VEHICLES.map((v) => (
                        <RadioChip key={v} value={v} aria-label={VEHICLE_LABELS[v]}>
                          <span aria-hidden className="text-[15px] leading-none font-semibold">
                            {VEHICLE_LABELS[v]}
                          </span>
                        </RadioChip>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={Boolean(errors.totalSeats)}>
                  <FieldLabel htmlFor="ride-seats">Seats</FieldLabel>
                  <Input
                    id="ride-seats"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={RIDE_SEATS_MAX}
                    step={1}
                    placeholder="3"
                    aria-invalid={Boolean(errors.totalSeats)}
                    {...form.register("totalSeats")}
                  />
                  <FieldError errors={[errors.totalSeats]} />
                </Field>
                <Field data-invalid={Boolean(errors.pricePerSeatTaka)}>
                  <FieldLabel htmlFor="ride-price">Taka per seat</FieldLabel>
                  <Input
                    id="ride-price"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={RIDE_PRICE_MAX_TAKA}
                    step={1}
                    placeholder="100"
                    aria-invalid={Boolean(errors.pricePerSeatTaka)}
                    {...form.register("pricePerSeatTaka")}
                  />
                  <FieldError errors={[errors.pricePerSeatTaka]} />
                </Field>
              </div>
              {ride ? (
                <FieldDescription className="-mt-3">
                  Changing the seats keeps the seats already taken.
                </FieldDescription>
              ) : null}

              {kind === "one_off" ? (
                <Field data-invalid={Boolean(errors.departure)}>
                  <FieldLabel htmlFor="ride-departure">Departs</FieldLabel>
                  {/* One form value, "YYYY-MM-DDTHH:MM", shown as a day-first date and a time. */}
                  <Controller
                    control={form.control}
                    name="departure"
                    render={({ field }) => {
                      const [date = "", time = ""] = field.value.split("T");
                      const join = (d: string, t: string) => (d || t ? `${d}T${t}` : "");
                      return (
                        <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
                          <DateField
                            id="ride-departure"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            label="Departs"
                            value={date}
                            min={earliest.slice(0, 10)}
                            aria-invalid={Boolean(errors.departure)}
                            onChange={(next) => field.onChange(join(next, time))}
                          />
                          <TimeField
                            label="Departure time"
                            aria-invalid={Boolean(errors.departure)}
                            value={time}
                            onChange={(next) => field.onChange(join(date, next))}
                          />
                        </div>
                      );
                    }}
                  />
                  <FieldDescription>Dhaka time. {RIDE_EXPIRY_WORDS.one_off}</FieldDescription>
                  <FieldError errors={[errors.departure]} />
                </Field>
              ) : (
                <>
                  <Field data-invalid={Boolean(errors.days)}>
                    <FieldLabel id="ride-days-label">Days</FieldLabel>
                    <Controller
                      control={form.control}
                      name="days"
                      render={({ field }) => (
                        <div
                          role="group"
                          aria-labelledby="ride-days-label"
                          className="flex flex-wrap gap-2"
                        >
                          {WEEKDAYS.map((d) => (
                            <Chip
                              key={d}
                              pressed={field.value.includes(d)}
                              aria-label={WEEKDAY_LONG[d]}
                              onPressedChange={(on) =>
                                field.onChange(
                                  on ? [...field.value, d] : field.value.filter((x) => x !== d),
                                )
                              }
                            >
                              {WEEKDAY_SHORT[d]}
                            </Chip>
                          ))}
                        </div>
                      )}
                    />
                    <FieldError errors={[errors.days]} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field data-invalid={Boolean(errors.departureTime)}>
                      <FieldLabel htmlFor="ride-time">Leaves at</FieldLabel>
                      <Controller
                        control={form.control}
                        name="departureTime"
                        render={({ field }) => (
                          <TimeField
                            id="ride-time"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            label="Leaves at"
                            value={field.value}
                            aria-invalid={Boolean(errors.departureTime)}
                            onChange={field.onChange}
                          />
                        )}
                      />
                      <FieldError errors={[errors.departureTime]} />
                    </Field>
                    <Field data-invalid={Boolean(errors.endsOn)}>
                      <FieldLabel htmlFor="ride-ends">{endsOnLabel}</FieldLabel>
                      <Controller
                        control={form.control}
                        name="endsOn"
                        render={({ field }) => (
                          <DateField
                            id="ride-ends"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            label={endsOnLabel}
                            clearable={!ride}
                            value={field.value}
                            aria-invalid={Boolean(errors.endsOn)}
                            onChange={field.onChange}
                          />
                        )}
                      />
                      <FieldError errors={[errors.endsOn]} />
                    </Field>
                  </div>
                  <FieldDescription className="-mt-3">
                    {ride
                      ? `Dhaka time. ${RIDE_EDIT_END_WORDS}`
                      : `Dhaka time. ${RIDE_DEFAULT_END_WORDS} ${RIDE_EXPIRY_WORDS.recurring}`}
                  </FieldDescription>
                </>
              )}

              <Field data-invalid={Boolean(errors.notes)}>
                <FieldLabel htmlFor="ride-notes">Notes (optional)</FieldLabel>
                <Textarea
                  id="ride-notes"
                  placeholder="Where exactly you wait, bags, anything riders should know"
                  maxLength={RIDE_NOTES_MAX_LENGTH}
                  aria-invalid={Boolean(errors.notes)}
                  {...form.register("notes")}
                />
                <FieldDescription className="tabular-nums">
                  {notes.length} / {RIDE_NOTES_MAX_LENGTH}
                </FieldDescription>
                <FieldError errors={[errors.notes]} />
              </Field>

              <h2 className="-mb-2 text-lg leading-[1.3] font-semibold text-ink">
                How riders reach you
              </h2>
              <ContactInput />

              <RideSafetyNotice />

              <div className="flex flex-col gap-2">
                <Button type="submit" loading={create.isPending || update.isPending}>
                  {ride ? "Save changes" : "Post ride"}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </FieldGroup>
          </form>
        </div>
        {wide ? (
          <aside aria-label="Trip map" className="sticky top-9 h-[calc(100dvh-4.5rem)] min-w-0">
            {preview("h-full")}
          </aside>
        ) : null}
        <PinPicker
          open={pickupMap.isOpen}
          onClose={() => {
            forgetPlace("pickup");
            pickupMap.close();
          }}
          label="Pin the pickup"
          pin="pickup"
          point={pickupPoint}
          fallback={pickupAreaId ? areaPointOf(areas.data, Number(pickupAreaId)) : null}
          onConfirm={(point) => {
            void setPin("pickup", point);
            const name = pickedPlace.current.pickup;
            if (name) offerLandmark("pickup", name);
          }}
          onRemove={() => void setPin("pickup", null)}
          search={(controls) => (
            <PlaceSearch
              controls={controls}
              onPlace={(name) => (pickedPlace.current.pickup = name)}
            />
          )}
        />
        <PinPicker
          open={destinationMap.isOpen}
          onClose={() => {
            forgetPlace("destination");
            destinationMap.close();
          }}
          label="Pin the destination"
          pin="destination"
          point={destinationPoint}
          fallback={destinationAreaId ? areaPointOf(areas.data, Number(destinationAreaId)) : null}
          onConfirm={(point) => {
            void setPin("destination", point);
            const name = pickedPlace.current.destination;
            if (name) offerLandmark("destination", name);
          }}
          onRemove={() => void setPin("destination", null)}
          search={(controls) => (
            <PlaceSearch
              controls={controls}
              onPlace={(name) => (pickedPlace.current.destination = name)}
            />
          )}
        />
      </div>
    </FormProvider>
  );
}
