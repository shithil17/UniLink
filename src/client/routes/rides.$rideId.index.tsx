import { createFileRoute } from "@tanstack/react-router";

// The open ride. It draws nothing itself: the rides layout reads the id from this route and shows
// the ride in a sheet or a side panel over the list. Sign-in is checked by the layout's guard.
export const Route = createFileRoute("/rides/$rideId/")({
  component: () => null,
});
