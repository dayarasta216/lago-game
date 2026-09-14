import * as THREE from "three";

const VERSION = 1;

const MARVIN_ID =
  "comic_giraffe_bird";


function mat(color) {

  return new THREE.MeshStandardMaterial({

    color,

    roughness:
      0.88,

    metalness:
      0,

    flatShading:
      true

  });

}


function outlineMat() {

  return new THREE.MeshBasicMaterial({

    color:
      0x17110f,

    side:
      THREE.BackSide

  });

}


function finish(
  mesh,
  outlines = true,
  scale = 1.045
) {

  mesh.castShadow =
    true;

  mesh.receiveShadow =
    true;


  if (outlines) {

    const outline =
      new THREE.Mesh(

        mesh.geometry,

        outlineMat()

      );


    outline.name =
      `${mesh.name || "part"}-outline`;


    outline.scale.setScalar(
      scale
    );


    outline.castShadow =
      false;

    outline.receiveShadow =
      false;


    mesh.add(
      outline
    );

  }


  return mesh;

}


function ellipsoid(
  {
    name,
    color,
    position,
    scale,
    rotation = [0, 0, 0],
    outlines = true,
    segments = 18
  }
) {

  const mesh =
    new THREE.Mesh(

      new THREE.SphereGeometry(

        1,

        segments,

        Math.max(
          12,
          Math.floor(
            segments * 0.72
          )
        )

      ),

      mat(
        color
      )

    );


  mesh.name =
    name;


  mesh.position.set(
    ...position
  );


  mesh.scale.set(
    ...scale
  );


  mesh.rotation.set(
    ...rotation
  );


  return finish(
    mesh,
    outlines,
    1.055
  );

}


function rod(
  {
    name,
    color,
    start,
    end,
    radiusTop,
    radiusBottom = radiusTop,
    outlines = true,
    radialSegments = 12
  }
) {

  const a =
    new THREE.Vector3(
      ...start
    );


  const b =
    new THREE.Vector3(
      ...end
    );


  const direction =
    new THREE.Vector3()
      .subVectors(
        b,
        a
      );


  const length =
    Math.max(
      0.001,
      direction.length()
    );


  const mesh =
    new THREE.Mesh(

      new THREE.CylinderGeometry(

        radiusTop,

        radiusBottom,

        length,

        radialSegments,

        1,

        false

      ),

      mat(
        color
      )

    );


  mesh.name =
    name;


  mesh.position
    .copy(
      a
    )
    .add(
      b
    )
    .multiplyScalar(
      0.5
    );


  mesh.quaternion
    .setFromUnitVectors(

      new THREE.Vector3(
        0,
        1,
        0
      ),

      direction
        .clone()
        .normalize()

    );


  return finish(
    mesh,
    outlines,
    1.06
  );

}


function normalize(
  root,
  targetHeight = 2.45
) {

  root.updateMatrixWorld(
    true
  );


  const first =
    new THREE.Box3()
      .setFromObject(
        root
      );


  const size =
    first.getSize(
      new THREE.Vector3()
    );


  root.scale.setScalar(

    targetHeight /

    Math.max(
      size.y,
      0.001
    )

  );


  root.updateMatrixWorld(
    true
  );


  const box =
    new THREE.Box3()
      .setFromObject(
        root
      );


  const center =
    box.getCenter(
      new THREE.Vector3()
    );


  root.position.x -=
    center.x;


  root.position.z -=
    center.z;


  root.position.y -=
    box.min.y;


  root.updateMatrixWorld(
    true
  );


  return root;

}


