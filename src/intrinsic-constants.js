/**
 * Values needed at module top-level by camera modes, car geometries, and patterns.
 * Kept import-free so constants.js can compose the full Constants object without cycles.
 */
export const CAR_RADIUS = 6;
export const CAMERA_HEIGHT = 300;
/** Road mesh top Y; headlight/underglow decals must sit slightly above this to pass the depth test. */
export const ROAD_SURFACE_Y = 0.03;
/**
 * Road uses (-1, -2), kerbs (-2, -4) in `track.js`. Headlight decals must sit **between** those in
 * depth bias so they draw on asphalt but still lose to kerbs at walls (stencil + depth).
 */
export const HEADLIGHT_DECAL_POLYGON_OFFSET = {
  polygonOffset: true,
  polygonOffsetFactor: -1.5,
  polygonOffsetUnits: -3,
};
