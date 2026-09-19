import * as THREE from "three";


const DEFAULT_CONFIG =
  Object.freeze({

    cutRatioY:
      0.575,

    pivotRatioX:
      0.605,

    tipSampleRatioX:
      0.12,

    muzzleInsetRatioX:
      0.015

  });


const RED_CONFIG =
  Object.freeze({

    ...DEFAULT_CONFIG,

    cutRatioY:
      0.555

  });


function configFor(
  url
) {

  return String(
    url || ""
  ).includes(
    "team-red"
  )

    ? RED_CONFIG
    : DEFAULT_CONFIG;

}


function indexedGeometry(
  source,
  indices
) {

  const geometry =
    new THREE
      .BufferGeometry();


  for (
    const name
    of Object.keys(
      source.attributes
    )
  ) {

    geometry
      .setAttribute(

        name,

        source
          .getAttribute(
            name
          )

      );

  }


  for (
    const name
    of Object.keys(
      source.morphAttributes ||
      {}
    )
  ) {

    geometry
      .morphAttributes[
        name
      ] =

      source
        .morphAttributes[
          name
        ];

  }


  geometry
    .morphTargetsRelative =

    source
      .morphTargetsRelative ===
    true;


  geometry
    .setIndex(

      new THREE
        .BufferAttribute(

          new Uint32Array(
            indices
          ),

          1

        )

    );


  geometry
    .computeBoundingBox();


  geometry
    .computeBoundingSphere();


  return geometry;

}


function findSourceMesh(
  model
) {

  let source =
    null;


  model.traverse(
    object => {

      if (
        source ||

        !object.isMesh ||

        !object.geometry
          ?.getAttribute
          ?.(
            "position"
          )
      ) {

        return;

      }


      source =
        object;

    }
  );


  return source;

}


