export type Status = true | false;
export type Theme = "transparent" | "white" | "white_border" | "black" | "classic";
export type DelType = "min" | "max" | "full";
export type ShowType = "norm" | "full" | "min";

export type typeConfirm = ''|'fake'|'finish'|'cancel';

export type XY = {
  latitude: number,
  longitude: number,
  lat: number,
  lon: number,
  latitudeDelta: number,
  longitudeDelta: number
}