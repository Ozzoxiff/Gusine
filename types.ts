export type SectionId = "home" | "coordinates" | "geometry" | "formulas" | "calculators";

export interface Pt {
  x: number;
  y: number;
}

export type ShapeKind = "triangle" | "rectangle" | "circle" | "polygon";

export type ObjKind = "point" | "segment" | "polygon" | "circle" | "function";

export interface SceneObject {
  id: number;
  kind: ObjKind;
  /** точки у світових координатах; для кола — [центр, точка на колі] */
  points: Pt[];
  /** для функції — вираз */
  expr?: string;
  color: string;
  /** анімація появи 0..1 */
  born: number;
}
