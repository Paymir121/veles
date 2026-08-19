/** A request to fly to one burial place and open its balloon. `token` makes
 *  every request distinct, so choosing the same place twice in a row still
 *  re-focuses the map instead of being swallowed as "no state change". */
export interface MapFocusRequest {
  placeId: number;
  token: number;
}