function buildMarvin(
  {
    outlines = true
  } = {}
) {

  const root =
    new THREE.Group();


  root.name =
    "MarvinVolumetric";


  root.userData = {

    lagoVolumetric:
      true,

    characterId:
      MARVIN_ID,

    version:
      VERSION

  };


  const BODY =
    0xcac7c0;

  const BODY_LIGHT =
    0xe9e3d7;

  const BODY_DARK =
    0x6b6761;

  const GIRAFFE =
    0xd9a05f;

  const GIRAFFE_LIGHT =
    0xf0c789;

  const SPOT =
    0x7b4528;

  const LEG =
    0x8a6b4f;

  const BLACK =
    0x181514;

  const WHITE =
    0xf7f5ef;


  /*
   * Volumetric bird body.
   */
  root.add(
    ellipsoid({

      name:
        "MarvinBody",

      color:
        BODY,

      position:
        [0, 0.92, 0],

      scale:
        [0.72, 0.92, 0.58],

      outlines

    })
  );


  root.add(
    ellipsoid({

      name:
        "MarvinBelly",

      color:
        BODY_LIGHT,

      position:
        [0, 0.86, 0.50],

      scale:
        [0.44, 0.62, 0.14],

      outlines:
        false

    })
  );


  /*
   * Real left/right wings.
   */
  [-1, 1]
    .forEach(
      side => {

        root.add(
          ellipsoid({

            name:
              side < 0
                ? "MarvinWingLeft"
                : "MarvinWingRight",

            color:
              BODY_DARK,

            position:
              [
                side * 0.61,
                1.00,
                -0.03
              ],

            scale:
              [
                0.24,
                0.64,
                0.46
              ],

            rotation:
              [
                0.08,
                0,
                side * 0.18
              ],

            outlines

          })
        );

      }
    );


  /*
   * Three tail feathers.
   */
  [
    -0.22,
    0,
    0.22
  ]
    .forEach(
      (
        x,
        index
      ) => {

        root.add(
          ellipsoid({

            name:
              `MarvinTail${index}`,

            color:
              index === 1
                ? BODY_LIGHT
                : BODY_DARK,

            position:
              [
                x,
                0.73,
                -0.69
              ],

            scale:
              [
                0.16,
                0.46,
                0.15
              ],

            rotation:
              [
                -0.54,
                0,
                x * 0.7
              ],

            outlines

          })
        );

      }
    );


  /*
   * Two actual volumetric legs.
   */
  [-1, 1]
    .forEach(
      side => {

        const x =
          side * 0.23;


        root.add(
          rod({

            name:
              side < 0
                ? "MarvinLegLeft"
                : "MarvinLegRight",

            color:
              LEG,

            start:
              [
                x,
                0.40,
                0.04
              ],

            end:
              [
                x + side * 0.035,
                -0.43,
                0.08
              ],

            radiusTop:
              0.055,

            radiusBottom:
              0.072,

            outlines

          })
        );


        /*
         * Three toes on each foot.
         */
        [
          -0.13,
          0,
          0.13
        ]
          .forEach(
            toe => {

              root.add(
                rod({

                  name:
                    "MarvinToe",

                  color:
                    LEG,

                  start:
                    [
                      x,
                      -0.43,
                      0.10
                    ],

                  end:
                    [
                      x + toe,
                      -0.50,
                      0.33
                    ],

                  radiusTop:
                    0.025,

                  radiusBottom:
                    0.032,

                  radialSegments:
                    8,

                  outlines

                })
              );

            }
          );

      }
    );


  /*
   * Long volumetric giraffe neck.
   */
  root.add(
    rod({

      name:
        "MarvinNeck",

      color:
        GIRAFFE,

      start:
        [
          0.03,
          1.45,
          0.02
        ],

      end:
        [
          0.03,
          2.78,
          0.06
        ],

      radiusTop:
        0.23,

      radiusBottom:
        0.33,

      radialSegments:
        14,

      outlines

    })
  );


  /*
   * Head.
   */
  root.add(
    ellipsoid({

      name:
        "MarvinHead",

      color:
        GIRAFFE,

      position:
        [
          0.03,
          3.05,
          0.04
        ],

      scale:
        [
          0.48,
          0.58,
          0.42
        ],

      outlines

    })
  );


  /*
   * Forward-projecting muzzle.
   */
  root.add(
    ellipsoid({

      name:
        "MarvinMuzzle",

      color:
        GIRAFFE_LIGHT,

      position:
        [
          0.03,
          2.88,
          0.39
        ],

      scale:
        [
          0.34,
          0.25,
          0.31
        ],

      outlines

    })
  );


  [-1, 1]
    .forEach(
      side => {

        /*
         * Ear.
         */
        root.add(
          ellipsoid({

            name:
              "MarvinEar",

            color:
              GIRAFFE_LIGHT,

            position:
              [
                side * 0.43,
                3.25,
                0.02
              ],

            scale:
              [
                0.25,
                0.12,
                0.11
              ],

            rotation:
              [
                0.08,
                side * 0.16,
                side * 0.30
              ],

            outlines,

            segments:
              16

          })
        );


        const hornX =
          side * 0.18;


        /*
         * Giraffe ossicone.
         */
        root.add(
          rod({

            name:
              "MarvinOssicone",

            color:
              SPOT,

            start:
              [
                hornX,
                3.43,
                0.01
              ],

            end:
              [
                hornX,
                3.78,
                0.01
              ],

            radiusTop:
              0.052,

            radiusBottom:
              0.060,

            radialSegments:
              10,

            outlines

          })
        );


        root.add(
          ellipsoid({

            name:
              "MarvinOssiconeTip",

            color:
              SPOT,

            position:
              [
                hornX,
                3.82,
                0.01
              ],

            scale:
              [
                0.09,
                0.09,
                0.09
              ],

            outlines,

            segments:
              12

          })
        );


        const eyeX =
          side * 0.19;


        /*
         * Eye.
         */
        root.add(
          ellipsoid({

            name:
              "MarvinEye",

            color:
              WHITE,

            position:
              [
                eyeX,
                3.12,
                0.39
              ],

            scale:
              [
                0.135,
                0.17,
                0.105
              ],

            outlines,

            segments:
              16

          })
        );


        root.add(
          ellipsoid({

            name:
              "MarvinPupil",

            color:
              BLACK,

            position:
              [
                eyeX + side * 0.010,
                3.12,
                0.485
              ],

            scale:
              [
                0.052,
                0.074,
                0.043
              ],

            outlines:
              false,

            segments:
              12

          })
        );


        /*
         * Nostril.
         */
        root.add(
          ellipsoid({

            name:
              "MarvinNostril",

            color:
              BLACK,

            position:
              [
                side * 0.105,
                2.90,
                0.665
              ],

            scale:
              [
                0.040,
                0.034,
                0.025
              ],

            outlines:
              false,

            segments:
              10

          })
        );

      }
    );


  /*
   * Giraffe spots.
   */
  [
    [-0.18, 1.82, 0.27, 0.12, 0.18, 0.045],
    [ 0.15, 2.08, 0.28, 0.10, 0.16, 0.045],
    [-0.13, 2.34, 0.26, 0.13, 0.14, 0.043],
    [ 0.16, 2.56, 0.23, 0.10, 0.12, 0.040],
    [-0.23, 3.16, 0.34, 0.12, 0.10, 0.038],
    [ 0.25, 3.30, 0.24, 0.10, 0.08, 0.035]
  ]
    .forEach(
      spot => {

        root.add(
          ellipsoid({

            name:
              "MarvinSpot",

            color:
              SPOT,

            position:
              [
                spot[0],
                spot[1],
                spot[2]
              ],

            scale:
              [
                spot[3],
                spot[4],
                spot[5]
              ],

            outlines:
              false,

            segments:
              14

          })
        );

      }
    );


  /*
   * Smooth transition between
   * bird body and giraffe neck.
   */
  root.add(
    ellipsoid({

      name:
        "MarvinCollar",

      color:
        BODY_LIGHT,

      position:
        [
          0.02,
          1.48,
          0.02
        ],

      scale:
        [
          0.39,
          0.20,
          0.35
        ],

      outlines,

      segments:
        16

    })
  );


  return normalize(
    root,
    2.45
  );

}