export function rigTankModel(
  model,
  url = ""
) {

  if (!model) {

    return null;

  }


  const existing =
    model.getObjectByName(
      "TurretPivot"
    );


  if (existing) {

    return {

      root:
        model.getObjectByName(
          "TankRoot"
        ),

      hull:
        model.getObjectByName(
          "Hull"
        ),

      turretPivot:
        existing,

      turret:
        model.getObjectByName(
          "Turret"
        ),

      muzzle:
        model.getObjectByName(
          "Muzzle"
        )

    };

  }


  const sourceMesh =
    findSourceMesh(
      model
    );


  if (!sourceMesh) {

    throw new Error(
      "Tank GLB has no splittable mesh."
    );

  }


  const geometry =
    sourceMesh.geometry;


  const position =
    geometry.getAttribute(
      "position"
    );


  if (
    !position ||
    position.count < 3
  ) {

    throw new Error(
      "Tank GLB has no usable POSITION data."
    );

  }


  geometry
    .computeBoundingBox();


  const bounds =
    geometry.boundingBox;


  if (!bounds) {

    throw new Error(
      "Tank GLB bounding box is unavailable."
    );

  }


  const cfg =
    configFor(
      url
    );


  const spanX =
    Math.max(

      0.000001,

      bounds.max.x -
      bounds.min.x

    );


  const spanY =
    Math.max(

      0.000001,

      bounds.max.y -
      bounds.min.y

    );


  const cutY =

    bounds.min.y +

    spanY *
    cfg.cutRatioY;


  const sourceIndex =
    geometry.index;


  const triangleCount =

    sourceIndex

      ? Math.floor(
          sourceIndex.count /
          3
        )

      : Math.floor(
          position.count /
          3
        );


  const hullIndices =
    [];


  const turretIndices =
    [];


  const vertexAt =
    index =>

      sourceIndex

        ? sourceIndex
            .getX(
              index
            )

        : index;


  for (

    let triangle =
      0;

    triangle <
      triangleCount;

    triangle +=
      1

  ) {

    const offset =
      triangle *
      3;


    const a =
      vertexAt(
        offset
      );


    const b =
      vertexAt(
        offset + 1
      );


    const c =
      vertexAt(
        offset + 2
      );


    const centerY =

      (
        position.getY(
          a
        ) +

        position.getY(
          b
        ) +

        position.getY(
          c
        )
      ) /

      3;


    const target =

      centerY >=
      cutY

        ? turretIndices
        : hullIndices;


    target.push(
      a,
      b,
      c
    );

  }


  if (
    hullIndices.length ===
      0 ||

    turretIndices.length ===
      0
  ) {

    throw new Error(
      "Tank mesh split produced an empty part."
    );

  }


  /*
   * Barrel points towards local -X.
   *
   * Sample the forward end to find
   * the barrel centre automatically.
   */

  const tipLimitX =

    bounds.min.x +

    spanX *
    cfg.tipSampleRatioX;


  let tipY =
    0;


  let tipZ =
    0;


  let tipCount =
    0;


  for (

    let index =
      0;

    index <
      position.count;

    index +=
      1

  ) {

    const x =
      position.getX(
        index
      );


    const y =
      position.getY(
        index
      );


    if (
      x >
        tipLimitX ||

      y <
        cutY
    ) {

      continue;

    }


    tipY +=
      y;


    tipZ +=
      position.getZ(
        index
      );


    tipCount +=
      1;

  }


  const fallbackZ =

    (
      bounds.min.z +
      bounds.max.z
    ) /

    2;


  const pivotX =

    bounds.min.x +

    spanX *
    cfg.pivotRatioX;


  const pivotY =
  cutY;


/*
 * Turret yaw axis must stay in the
 * lateral centre of the tank.
 *
 * Do NOT use barrel position here:
 * the barrel is intentionally offset
 * from the turret rotation axis.
 */
const pivotZ =
  fallbackZ;


const muzzleX =

  bounds.min.x +

  spanX *
  cfg.muzzleInsetRatioX;


const muzzleY =

  tipCount >
    0

    ? tipY /
      tipCount

    : cutY +
      spanY *
      0.25;


/*
 * Muzzle keeps the real lateral
 * position of the barrel.
 */
const muzzleZ =

  tipCount >
    0

    ? tipZ /
      tipCount

    : fallbackZ;

  /*
   * Final hierarchy:
   *
   * TankRoot
   * ├── Hull
   * └── TurretPivot
   *     ├── Turret
   *     └── Muzzle
   */

  const tankRoot =
    new THREE.Group();


  tankRoot.name =
    "TankRoot";


  /*
   * Preserve any transform generated
   * by GLTFLoader / gltfpack.
   */

  tankRoot.position
    .copy(
      sourceMesh.position
    );


  tankRoot.quaternion
    .copy(
      sourceMesh.quaternion
    );


  tankRoot.scale
    .copy(
      sourceMesh.scale
    );


  const hull =
    new THREE.Mesh(

      indexedGeometry(
        geometry,
        hullIndices
      ),

      sourceMesh.material

    );


  hull.name =
    "Hull";


  const turretPivot =
    new THREE.Group();


  turretPivot.name =
    "TurretPivot";


  turretPivot.position
    .set(

      pivotX,
      pivotY,
      pivotZ

    );


  const turret =
    new THREE.Mesh(

      indexedGeometry(
        geometry,
        turretIndices
      ),

      sourceMesh.material

    );


  turret.name =
    "Turret";


  /*
   * Geometry remains in its original
   * coordinate system.
   *
   * Offset it back from TurretPivot
   * so the initial appearance is
   * pixel-identical to the GLB.
   */

  turret.position
    .set(

      -pivotX,
      -pivotY,
      -pivotZ

    );


  const muzzle =
    new THREE.Object3D();


  muzzle.name =
    "Muzzle";


  muzzle.position
    .set(

      muzzleX -
      pivotX,

      muzzleY -
      pivotY,

      muzzleZ -
      pivotZ

    );


  const parent =
    sourceMesh.parent;


  if (!parent) {

    throw new Error(
      "Tank mesh has no parent."
    );

  }


  parent.add(
    tankRoot
  );


  tankRoot.add(
    hull
  );


  tankRoot.add(
    turretPivot
  );


  turretPivot.add(
    turret
  );


  turretPivot.add(
    muzzle
  );


  parent.remove(
    sourceMesh
  );


  console.info(

    "[LAGO TANKS] Tank rig created",

    {

      hullTriangles:
        hullIndices.length /
        3,

      turretTriangles:
        turretIndices.length /
        3,

      cutRatioY:
        cfg.cutRatioY

    }

  );


  return {

    root:
      tankRoot,

    hull,

    turretPivot,

    turret,

    muzzle

  };

}
