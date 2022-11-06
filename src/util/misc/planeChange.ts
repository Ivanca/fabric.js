import { iMatrix } from '../../constants';
import type { Point } from '../../point.class';
import type { FabricObject } from '../../shapes/fabricObject.class';
import type { TDegree, TMat2D } from '../../typedefs';
import type { StaticCanvas } from '../../__types__';
import { invertTransform, multiplyTransformMatrices } from './matrix';
import { applyTransformToObject } from './objectTransforms';

export const enum ObjectRelation {
  sibling = 'sibling',
  child = 'child',
}

/**
 * We are actually looking for the transformation from the destination plane to the source plane (change of basis matrix)\
 * The object will exist on the destination plane and we want it to seem unchanged by it so we invert the destination matrix (`to`) and then apply the source matrix (`from`)
 * @param [from]
 * @param [to]
 * @returns
 */
export const calcPlaneChangeMatrix = (
  from: TMat2D = iMatrix,
  to: TMat2D = iMatrix
) => multiplyTransformMatrices(invertTransform(to), from);

/**
 * Sends a point from the source coordinate plane to the destination coordinate plane.\
 * From the canvas/viewer's perspective the point remains unchanged.
 *
 * @example <caption>Send point from canvas plane to group plane</caption>
 * const obj = new fabric.Rect({ left: 20, top: 20, width: 60, height: 60, strokeWidth: 0 });
 * const group = new fabric.Group([obj], { strokeWidth: 0 });
 * const sentPoint1 = fabric.util.sendPointToPlane(new Point(50, 50), undefined, group.calcTransformMatrix());
 * const sentPoint2 = fabric.util.sendPointToPlane(new Point(50, 50), fabric.iMatrix, group.calcTransformMatrix());
 * console.log(sentPoint1, sentPoint2) //  both points print (0,0) which is the center of group
 *
 * @static
 * @memberOf fabric.util
 * @param {Point} point
 * @param {TMat2D} [from] plane matrix containing object. Passing `undefined` is equivalent to passing the identity matrix, which means `point` exists in the canvas coordinate plane.
 * @param {TMat2D} [to] destination plane matrix to contain object. Passing `undefined` means `point` should be sent to the canvas coordinate plane.
 * @returns {Point} transformed point
 */
export const sendPointToPlane = (
  point: Point,
  from: TMat2D = iMatrix,
  to: TMat2D = iMatrix
): Point => point.transform(calcPlaneChangeMatrix(from, to));

/**
 * Transform point relative to canvas.
 * From the viewport/viewer's perspective the point remains unchanged.
 *
 * `child` relation means `point` exists in the coordinate plane created by `canvas`.
 * In other words point is measured acoording to canvas' top left corner
 * meaning that if `point` is equal to (0,0) it is positioned at canvas' top left corner.
 *
 * `sibling` relation means `point` exists in the same coordinate plane as canvas.
 * In other words they both relate to the same (0,0) and agree on every point, which is how an event relates to canvas.
 *
 * @static
 * @memberOf fabric.util
 * @param {Point} point
 * @param {fabric.StaticCanvas} canvas
 * @param {'sibling'|'child'} relationBefore current relation of point to canvas
 * @param {'sibling'|'child'} relationAfter desired relation of point to canvas
 * @returns {Point} transformed point
 */
export const transformPointRelativeToCanvas = (
  point: Point,
  canvas: StaticCanvas,
  relationBefore: ObjectRelation,
  relationAfter: ObjectRelation
): Point => {
  // is this still needed with TS?
  if (
    relationBefore !== ObjectRelation.child &&
    relationBefore !== ObjectRelation.sibling
  ) {
    throw new Error('fabric.js: received bad argument ' + relationBefore);
  }
  if (
    relationAfter !== ObjectRelation.child &&
    relationAfter !== ObjectRelation.sibling
  ) {
    throw new Error('fabric.js: received bad argument ' + relationAfter);
  }
  if (relationBefore === relationAfter) {
    return point;
  }
  const t = canvas.viewportTransform;
  return point.transform(relationAfter === 'child' ? invertTransform(t) : t);
};

/**
 *
 * A util that abstracts applying transform to objects.\
 * Sends `object` to the destination coordinate plane by applying the relevant transformations.\
 * Changes the space/plane where `object` is drawn.\
 * From the canvas/viewer's perspective `object` remains unchanged.
 *
 * @example <caption>Move clip path from one object to another while preserving it's appearance as viewed by canvas/viewer</caption>
 * let obj, obj2;
 * let clipPath = new fabric.Circle({ radius: 50 });
 * obj.clipPath = clipPath;
 * // render
 * fabric.util.sendObjectToPlane(clipPath, obj.calcTransformMatrix(), obj2.calcTransformMatrix());
 * obj.clipPath = undefined;
 * obj2.clipPath = clipPath;
 * // render, clipPath now clips obj2 but seems unchanged from the eyes of the viewer
 *
 * @example <caption>Clip an object's clip path with an existing object</caption>
 * let obj, existingObj;
 * let clipPath = new fabric.Circle({ radius: 50 });
 * obj.clipPath = clipPath;
 * let transformTo = fabric.util.multiplyTransformMatrices(obj.calcTransformMatrix(), clipPath.calcTransformMatrix());
 * fabric.util.sendObjectToPlane(existingObj, existingObj.group?.calcTransformMatrix(), transformTo);
 * clipPath.clipPath = existingObj;
 *
 * @static
 * @memberof fabric.util
 * @param {FabricObject} object
 * @param {TMat2D} [from] plane matrix containing object. Passing `undefined` is equivalent to passing the identity matrix, which means `object` is a direct child of canvas.
 * @param {TMat2D} [to] destination plane matrix to contain object. Passing `undefined` means `object` should be sent to the canvas coordinate plane.
 * @returns {TMat2D} the transform matrix that was applied to `object`
 */
export function sendObjectToPlane(
  object: FabricObject,
  to?: FabricObject
): { transform: TMat2D; angle: TDegree };
/**
 * Use this signature for clip path
 * @deprecated clip path's awareness to ancestors is planned to be fixed
 * @todo remove signature + update examples once fixed
 */
export function sendObjectToPlane(
  object: FabricObject,
  from: FabricObject | undefined,
  to: FabricObject | undefined
): { transform: TMat2D; angle: TDegree };
export function sendObjectToPlane(
  object: FabricObject,
  arg1?: FabricObject,
  arg2?: FabricObject
) {
  const { from, to } =
    arguments.length === 3
      ? { from: arg1, to: arg2 }
      : { from: object.group, to: arg1 };
  const t = calcPlaneChangeMatrix(
    from?.calcTransformMatrix(),
    to?.calcTransformMatrix()
  );
  const angle = (object.angle -
    (from?.getTotalAngle() || 0) +
    (to?.getTotalAngle() || 0)) as TDegree;
  applyTransformToObject(
    object,
    multiplyTransformMatrices(t, object.calcOwnMatrix()),
    angle
  );
  return { transform: t, angle };
}