export function supportsVolumetricCharacter(
  characterId
) {

  return String(
    characterId || ""
  ) === MARVIN_ID;

}


export function createVolumetricCharacter(
  characterId,
  options = {}
) {

  if (
    !supportsVolumetricCharacter(
      characterId
    )
  ) {

    return null;

  }


  return buildMarvin(
    options
  );

}


export function disposeVolumetricCharacter(
  root
) {

  if (!root) {
    return;
  }


  const geometries =
    new Set();


  const materials =
    new Set();


  root.traverse(
    child => {

      if (!child.isMesh) {
        return;
      }


      if (child.geometry) {

        geometries.add(
          child.geometry
        );

      }


      const list =
        Array.isArray(
          child.material
        )

          ? child.material

          : [
              child.material
            ];


      list.forEach(
        item => {

          if (item) {

            materials.add(
              item
            );

          }

        }
      );

    }
  );


  materials.forEach(
    item =>
      item.dispose()
  );


  geometries.forEach(
    item =>
      item.dispose()
  );

}


/*
 * Creates an actual binary GLB.
 *
 * Export is lazy, so GLTFExporter
 * is NOT loaded during normal play.
 */
export async function exportVolumetricGLB(
  characterId
) {

  const character =
    createVolumetricCharacter(
      characterId,
      {
        outlines:
          false
      }
    );


  if (!character) {

    throw new Error(
      `No volumetric builder for ${characterId}`
    );

  }


  const {
    GLTFExporter
  } = await import(
    "three/addons/exporters/GLTFExporter.js"
  );


  const exporter =
    new GLTFExporter();


  return new Promise(
    (
      resolve,
      reject
    ) => {

      exporter.parse(

        character,

        result => {

          disposeVolumetricCharacter(
            character
          );


          if (
            result instanceof ArrayBuffer
          ) {

            resolve(
              result
            );

            return;

          }


          reject(
            new Error(
              "GLB exporter did not return binary data"
            )
          );

        },

        error => {

          disposeVolumetricCharacter(
            character
          );


          reject(
            error
          );

        },

        {
          binary:
            true,

          onlyVisible:
            true,

          trs:
            false
        }

      );

    }
  );

}


/*
 * Later we can wire this to a
 * dev-only button instead of Console.
 */
export async function downloadVolumetricGLB(
  characterId,
  filename =
    "comic-giraffe-bird-volumetric.glb"
) {

  const buffer =
    await exportVolumetricGLB(
      characterId
    );


  const blob =
    new Blob(
      [buffer],
      {
        type:
          "model/gltf-binary"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const anchor =
    document.createElement(
      "a"
    );


  anchor.href =
    url;

  anchor.download =
    filename;


  document.body.appendChild(
    anchor
  );


  anchor.click();

  anchor.remove();


  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1500
  );

}


window.LAGO_VOLUMETRIC =
  Object.freeze({

    version:
      VERSION,

    supports:
      supportsVolumetricCharacter,

    create:
      createVolumetricCharacter,

    exportGLB:
      exportVolumetricGLB,

    downloadGLB:
      downloadVolumetricGLB

  });
