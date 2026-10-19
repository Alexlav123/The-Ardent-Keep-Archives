(function defineArchiveCollections(global) {
  "use strict";

  global.ARCHIVE_CONFIG = Object.freeze({
    debugHotspots: false,
    room: Object.freeze({
      portraitFocusX: 0.3
    }),
    collections: Object.freeze({
      "blacktower-papers": Object.freeze({
        id: "blacktower-papers",
        title: "The Blacktower Papers",
        creator: "Carleon I Blacktower",
        provenance: "Recovered at Ardent Keep",
        type: "image-book",
        // Image books keep binding art separate from numbered manuscript pages.
        // To add another one, provide the three cover paths plus an ordered
        // contentPages array. sourcePdf is optional reference material only.
        book: Object.freeze({
          frontCover: "assets/covers/front-cover.png",
          insideFront: "assets/covers/inside-front.png",
          insideBack: "assets/covers/inside-back.png",
          mirrorInsideBack: true,
          coverOversize: 0.025,
          contentPages: Object.freeze([
            "collections/blacktower_papers/page-1-transparent.png",
            "collections/blacktower_papers/page-2-transparent.png",
            "collections/blacktower_papers/page-3-transparent.png",
            "collections/blacktower_papers/page-4-transparent.png",
            "collections/blacktower_papers/page-5-transparent.png",
            "collections/blacktower_papers/page-6-transparent.png",
            "collections/blacktower_papers/page-7-transparent.png",
            "collections/blacktower_papers/page-8-transparent.png",
            "collections/blacktower_papers/page-9-transparent.png",
            "collections/blacktower_papers/page-10-transparent.png"
          ]),
          sourcePdf: "collections/blacktower_papers/Blacktower_Papers_Entries_I-IV.pdf"
        }),
        contentsPage: 3,
        entries: Object.freeze([
          Object.freeze({
            id: "entry-1",
            label: "Entry I",
            date: "12 Nerament, 1444",
            startPage: 4,
            contentsRegion: Object.freeze({
              x: 0.11,
              y: 0.235,
              width: 0.725,
              height: 0.065
            })
          }),
          Object.freeze({
            id: "entry-2",
            label: "Entry II",
            date: "1449",
            fragment: true,
            startPage: 6,
            contentsRegion: Object.freeze({
              x: 0.11,
              y: 0.32,
              width: 0.725,
              height: 0.065
            })
          }),
          Object.freeze({
            id: "entry-3",
            label: "Entry III",
            date: "17 Nerament, 1456",
            fragment: true,
            startPage: 7,
            contentsRegion: Object.freeze({
              x: 0.11,
              y: 0.405,
              width: 0.725,
              height: 0.065
            })
          }),
          Object.freeze({
            id: "entry-4",
            label: "Entry IV",
            date: "1 Castanmark, 1470",
            startPage: 9,
            contentsRegion: Object.freeze({
              x: 0.11,
              y: 0.49,
              width: 0.725,
              height: 0.065
            })
          })
        ])
      }),
      "diplomatic-papers": Object.freeze({
        id: "diplomatic-papers",
        title: "Diplomatic Papers",
        creator: "The Antiquarians Collection",
        provenance: "Treaties and correspondence",
        type: "document-catalogue"
      }),
      "cartographic-collection": Object.freeze({
        id: "cartographic-collection",
        title: "Cartographic Collection",
        creator: "The Antiquarians Collection",
        provenance: "Maps and charts",
        type: "map-catalogue"
      })
    }),
    objects: Object.freeze([
      Object.freeze({
        id: "blacktower-papers",
        title: "The Blacktower Papers",
        description: "The surviving private writings of Carleon I Blacktower.",
        collectionId: "blacktower-papers",
        presentation: "image",
        imageSrc: "assets/objects/blacktower_papers.png",
        visible: true,
        placement: Object.freeze({
          x: 0.255,
          y: 0.665,
          width: 0.077,
          rotation: 2.5
        })
      }),
      Object.freeze({
        id: "cartographic-wall-map",
        title: "Cartographic Collection",
        collectionId: "cartographic-collection",
        presentation: "hotspot",
        visible: true,
        hotspot: Object.freeze({
          x: 0.528,
          y: 0.226,
          width: 0.073,
          height: 0.273,
          rotation: 0
        })
      }),
      Object.freeze({
        id: "diplomatic-papers-cabinet",
        title: "Diplomatic Papers",
        collectionId: "diplomatic-papers",
        presentation: "hotspot",
        labelSide: "left",
        visible: true,
        hotspot: Object.freeze({
          x: 0.776,
          y: 0.278,
          width: 0.085,
          height: 0.462,
          rotation: 0
        })
      })
    ])
  });
})(window);
