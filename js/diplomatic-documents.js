(function defineDiplomaticDocuments(global) {
  "use strict";

  const root = "assets/anbennar_letters_and_documents";

  global.DIPLOMATIC_DOCUMENTS = Object.freeze([
    Object.freeze({
      id: "thorn-alliance-1444",
      title: "Treaty of Friendship & Mutual Defense",
      year: 1444,
      parties: "Count's League — Company of the Thorn",
      category: "Treaty",
      description: "A pact of friendship, common defence, safe passage, and mutual warning in the unsettled lands of Escann.",
      provenance: "Filed among the early alliance papers of the Count's League.",
      pages: Object.freeze([
        `${root}/1444-company_of_the_thorn_alliance/1.png`,
        `${root}/1444-company_of_the_thorn_alliance/2.png`
      ])
    }),
    Object.freeze({
      id: "castanorian-understanding-1470",
      title: "Accord of Castanorian Understanding",
      year: 1470,
      parties: "Count's League — Order of the Iron Sceptre",
      category: "Accord",
      description: "A formal settlement of competing claims in Inner and South Castanor, including protections for Corintar and Marrhold.",
      provenance: "Recovered with the League's diplomatic instruments.",
      pages: Object.freeze([
        `${root}/1470-accord_of_castanorian_understanding/1.png`,
        `${root}/1470-accord_of_castanorian_understanding/2.png`
      ])
    }),
    Object.freeze({
      id: "nurced-accord-1470",
      title: "The Accord of Nürced",
      year: 1470,
      parties: "Count's League — Company of the Thorn",
      category: "Accord",
      description: "An agreement defining territorial claims and arranging the transfer of Nürced to the Count's League.",
      provenance: "Acquired from the Count's League treaty archive.",
      pages: Object.freeze([
        `${root}/1470-nurcestir_accord/1.png`,
        `${root}/1470-nurcestir_accord/2.png`
      ])
    }),
    Object.freeze({
      id: "orcish-proclamation-1470",
      title: "Settlement of the Orcs",
      year: 1470,
      parties: "Count's League",
      category: "Proclamation",
      description: "A proclamation governing orcish settlement, lawful protection, civic duties, and judgment beneath the League's authority.",
      provenance: "Issued and sealed by Carleon I Blacktower.",
      pages: Object.freeze([
        `${root}/1470-orchish_proclimation/1.png`,
        `${root}/1470-orchish_proclimation/2.png`
      ])
    })
  ]);
})(window);
