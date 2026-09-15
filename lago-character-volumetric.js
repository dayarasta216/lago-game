import * as THREE from "three";


const VERSION = 2;

const MARVIN_ID =
  "comic_giraffe_bird";


/*
 * =========================================================
 * MATERIALS
 * =========================================================
 */

function mat(
  color,
  roughness = 0.84
) {

  return new THREE
    .MeshStandardMaterial({

      color,

      roughness,

      metalness:
        0,

      /*
       * Marvin must look like a smooth
       * cartoon character, not a low-poly
       * faceted toy.
       */
      flatShading:
        false

    });

}


function outlineMat() {

  return new THREE
    .MeshBasicMaterial({

      color:
        0x17110f,

      side:
        THREE.BackSide

    });

}


function finish(
  mesh,
  outlines = true,
  outlineScale = 1.018
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


    outline.scale
      .setScalar(
        outlineScale
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


/*
 * =========================================================
 * BASIC VOLUMETRIC SHAPES
 * =========================================================
 */

function ellipsoid(
  {
    name,

    color,

    position,

    scale,

    rotation =
      [0, 0, 0],

    outlines =
      true,

    segments =
      24,

    roughness =
      0.84
  }
) {

  const mesh =
    new THREE.Mesh(

      new THREE
        .SphereGeometry(

          1,

          segments,

          Math.max(
            14,
            Math.floor(
              segments *
              0.72
            )
          )

        ),

      mat(
        color,
        roughness
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
    outlines
  );

}


function rod(
  {
    name,

    color,

    start,

    end,

    radiusTop,

    radiusBottom =
      radiusTop,

    outlines =
      true,

    radialSegments =
      14,

    roughness =
      0.84
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

      new THREE
        .CylinderGeometry(

          radiusTop,

          radiusBottom,

          length,

          radialSegments,

          1,

          false

        ),

      mat(
        color,
        roughness
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
    outlines
  );

}


/*
 * =========================================================
 * BREAST FEATHERS
 * =========================================================
 */

function addBreastFeathers(
  root,
  outlines,
  colors
) {

  const rows = [

    {
      y:
        1.46,

      xs:
        [
          -0.31,
          0,
          0.31
        ],

      size:
        0.19
    },

    {
      y:
        1.19,

      xs:
        [
          -0.42,
          -0.14,
          0.14,
          0.42
        ],

      size:
        0.18
    },

    {
      y:
        0.91,

      xs:
        [
          -0.34,
          0,
          0.34
        ],

      size:
        0.19
    },

    {
      y:
        0.64,

      xs:
        [
          -0.22,
          0.22
        ],

      size:
        0.18
    }

  ];


  rows.forEach(
    (
      row,
      rowIndex
    ) => {

      row.xs.forEach(
        (
          x,
          index
        ) => {

          root.add(
            ellipsoid({

              name:
                `MarvinBreastFeather-${rowIndex}-${index}`,

              color:
                (
                  rowIndex +
                  index
                ) %
                  2 ===
                0

                  ? colors.light

                  : colors.mid,

              position:
                [
                  x,
                  row.y,
                  0.52
                ],

              scale:
                [
                  row.size,

                  row.size *
                  1.55,

                  0.07
                ],

              rotation:
                [
                  0.05,
                  0,
                  x *
                  -0.22
                ],

              outlines:
                false,

              segments:
                18

            })
          );

        }
      );

    }
  );

}


/*
 * =========================================================
 * WINGS
 * =========================================================
 */

function addWing(
  root,
  side,
  outlines,
  colors
) {

  const x =
    side *
    0.53;


  /*
   * Main long dark wing.
   */
  root.add(
    ellipsoid({

      name:
        side <
        0

          ? "MarvinWingLeft"

          : "MarvinWingRight",

      color:
        colors.dark,

      position:
        [
          x,
          1.12,
          -0.05
        ],

      scale:
        [
          0.27,
          0.83,
          0.37
        ],

      rotation:
        [
          0.07,

          side *
          -0.07,

          side *
          0.10
        ],

      outlines,

      segments:
        22

    })
  );


  /*
   * Large layered feathers.
   */
  const feathers = [

    [
      0.03,
      1.18,
      0.30,
      0.20,
      0.48,
      0.11
    ],

    [
      0.06,
      0.96,
      0.29,
      0.19,
      0.50,
      0.10
    ],

    [
      0.04,
      0.73,
      0.27,
      0.17,
      0.44,
      0.09
    ]

  ];


  feathers.forEach(
    (
      feather,
      index
    ) => {

      root.add(
        ellipsoid({

          name:
            `MarvinWingFeather-${side}-${index}`,

          color:
            index ===
            1

              ? colors.midDark

              : colors.darkLight,

          position:
            [
              x +
              side *
              feather[0],

              feather[1],

              feather[2]
            ],

          scale:
            [
              feather[3],

              feather[4],

              feather[5]
            ],

          rotation:
            [
              0.08,

              side *
              0.04,

              side *
              0.08
            ],

          outlines:
            false,

          segments:
            18

        })
      );


      /*
       * Light feather streak.
       */
      root.add(
        ellipsoid({

          name:
            `MarvinWingStripe-${side}-${index}`,

          color:
            colors.stripe,

          position:
            [
              x -
              side *
              0.01,

              feather[1] +
              0.02,

              feather[2] +
              0.105
            ],

          scale:
            [
              feather[3] *
              0.50,

              feather[4] *
              0.72,

              0.025
            ],

          rotation:
            [
              0.08,
              0,

              side *
              0.08
            ],

          outlines:
            false,

          segments:
            14

        })
      );

    }
  );

}


/*
 * =========================================================
 * FEET
 * =========================================================
 */

function addFoot(
  root,
  side,
  color,
  outlines
) {

  const x =
    side *
    0.22;


  const ankleY =
    -0.62;


  root.add(
    ellipsoid({

      name:
        `MarvinAnkle-${side}`,

      color,

      position:
        [
          x,
          ankleY,
          0.02
        ],

      scale:
        [
          0.085,
          0.12,
          0.085
        ],

      outlines,

      segments:
        14

    })
  );


  /*
   * Three long forward toes.
   */
  [
    [
      -0.15,
      0.34
    ],

    [
      0,
      0.39
    ],

    [
      0.15,
      0.32
    ]

  ]
    .forEach(
      (
        toe,
        index
      ) => {

        root.add(
          rod({

            name:
              `MarvinToe-${side}-${index}`,

            color,

            start:
              [
                x,
                ankleY -
                0.03,
                0.06
              ],

            end:
              [
                x +
                toe[0],

                ankleY -
                0.08,

                toe[1]
              ],

            radiusTop:
              0.022,

            radiusBottom:
              0.034,

            radialSegments:
              8,

            outlines

          })
        );

      }
    );


  /*
   * Rear toe.
   */
  root.add(
    rod({

      name:
        `MarvinBackToe-${side}`,

      color,

      start:
        [
          x,
          ankleY -
          0.02,
          0.01
        ],

      end:
        [
          x -
          side *
          0.06,

          ankleY -
          0.05,

          -0.20
        ],

      radiusTop:
        0.020,

      radiusBottom:
        0.030,

      radialSegments:
        8,

      outlines

    })
  );

}


/*
 * =========================================================
 * TONGUE
 * =========================================================
 */

function addTongue(
  root,
  color,
  outlines
) {

  const curve =
    new THREE
      .CatmullRomCurve3([

        new THREE.Vector3(
          0,
          3.22,
          0.68
        ),

        new THREE.Vector3(
          0.02,
          3.03,
          0.79
        ),

        new THREE.Vector3(
          0.06,
          2.80,
          0.80
        ),

        new THREE.Vector3(
          0.02,
          2.57,
          0.72
        )

      ]);


  const tongue =
    new THREE.Mesh(

      new THREE
        .TubeGeometry(

          curve,

          18,

          0.105,

          10,

          false

        ),

      mat(
        color,
        0.72
      )

    );


  tongue.name =
    "MarvinTongue";


  finish(
    tongue,
    outlines,
    1.012
  );


  root.add(
    tongue
  );


  root.add(
    ellipsoid({

      name:
        "MarvinTongueTip",

      color,

      position:
        [
          0.02,
          2.52,
          0.70
        ],

      scale:
        [
          0.12,
          0.17,
          0.11
        ],

      outlines,

      segments:
        18,

      roughness:
        0.72

    })
  );

}


/*
 * =========================================================
 * GIRAFFE SPOTS
 * =========================================================
 */

function addGiraffeSpots(
  root,
  color
) {

  const spots = [

    [
      -0.16,
      2.08,
      0.19,
      0.10,
      0.14
    ],

    [
      0.15,
      2.26,
      0.20,
      0.08,
      0.12
    ],

    [
      -0.10,
      2.48,
      0.22,
      0.12,
      0.10
    ],

    [
      0.13,
      2.72,
      0.22,
      0.08,
      0.12
    ],

    [
      -0.20,
      2.91,
      0.20,
      0.10,
      0.09
    ],

    [
      0.20,
      3.53,
      0.33,
      0.09,
      0.07
    ],

    [
      -0.24,
      3.71,
      0.22,
      0.11,
      0.08
    ],

    [
      0.06,
      3.83,
      0.37,
      0.08,
      0.07
    ]

  ];


  spots.forEach(
    (
      spot,
      index
    ) => {

      root.add(
        ellipsoid({

          name:
            `MarvinSpot-${index}`,

          color,

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
              0.035
            ],

          rotation:
            [
              0,
              0,

              index %
              2

                ? 0.25

                : -0.18
            ],

          outlines:
            false,

          segments:
            14

        })
      );

    }
  );

}


/*
 * =========================================================
 * NORMALIZE
 * =========================================================
 */

function normalize(
  root,
  targetHeight = 2.55
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


/*
 * =========================================================
 * MARVIN VOLUMETRIC V2
 * =========================================================
 */

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


  const C = {

    body:
      0x8c8d8b,

    bodyMid:
      0xb9b8b3,

    breast:
      0xd8d5cd,

    wing:
      0x42474d,

    wingLight:
      0x626970,

    wingMid:
      0x50565d,

    stripe:
      0xa9adb0,

    giraffe:
      0xd6a15c,

    giraffeLight:
      0xe7bd7b,

    spot:
      0x6e4128,

    leg:
      0x5d5550,

    black:
      0x141313,

    white:
      0xf8f7f2,

    tongue:
      0x9e4f5b

  };


  /*
   * =====================================================
   * TALL NARROW BIRD BODY
   * =====================================================
   */

  root.add(
    ellipsoid({

      name:
        "MarvinBody",

      color:
        C.body,

      position:
        [
          0,
          0.95,
          0
        ],

      scale:
        [
          0.58,
          1.05,
          0.50
        ],

      outlines,

      segments:
        26

    })
  );


  /*
   * Front breast volume.
   */
  root.add(
    ellipsoid({

      name:
        "MarvinChest",

      color:
        C.breast,

      position:
        [
          0,
          1.03,
          0.38
        ],

      scale:
        [
          0.43,
          0.86,
          0.17
        ],

      outlines:
        false,

      segments:
        24

    })
  );


  addBreastFeathers(
    root,
    outlines,
    {
      light:
        C.breast,

      mid:
        C.bodyMid
    }
  );


  /*
   * =====================================================
   * DARK LONG WINGS
   * =====================================================
   */

  addWing(
    root,
    -1,
    outlines,
    {
      dark:
        C.wing,

      darkLight:
        C.wingLight,

      midDark:
        C.wingMid,

      stripe:
        C.stripe
    }
  );


  addWing(
    root,
    1,
    outlines,
    {
      dark:
        C.wing,

      darkLight:
        C.wingLight,

      midDark:
        C.wingMid,

      stripe:
        C.stripe
    }
  );


  /*
   * =====================================================
   * NARROW TAIL
   * =====================================================
   */

  [
    -0.18,
    0,
    0.18
  ]
    .forEach(
      (
        x,
        index
      ) => {

        root.add(
          ellipsoid({

            name:
              `MarvinTail-${index}`,

            color:
              index ===
              1

                ? C.wingMid

                : C.wing,

            position:
              [
                x,
                0.55,
                -0.47
              ],

            scale:
              [
                0.13,
                0.50,
                0.13
              ],

            rotation:
              [
                -0.38,
                0,

                x *
                0.75
              ],

            outlines,

            segments:
              18

          })
        );

      }
    );


  /*
   * =====================================================
   * VERY LONG THIN BIRD LEGS
   * =====================================================
   */

  [
    -1,
    1
  ]
    .forEach(
      side => {

        const x =
          side *
          0.22;


        root.add(
          rod({

            name:
              side <
              0

                ? "MarvinLegLeft"

                : "MarvinLegRight",

            color:
              C.leg,

            start:
              [
                x,
                0.35,
                0
              ],

            end:
              [
                x +
                side *
                0.01,

                -0.57,

                0.03
              ],

            radiusTop:
              0.042,

            radiusBottom:
              0.050,

            radialSegments:
              10,

            outlines

          })
        );


        root.add(
          ellipsoid({

            name:
              `MarvinKnee-${side}`,

            color:
              C.leg,

            position:
              [
                x,
                -0.18,
                0.02
              ],

            scale:
              [
                0.065,
                0.09,
                0.065
              ],

            outlines,

            segments:
              12

          })
        );


        addFoot(
          root,
          side,
          C.leg,
          outlines
        );

      }
    );


  /*
   * =====================================================
   * THIN LONG GIRAFFE NECK
   * =====================================================
   */

  const neckSegments = [

    [
      [
        0,
        1.74,
        0
      ],

      [
        0.01,
        2.23,
        0.02
      ],

      0.155,
      0.19
    ],

    [
      [
        0.01,
        2.20,
        0.02
      ],

      [
        0,
        2.70,
        0.05
      ],

      0.145,
      0.17
    ],

    [
      [
        0,
        2.66,
        0.05
      ],

      [
        0.02,
        3.18,
        0.10
      ],

      0.135,
      0.16
    ]

  ];


  neckSegments.forEach(
    (
      segment,
      index
    ) => {

      root.add(
        rod({

          name:
            `MarvinNeck-${index}`,

          color:
            C.giraffe,

          start:
            segment[0],

          end:
            segment[1],

          radiusTop:
            segment[2],

          radiusBottom:
            segment[3],

          radialSegments:
            16,

          outlines

        })
      );

    }
  );


  /*
   * Feather collar where neck enters body.
   */
  root.add(
    ellipsoid({

      name:
        "MarvinNeckBase",

      color:
        C.bodyMid,

      position:
        [
          0,
          1.72,
          0.01
        ],

      scale:
        [
          0.31,
          0.20,
          0.29
        ],

      outlines,

      segments:
        18

    })
  );


  /*
   * =====================================================
   * LARGE GIRAFFE HEAD
   * =====================================================
   */

  root.add(
    ellipsoid({

      name:
        "MarvinHead",

      color:
        C.giraffe,

      position:
        [
          0.01,
          3.48,
          0.09
        ],

      scale:
        [
          0.46,
          0.52,
          0.40
        ],

      rotation:
        [
          0.04,
          0,
          0
        ],

      outlines,

      segments:
        26

    })
  );


  /*
   * Big forward muzzle.
   */
  root.add(
    ellipsoid({

      name:
        "MarvinMuzzle",

      color:
        C.giraffeLight,

      position:
        [
          0.01,
          3.29,
          0.48
        ],

      scale:
        [
          0.39,
          0.25,
          0.34
        ],

      rotation:
        [
          0.05,
          0,
          0
        ],

      outlines,

      segments:
        24

    })
  );


  /*
   * Mouth shadow behind tongue.
   */
  root.add(
    ellipsoid({

      name:
        "MarvinMouth",

      color:
        C.black,

      position:
        [
          0.01,
          3.20,
          0.655
        ],

      scale:
        [
          0.22,
          0.075,
          0.025
        ],

      outlines:
        false,

      segments:
        16

    })
  );


  /*
   * =====================================================
   * HUGE BULGING EYES
   * =====================================================
   */

  [

    {
      side:
        -1,

      x:
        -0.25,

      y:
        3.58,

      z:
        0.38,

      sx:
        0.21,

      sy:
        0.23
    },

    {
      side:
        1,

      x:
        0.24,

      y:
        3.60,

      z:
        0.39,

      sx:
        0.22,

      sy:
        0.24
    }

  ]
    .forEach(
      (
        eye,
        index
      ) => {

        root.add(
          ellipsoid({

            name:
              `MarvinEye-${index}`,

            color:
              C.white,

            position:
              [
                eye.x,
                eye.y,
                eye.z
              ],

            scale:
              [
                eye.sx,
                eye.sy,
                0.17
              ],

            outlines,

            segments:
              22

          })
        );


        root.add(
          ellipsoid({

            name:
              `MarvinPupil-${index}`,

            color:
              C.black,

            position:
              [
                eye.x +
                eye.side *
                0.012,

                eye.y -
                0.005,

                eye.z +
                0.155
              ],

            scale:
              [
                0.055,
                0.070,
                0.038
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
   * =====================================================
   * LARGE SIDE EARS
   * =====================================================
   */

  [
    -1,
    1
  ]
    .forEach(
      side => {

        root.add(
          ellipsoid({

            name:
              `MarvinEar-${side}`,

            color:
              C.giraffeLight,

            position:
              [
                side *
                0.46,

                3.78,

                0.07
              ],

            scale:
              [
                0.31,
                0.13,
                0.12
              ],

            rotation:
              [
                0.02,

                side *
                0.07,

                side *
                0.30
              ],

            outlines,

            segments:
              20

          })
        );


        root.add(
          ellipsoid({

            name:
              `MarvinEarInner-${side}`,

            color:
              C.spot,

            position:
              [
                side *
                0.47,

                3.78,

                0.16
              ],

            scale:
              [
                0.20,
                0.065,
                0.025
              ],

            rotation:
              [
                0,
                0,

                side *
                0.30
              ],

            outlines:
              false,

            segments:
              16

          })
        );

      }
    );


  /*
   * =====================================================
   * GIRAFFE OSSICONES
   * =====================================================
   */

  [
    -1,
    1
  ]
    .forEach(
      side => {

        const x =
          side *
          0.17;


        root.add(
          rod({

            name:
              `MarvinOssicone-${side}`,

            color:
              C.giraffe,

            start:
              [
                x,
                3.88,
                0.02
              ],

            end:
              [
                x +
                side *
                0.015,

                4.22,

                0
              ],

            radiusTop:
              0.055,

            radiusBottom:
              0.065,

            radialSegments:
              12,

            outlines

          })
        );


        root.add(
          ellipsoid({

            name:
              `MarvinOssiconeTip-${side}`,

            color:
              C.spot,

            position:
              [
                x +
                side *
                0.015,

                4.26,

                0
              ],

            scale:
              [
                0.095,
                0.09,
                0.085
              ],

            outlines,

            segments:
              14

          })
        );

      }
    );


  /*
   * =====================================================
   * LARGE NOSTRILS
   * =====================================================
   */

  [
    -1,
    1
  ]
    .forEach(
      side => {

        root.add(
          ellipsoid({

            name:
              `MarvinNostril-${side}`,

            color:
              C.black,

            position:
              [
                side *
                0.115,

                3.33,

                0.77
              ],

            scale:
              [
                0.052,
                0.041,
                0.024
              ],

            outlines:
              false,

            segments:
              12

          })
        );

      }
    );


  /*
   * Brown spots on neck/head.
   */
  addGiraffeSpots(
    root,
    C.spot
  );


  /*
   * Canonical long hanging tongue.
   */
  addTongue(
    root,
    C.tongue,
    outlines
  );


  return normalize(
    root,
    2.55
  );

}


/*
 * =========================================================
 * PUBLIC API
 * =========================================================
 */

export function supportsVolumetricCharacter(
  characterId
) {

  return String(
    characterId ||
    ""
  ) ===
  MARVIN_ID;

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

      if (
        !child.isMesh
      ) {

        return;

      }


      if (
        child.geometry
      ) {

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
 * =========================================================
 * GLB EXPORT
 * =========================================================
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
            result instanceof
            ArrayBuffer
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

      [
        buffer
      ],

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
    () => {

      URL.revokeObjectURL(
        url
      );

    },
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
