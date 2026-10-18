// Factual pet metadata. Provenance and required source attribution: docs/pet-sources.md.
export const PET_CATALOG = Object.freeze({
  "schema_version": 1,
  "region": "EU/NA",
  "verified_at": "2026-10-18",
  "complete": false,
  "source_client_build": "0.0.4387.0",
  "source_snapshot_commit": "fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8",
  "source_snapshot_sha256": "2cc5f138ab34b6452e1383a5bb0e2c92b8ce14b3ca5049b070ec5d7bc2373641",
  "primary_list_sha256": "7ce8875e856b92bed9e0db63b9f470738556c035b0c38abcd3c07e66da9aea57",
  "requirements": {
    "basis": "per-level",
    "souls": [
      5,
      25,
      75
    ],
    "verified": true,
    "source_url": "https://github.com/MartinLVila/aion2-pet-overlay/blob/fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8/pet_protocol.py",
    "max_level": 3,
    "total_to_max": 105,
    "cumulative_totals": [
      5,
      30,
      105
    ],
    "verification": "community-protocol-observation"
  },
  "sources": [
    {
      "id": "pet-data-snapshot",
      "title": "AION2 Pet Overlay factual snapshot",
      "url": "https://github.com/MartinLVila/aion2-pet-overlay/blob/fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8/data/pets.json",
      "commit": "fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8",
      "license": "MIT",
      "copyright": "Copyright (c) 2026 MartinLVila; Copyright (c) 2026 AION2-pet-tracker contributors"
    },
    {
      "id": "metabot-primary",
      "title": "MetaBot.GG AION 2 mounts",
      "url": "https://metabot.gg/en/aion-2/mounts",
      "terms_url": "https://metabot.gg/en/legal/terms-of-service",
      "attribution_required": true,
      "attribution_scope": "Specific source page for every reused pet or location; ordinary dofollow link"
    },
    {
      "id": "pet-counter-observation",
      "title": "Pet counter protocol observations",
      "url": "https://github.com/MartinLVila/aion2-pet-overlay/blob/fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8/pet_protocol.py",
      "license": "MIT",
      "commit": "fd0214ade31b47577f5a6aaaa7e6aea21ac48eb8"
    },
    {
      "id": "official-tw-guide",
      "title": "NCSOFT Taiwan pet guide (regional comparison only)",
      "url": "https://tw.ncsoft.com/aion2/guidebook/view?title=%E5%AF%B5%E7%89%A9",
      "region": "TW",
      "used_for_eu_thresholds": false
    }
  ],
  "pets": [
    {
      "id": 1001,
      "name": "Black Dragon",
      "genus": "Special",
      "faction": "unknown",
      "locations": [],
      "bonuses": [],
      "source_url": "https://metabot.gg/en/aion-2/mounts/black-dragon",
      "id_mapping_verified": true
    },
    {
      "id": 1002,
      "name": "Krall Laborer",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Verteron Fortress Ruins",
          "monster": "Krall Armed Soldier",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-laborer",
          "monster_level": 21,
          "spawn_count": 27,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100075"
        },
        {
          "zone": "Verteron",
          "area": "Destroyed Abyss Gate",
          "monster": "Krall Sentinel",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-laborer",
          "monster_level": 21,
          "spawn_count": 19,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100480"
        },
        {
          "zone": "Verteron",
          "area": "Scarlet Forest",
          "monster": "Mutated Krall Laborer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-laborer",
          "monster_level": 41,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100914"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-laborer"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-laborer"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-laborer"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-laborer"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/krall-laborer",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100075"
    },
    {
      "id": 1003,
      "name": "Forest Specter",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Altamia Canyon",
          "monster": "Canyon Vine Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-specter",
          "monster_level": 33,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100601"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Tainted Vine Specter",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-specter",
          "monster_level": 44,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100662"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-specter"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-specter"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-specter"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-specter"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/forest-specter",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100601"
    },
    {
      "id": 1004,
      "name": "Fossa",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins",
          "monster": "Tamed Beast",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fossa",
          "monster_level": 34,
          "spawn_count": 35,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400414"
        },
        {
          "zone": "Verteron",
          "area": "Southern Tolbas Forest",
          "monster": "Patrolling Fossa",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fossa",
          "monster_level": 25,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100163"
        },
        {
          "zone": "Altgard",
          "area": "Uruthumheim",
          "monster": "Daeva Renegade Fossa",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fossa",
          "monster_level": 24,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400254"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fossa"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fossa"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fossa"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fossa"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/fossa",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400414"
    },
    {
      "id": 1005,
      "name": "Klaw",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Mutated Klaw",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw",
          "monster_level": 52,
          "spawn_count": 145,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600429"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Branding Island",
          "monster": "Abyss Klaw Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw",
          "monster_level": 46,
          "spawn_count": 21,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600029"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - River of Rotten Sap",
          "monster": "Abyss Klaw Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw",
          "monster_level": 46,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600029"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Sulfur Swamp",
          "monster": "Abyss Klaw Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw",
          "monster_level": 46,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600029"
        },
        {
          "zone": "Verteron",
          "area": "Destroyed Abyss Gate",
          "monster": "Wandering Klaw",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw",
          "monster_level": 19,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100078"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/klaw",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600429"
    },
    {
      "id": 1006,
      "name": "Sparkie",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Meadow Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
          "monster_level": 18,
          "spawn_count": 38,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100305"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Meadow",
          "monster": "Meadow Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
          "monster_level": 18,
          "spawn_count": 37,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100305"
        },
        {
          "zone": "Verteron",
          "area": "Southern Altamia Highland",
          "monster": "Highland Odyle Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
          "monster_level": 33,
          "spawn_count": 74,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100753"
        },
        {
          "zone": "Verteron",
          "area": "Western Altamia Highland",
          "monster": "Highland Odyle Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
          "monster_level": 32,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100795"
        },
        {
          "zone": "Verteron",
          "area": "Aullaeu Village",
          "monster": "Aullaeu Forest Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
          "monster_level": 27,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100986"
        },
        {
          "zone": "Verteron",
          "area": "Forest of Exiles",
          "monster": "Aullaeu Forest Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
          "monster_level": 27,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100986"
        },
        {
          "zone": "Verteron",
          "area": "Aullaeu Village",
          "monster": "Highland Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
          "monster_level": 30,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100992"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Wild Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
          "monster_level": 18,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100273"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/sparkie",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100305"
    },
    {
      "id": 1007,
      "name": "Potcrab",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Ellun River Marsh",
          "monster": "Marsh Moss Potcrab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
          "monster_level": 14,
          "spawn_count": 24,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100032"
        },
        {
          "zone": "Verteron",
          "area": "Collapsed Verteron Barrier Tower",
          "monster": "Marsh Moss Potcrab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
          "monster_level": 14,
          "spawn_count": 7,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100032"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Marsh",
          "monster": "Marsh Moss Potcrab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
          "monster_level": 14,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100032"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Moss Crab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
          "monster_level": 49,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101098"
        },
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Moss Crab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
          "monster_level": 32,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400363"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Coastal Moss Crab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
          "monster_level": 49,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400812"
        },
        {
          "zone": "Verteron",
          "area": "Altamia Canyon",
          "monster": "Flat Potcrab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
          "monster_level": 33,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100610"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Coastal Moss Crab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
          "monster_level": 46,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400755"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/potcrab",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100032"
    },
    {
      "id": 1008,
      "name": "Baby Odyle Spider",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Spirit's Rest",
          "monster": "Coastal Odyle Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/baby-odyle-spider",
          "monster_level": 16,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100034"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Marsh",
          "monster": "Coastal Odyle Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/baby-odyle-spider",
          "monster_level": 16,
          "spawn_count": 3,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100034"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/baby-odyle-spider"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/baby-odyle-spider"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/baby-odyle-spider"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/baby-odyle-spider"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/baby-odyle-spider",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100034"
    },
    {
      "id": 1009,
      "name": "Kernon",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kernon"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kernon"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kernon"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kernon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kernon",
      "id_mapping_verified": true
    },
    {
      "id": 1010,
      "name": "Manduri Fighter",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Black Claw Village",
          "monster": "Black Claw Manduri Combatant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-fighter",
          "monster_level": 42,
          "spawn_count": 38,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400617"
        },
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Manduri Fighter",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-fighter",
          "monster_level": 48,
          "spawn_count": 24,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110506"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-fighter"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-fighter"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-fighter"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-fighter"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-fighter",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400617"
    },
    {
      "id": 1011,
      "name": "Skyray",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Ridge Skyray",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
          "monster_level": 27,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100556"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Tolbas Forest",
          "monster": "Tolbas Forest Lake Skyray",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
          "monster_level": 25,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100182"
        },
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Pond Skyray",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
          "monster_level": 39,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100832"
        },
        {
          "zone": "Verteron",
          "area": "Western Cantas Valley",
          "monster": "Cantas Valley Skyray",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
          "monster_level": 10,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101124"
        },
        {
          "zone": "Altgard",
          "area": "Tranein Pond",
          "monster": "Tranein Skyray",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
          "monster_level": 20,
          "spawn_count": 13,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400163"
        },
        {
          "zone": "Verteron",
          "area": "Southern Altamia Highland",
          "monster": "Lake Skyray",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
          "monster_level": 33,
          "spawn_count": 13,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101132"
        },
        {
          "zone": "Altgard",
          "area": "Idun's Lake",
          "monster": "Lake Skyray",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
          "monster_level": 40,
          "spawn_count": 13,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400945"
        },
        {
          "zone": "Verteron",
          "area": "Spirit's Rest",
          "monster": "Small Forest Skyray",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
          "monster_level": 16,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100047"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skyray"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/skyray",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100556"
    },
    {
      "id": 1012,
      "name": "Fungie",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eastern Cantas Valley",
          "monster": "Red Cap Fungie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungie",
          "monster_level": 12,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100041"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungie"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungie"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungie"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungie"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/fungie",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100041"
    },
    {
      "id": 1013,
      "name": "Swarm",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Steel Titan's Grave",
          "monster": "Abyss Swarm",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 52,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600401"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Eroded Fragment Area",
          "monster": "Abyss Swarm",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 52,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600401"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Branding Island",
          "monster": "Abyss Swarm Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 46,
          "spawn_count": 51,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600021"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - River of Rotten Sap",
          "monster": "Abyss Swarm Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 46,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600021"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Sulfur Swamp",
          "monster": "Abyss Swarm Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 46,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600021"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Devastated Remnants - Dusk Battlefield, Devastated Remnants - Shade Island, and Devastated Remnants - Weathered Outcrop",
          "monster": "Abyss Swarm",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 45,
          "spawn_count": 63,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600001"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Black Fragments Area - Kration Conflict Zone",
          "monster": "Abyss Aberrant Swarn",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 45,
          "spawn_count": 38,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600011"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Black Fragments Area - Lonely Island",
          "monster": "Abyss Aberrant Swarn",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 45,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600011"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Black Fragments Area - Kibelium Fragment",
          "monster": "Abyss Aberrant Swarn",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 45,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600011"
        },
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Giant Ore Insectoid",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 35,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400456"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Swarm",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 50,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600421"
        },
        {
          "zone": "Altgard",
          "area": "Calderon Canyon",
          "monster": "Contaminated Swarm",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
          "monster_level": 11,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400080"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swarm"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/swarm",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600401"
    },
    {
      "id": 1014,
      "name": "Drakan Guard Dog",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Left Wing",
          "monster": "Abyss Drakan Scout Beast",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog",
          "monster_level": 47,
          "spawn_count": 44,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600052"
        },
        {
          "zone": "Verteron",
          "area": "Nahid Brigade Fortress",
          "monster": "Drakan Guard Dog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog",
          "monster_level": 43,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101002"
        },
        {
          "zone": "Verteron",
          "area": "Nahid Brigade Fortress",
          "monster": "Nahid Drakan Guard Dog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog",
          "monster_level": 45,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101009"
        },
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland",
          "monster": "Drakan Patrol Armed Beast",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog",
          "monster_level": 40,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400587"
        },
        {
          "zone": "Altgard",
          "area": "Lagta Fortress",
          "monster": "Lagta Brigade Guard Dog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog",
          "monster_level": 43,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400655"
        },
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Drakan Guard Dog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog",
          "monster_level": 32,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400359"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-guard-dog",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600052"
    },
    {
      "id": 1015,
      "name": "Kailin",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Tranein Highland, Sanctum Outpost, and Tranein Pond",
          "monster": "Kailin",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kailin",
          "monster_level": 20,
          "spawn_count": 96,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400905"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Ellun River Kailin",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kailin",
          "monster_level": 18,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101021"
        },
        {
          "zone": "Altgard",
          "area": "Battlescar Mound and Purifying Forest",
          "monster": "Kailin",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kailin",
          "monster_level": 32,
          "spawn_count": 56,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400934"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Kailin",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kailin",
          "monster_level": 46,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400736"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kailin"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kailin"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kailin"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kailin"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kailin",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400905"
    },
    {
      "id": 1016,
      "name": "Slink",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Abyss Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink",
          "monster_level": 51,
          "spawn_count": 122,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600448"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Wetland Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink",
          "monster_level": 18,
          "spawn_count": 54,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100188"
        },
        {
          "zone": "Verteron",
          "area": "Southern Tolbas Forest",
          "monster": "Tolbas Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink",
          "monster_level": 25,
          "spawn_count": 44,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100165"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Left Wing and Archipelago of Siel's Wings - Siel's Right Wing",
          "monster": "Abyss Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink",
          "monster_level": 47,
          "spawn_count": 38,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600048"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Coastal Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink",
          "monster_level": 49,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400819"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink",
          "monster_level": 49,
          "spawn_count": 24,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101097"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slink"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/slink",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600448"
    },
    {
      "id": 1017,
      "name": "Krall Warshaman",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Drana Processing Area",
          "monster": "Modified Krall Healer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warshaman",
          "monster_level": 41,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100855"
        },
        {
          "zone": "Verteron",
          "area": "Verteron Fortress Ruins",
          "monster": "Krall Warshaman",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warshaman",
          "monster_level": 21,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100074"
        },
        {
          "zone": "Verteron",
          "area": "Krall Command Post",
          "monster": "Krall Warshaman",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warshaman",
          "monster_level": 21,
          "spawn_count": 2,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100074"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warshaman"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warshaman"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warshaman"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warshaman"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warshaman",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100855"
    },
    {
      "id": 1018,
      "name": "Varg Berserker",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Varg Berserker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/varg-berserker",
          "monster_level": 53,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600580"
        },
        {
          "zone": "Altgard",
          "area": "Black Claw Village",
          "monster": "Chief's Bodyguard",
          "source_url": "https://metabot.gg/en/aion-2/mounts/varg-berserker",
          "monster_level": 42,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400609"
        },
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Varg Berserker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/varg-berserker",
          "monster_level": 32,
          "spawn_count": 21,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400385"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/varg-berserker"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/varg-berserker"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/varg-berserker"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/varg-berserker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/varg-berserker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600580"
    },
    {
      "id": 1021,
      "name": "Aberrant Odyle Spider",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-odyle-spider"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-odyle-spider"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-odyle-spider"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-odyle-spider"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-odyle-spider",
      "id_mapping_verified": true
    },
    {
      "id": 1022,
      "name": "Crasaur",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Crasaur",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur",
          "monster_level": 49,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101083"
        },
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Sensitive Crasaur",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur",
          "monster_level": 29,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400327"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Crasaur",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur",
          "monster_level": 49,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400809"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Aquascale Crasaur",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur",
          "monster_level": 18,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100215"
        },
        {
          "zone": "Verteron",
          "area": "Altamia Canyon",
          "monster": "Docile Crasaur",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur",
          "monster_level": 33,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100608"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/crasaur",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101083"
    },
    {
      "id": 1025,
      "name": "Mutated Aberrant Odyle Spider",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Contaminated Marsh",
          "monster": "Marsh Odyle Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider",
          "monster_level": 15,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100030"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Ashen Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider",
          "monster_level": 48,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400744"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Altamia Highland",
          "monster": "Highland Odyle Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider",
          "monster_level": 35,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100745"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Garden Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider",
          "monster_level": 44,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100663"
        },
        {
          "zone": "Verteron",
          "area": "Pilgrim's Rest",
          "monster": "Garden Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider",
          "monster_level": 44,
          "spawn_count": 1,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100663"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-aberrant-odyle-spider",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100030"
    },
    {
      "id": 1026,
      "name": "Krall Warrior",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Scarlet Forest",
          "monster": "Modified Krall Warrior",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior",
          "monster_level": 41,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100910"
        },
        {
          "zone": "Verteron",
          "area": "Nahid Brigade Fortress",
          "monster": "Krall Test Subject",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior",
          "monster_level": 43,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101005"
        },
        {
          "zone": "Verteron",
          "area": "Verteron Fortress Ruins",
          "monster": "Krall Assault Trooper",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior",
          "monster_level": 21,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100073"
        },
        {
          "zone": "Verteron",
          "area": "Krall Command Post",
          "monster": "Krall Assault Trooper",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior",
          "monster_level": 21,
          "spawn_count": 2,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100073"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/krall-warrior",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100910"
    },
    {
      "id": 1027,
      "name": "Withered Agrint",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Thin Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint",
          "monster_level": 44,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100652"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Branding Island",
          "monster": "Withered Sulfur Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint",
          "monster_level": 46,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600026"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Sulfur Swamp",
          "monster": "Withered Sulfur Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint",
          "monster_level": 46,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600026"
        },
        {
          "zone": "Verteron",
          "area": "Altamia Canyon",
          "monster": "Withered Canyon Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint",
          "monster_level": 33,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100612"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/withered-agrint",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100652"
    },
    {
      "id": 1028,
      "name": "Krao Mutant",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-mutant"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-mutant"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-mutant"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-mutant"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/krao-mutant",
      "id_mapping_verified": true
    },
    {
      "id": 1029,
      "name": "Klaw Scout",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Steel Titan's Grave",
          "monster": "Abyss Klaw",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout",
          "monster_level": 53,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600402"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Eroded Fragment Area",
          "monster": "Abyss Klaw",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout",
          "monster_level": 53,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600402"
        },
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Consumed Klaw",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout",
          "monster_level": 30,
          "spawn_count": 36,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400313"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Devastated Remnants - Dusk Battlefield and Devastated Remnants - Exile Island",
          "monster": "Abyss Klaw",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout",
          "monster_level": 45,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600002"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Black Fragments Area - Kration Conflict Zone",
          "monster": "Abyss Aberrant Klaw",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout",
          "monster_level": 45,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600012"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Black Fragments Area - Abandoned Island",
          "monster": "Abyss Aberrant Klaw",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout",
          "monster_level": 45,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600012"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/klaw-scout",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600402"
    },
    {
      "id": 1030,
      "name": "Nagarant Guardian Warrior",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Nagarant Brawler",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nagarant-guardian-warrior",
          "monster_level": 54,
          "spawn_count": 72,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600537"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Sulfur Swamp",
          "monster": "Abyss Nagarant Brawler",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nagarant-guardian-warrior",
          "monster_level": 48,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600036"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - River of Rotten Sap",
          "monster": "Abyss Nagarant Warrior",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nagarant-guardian-warrior",
          "monster_level": 48,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600041"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nagarant-guardian-warrior"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nagarant-guardian-warrior"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nagarant-guardian-warrior"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nagarant-guardian-warrior"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/nagarant-guardian-warrior",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600537"
    },
    {
      "id": 1031,
      "name": "Konutin Worker",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Northern Tolbas Forest",
          "monster": "Tolbas Konutin Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/konutin-worker",
          "monster_level": 24,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100157"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/konutin-worker"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/konutin-worker"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/konutin-worker"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/konutin-worker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/konutin-worker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100157"
    },
    {
      "id": 1032,
      "name": "Elite Keneire",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-keneire"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-keneire"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-keneire"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-keneire"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-keneire",
      "id_mapping_verified": true
    },
    {
      "id": 1033,
      "name": "Elite Manduri Fighter",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Wandering Manduri Fighter",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-manduri-fighter",
          "monster_level": 27,
          "spawn_count": 38,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100557"
        },
        {
          "zone": "Altgard",
          "area": "Black Claw Village",
          "monster": "Black Claw Manduri Fighter",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-manduri-fighter",
          "monster_level": 41,
          "spawn_count": 37,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400605"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-manduri-fighter"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-manduri-fighter"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-manduri-fighter"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-manduri-fighter"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-manduri-fighter",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100557"
    },
    {
      "id": 1034,
      "name": "Giant Sparkie",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Aullaeu Village and Forest of Exiles",
          "monster": "Aullaeu Forest Giant Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie",
          "monster_level": 27,
          "spawn_count": 77,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100987"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Cantas Valley",
          "monster": "Splendent Hill Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie",
          "monster_level": 13,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100015"
        },
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Withered Branch Odyle Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie",
          "monster_level": 30,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400341"
        },
        {
          "zone": "Verteron",
          "area": "Southern Altamia Highland",
          "monster": "Highland Giant Odyle Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie",
          "monster_level": 33,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100796"
        },
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Fafnite Luminous Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie",
          "monster_level": 35,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400466"
        },
        {
          "zone": "Verteron",
          "area": "Aullaeu Village",
          "monster": "Highland Giant Sparkie",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie",
          "monster_level": 30,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100993"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/giant-sparkie",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100987"
    },
    {
      "id": 1035,
      "name": "Skama",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Contaminated Marsh",
          "monster": "Foul Skama",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skama",
          "monster_level": 14,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100031"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Lake Skama",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skama",
          "monster_level": 18,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100376"
        },
        {
          "zone": "Verteron",
          "area": "Scarlet Forest",
          "monster": "Drana Mutated Skama",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skama",
          "monster_level": 41,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100907"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skama"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skama"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skama"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/skama"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/skama",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100031"
    },
    {
      "id": 1036,
      "name": "Lupyllini",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eastern Altamia Highland",
          "monster": "Tail Feather Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lupyllini",
          "monster_level": 34,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100746"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Tail Feather Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lupyllini",
          "monster_level": 34,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100746"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lupyllini"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lupyllini"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lupyllini"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lupyllini"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/lupyllini",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100746"
    },
    {
      "id": 1037,
      "name": "Male Crestlich",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Ellun River Crestlich Male",
          "source_url": "https://metabot.gg/en/aion-2/mounts/male-crestlich",
          "monster_level": 18,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100151"
        },
        {
          "zone": "Verteron",
          "area": "Southern Altamia Highland",
          "monster": "Highland Crestlich Male",
          "source_url": "https://metabot.gg/en/aion-2/mounts/male-crestlich",
          "monster_level": 33,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100750"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/male-crestlich"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/male-crestlich"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/male-crestlich"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/male-crestlich"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/male-crestlich",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100151"
    },
    {
      "id": 1038,
      "name": "Airon",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland",
          "monster": "Baby Canyon Airon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
          "monster_level": 40,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400568"
        },
        {
          "zone": "Altgard",
          "area": "Mahindel River",
          "monster": "Baby Canyon Airon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
          "monster_level": 40,
          "spawn_count": 1,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400568"
        },
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland",
          "monster": "Canyon Airon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
          "monster_level": 40,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400567"
        },
        {
          "zone": "Altgard",
          "area": "Mahindel River",
          "monster": "Canyon Airon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
          "monster_level": 40,
          "spawn_count": 3,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400567"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Pointbeak Airon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
          "monster_level": 18,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100216"
        },
        {
          "zone": "Verteron",
          "area": "Western Altamia Highland",
          "monster": "Longbeak Highland Airon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
          "monster_level": 34,
          "spawn_count": 7,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100741"
        },
        {
          "zone": "Verteron",
          "area": "Altamia Canyon",
          "monster": "Hardbeak Airon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
          "monster_level": 33,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100609"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Smallbeak Airon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
          "monster_level": 18,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100144"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/airon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/airon",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400568"
    },
    {
      "id": 1039,
      "name": "Crestlich",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Western Cantas Valley",
          "monster": "Stonebeak Crestlich",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crestlich",
          "monster_level": 11,
          "spawn_count": 53,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100037"
        },
        {
          "zone": "Verteron",
          "area": "Southern Altamia Highland",
          "monster": "Highland Crestlich Female",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crestlich",
          "monster_level": 33,
          "spawn_count": 41,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100799"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Ellun River Crestlich Female",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crestlich",
          "monster_level": 18,
          "spawn_count": 35,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100150"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crestlich"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crestlich"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crestlich"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/crestlich"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/crestlich",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100037"
    },
    {
      "id": 1040,
      "name": "Aullaeu Shaman",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Aullaeu Village",
          "monster": "Aullaeu Apprentice Shaman",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aullaeu-shaman",
          "monster_level": 27,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100950"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aullaeu-shaman"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aullaeu-shaman"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aullaeu-shaman"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aullaeu-shaman"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aullaeu-shaman",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100950"
    },
    {
      "id": 1041,
      "name": "Cave Bat",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Scarlet Forest",
          "monster": "Drana Mutated Bat",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cave-bat",
          "monster_level": 41,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100911"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cave-bat"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cave-bat"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cave-bat"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cave-bat"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/cave-bat",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100911"
    },
    {
      "id": 1042,
      "name": "Ursus",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Southern Tolbas Forest",
          "monster": "Hardhorn Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
          "monster_level": 25,
          "spawn_count": 48,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100172"
        },
        {
          "zone": "Verteron",
          "area": "Night Dew Cave",
          "monster": "Hardhorn Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
          "monster_level": 25,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100172"
        },
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Hill Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
          "monster_level": 39,
          "spawn_count": 50,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100817"
        },
        {
          "zone": "Altgard",
          "area": "Silent Hill",
          "monster": "Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
          "monster_level": 17,
          "spawn_count": 24,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400916"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Confused Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
          "monster_level": 45,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100655"
        },
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Ridge Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
          "monster_level": 27,
          "spawn_count": 12,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100552"
        },
        {
          "zone": "Altgard",
          "area": "Battlescar Mound",
          "monster": "Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
          "monster_level": 32,
          "spawn_count": 12,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400376"
        },
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Ridge Violent Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
          "monster_level": 27,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100560"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ursus"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ursus",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100172"
    },
    {
      "id": 1043,
      "name": "Elite Ursus",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-ursus"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-ursus"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-ursus"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-ursus"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-ursus",
      "id_mapping_verified": true
    },
    {
      "id": 1044,
      "name": "Aultross's Doppelganger",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aultrosss-doppelganger"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aultrosss-doppelganger"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aultrosss-doppelganger"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aultrosss-doppelganger"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aultrosss-doppelganger",
      "id_mapping_verified": true
    },
    {
      "id": 1045,
      "name": "Sylphen",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eastern Altamia Highland and Western Altamia Highland",
          "monster": "Highland Sylphen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
          "monster_level": 32,
          "spawn_count": 71,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100743"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream and Dundu's Rest",
          "monster": "Ellun River Sylphen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
          "monster_level": 18,
          "spawn_count": 68,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100219"
        },
        {
          "zone": "Altgard",
          "area": "Battlescar Mound",
          "monster": "Sylphen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
          "monster_level": 32,
          "spawn_count": 39,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400362"
        },
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Ridge Sylphen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
          "monster_level": 27,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100565"
        },
        {
          "zone": "Verteron",
          "area": "Deserter Encampment",
          "monster": "Ridge Sylphen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
          "monster_level": 27,
          "spawn_count": 2,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100565"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Tolbas Forest",
          "monster": "Aberrant Sylphen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
          "monster_level": 26,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100472"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Marsh and Ellun River Marsh",
          "monster": "Ellun River Sylphen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
          "monster_level": 14,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100023"
        },
        {
          "zone": "Verteron",
          "area": "Western Cantas Valley",
          "monster": "Highland Sylphen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
          "monster_level": 13,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100004"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/sylphen",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100743"
    },
    {
      "id": 1046,
      "name": "Armadon",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Dredgion Crash Site",
          "monster": "Red Shell Mole",
          "source_url": "https://metabot.gg/en/aion-2/mounts/armadon",
          "monster_level": 10,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400002"
        },
        {
          "zone": "Altgard",
          "area": "Moslan Forest",
          "monster": "Withered Armadon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/armadon",
          "monster_level": 21,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400249"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/armadon"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/armadon"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/armadon"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/armadon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/armadon",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400002"
    },
    {
      "id": 1047,
      "name": "Aberrant Armadon",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eastern Cantas Valley",
          "monster": "Splendent Armadon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-armadon",
          "monster_level": 12,
          "spawn_count": 62,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100453"
        },
        {
          "zone": "Verteron",
          "area": "Southern Altamia Highland",
          "monster": "Highland Wild Armadon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-armadon",
          "monster_level": 33,
          "spawn_count": 38,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100751"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-armadon"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-armadon"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-armadon"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-armadon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-armadon",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100453"
    },
    {
      "id": 1048,
      "name": "Forest Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Forest Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit",
          "monster_level": 26,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400337"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Marsh",
          "monster": "Marsh Vine Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit",
          "monster_level": 13,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100022"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Contaminated Vine Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit",
          "monster_level": 18,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100142"
        },
        {
          "zone": "Verteron",
          "area": "Altamia Canyon",
          "monster": "Deep Canyon Forest Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit",
          "monster_level": 33,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100611"
        },
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Ridge Forest Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit",
          "monster_level": 27,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100555"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/forest-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400337"
    },
    {
      "id": 1049,
      "name": "Mutated Forest Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Contaminated Vine Bundle",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-spirit",
          "monster_level": 37,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100715"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Mutated Vine Bundle",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-spirit",
          "monster_level": 36,
          "spawn_count": 29,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100711"
        },
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery",
          "monster": "Condensed Specter",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-spirit",
          "monster_level": 14,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400061"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100715"
    },
    {
      "id": 1050,
      "name": "Gravi",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Pink Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gravi",
          "monster_level": 28,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400307"
        },
        {
          "zone": "Verteron",
          "area": "Northern Tolbas Forest",
          "monster": "Tolbas Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gravi",
          "monster_level": 24,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101125"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Red Stalk Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gravi",
          "monster_level": 44,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100650"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gravi"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gravi"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gravi"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gravi"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/gravi",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400307"
    },
    {
      "id": 1051,
      "name": "Magic Gravi",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Purifying Forest Magic Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi",
          "monster_level": 29,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400329"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi",
          "monster_level": 46,
          "spawn_count": 21,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400731"
        },
        {
          "zone": "Verteron",
          "area": "Northern Tolbas Forest",
          "monster": "Tolbas Magic Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi",
          "monster_level": 24,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101126"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Illusion Magic Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi",
          "monster_level": 44,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100659"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/magic-gravi",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400329"
    },
    {
      "id": 1052,
      "name": "Large Leaf Gravi",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Large Leaf Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/large-leaf-gravi",
          "monster_level": 30,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400342"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Ellun River Hill Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/large-leaf-gravi",
          "monster_level": 18,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100285"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Large Leaf Gravi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/large-leaf-gravi",
          "monster_level": 44,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100651"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/large-leaf-gravi"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/large-leaf-gravi"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/large-leaf-gravi"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/large-leaf-gravi"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/large-leaf-gravi",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400342"
    },
    {
      "id": 1053,
      "name": "Aberrant Potcrab",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Scarlet Forest",
          "monster": "Drana Mutated Potcrab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-potcrab",
          "monster_level": 41,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100908"
        },
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Eternal Moss Crab",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-potcrab",
          "monster_level": 46,
          "spawn_count": 7,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110512"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-potcrab"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-potcrab"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-potcrab"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-potcrab"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-potcrab",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100908"
    },
    {
      "id": 1054,
      "name": "Mumu Warrior",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Black Claw Village",
          "monster": "Mumu Watcher",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-warrior",
          "monster_level": 41,
          "spawn_count": 67,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400606"
        },
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Mumu Watcher",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-warrior",
          "monster_level": 32,
          "spawn_count": 61,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400350"
        },
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland",
          "monster": "Gribade Mumu Warrior",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-warrior",
          "monster_level": 40,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400570"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-warrior"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-warrior"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-warrior"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-warrior"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-warrior",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400606"
    },
    {
      "id": 1055,
      "name": "Grave Rat",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/grave-rat"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/grave-rat"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/grave-rat"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/grave-rat"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/grave-rat",
      "id_mapping_verified": true
    },
    {
      "id": 1056,
      "name": "Drakan Probe",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Drana Processing Area",
          "monster": "Drana Processing Maintenance Machine",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe",
          "monster_level": 41,
          "spawn_count": 31,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100866"
        },
        {
          "zone": "Altgard",
          "area": "Sanctum Outpost",
          "monster": "Outpost Probe",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe",
          "monster_level": 19,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400143"
        },
        {
          "zone": "Altgard",
          "area": "Tranein Pond",
          "monster": "Drakan Probe",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe",
          "monster_level": 20,
          "spawn_count": 13,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400162"
        },
        {
          "zone": "Altgard",
          "area": "Tranein Highland",
          "monster": "Drakan Probe",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe",
          "monster_level": 20,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400162"
        },
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Drana Processing Maintenance Machine",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe",
          "monster_level": 32,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400382"
        },
        {
          "zone": "Verteron",
          "area": "Nahid Brigade Fortress",
          "monster": "Intruder Seeker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe",
          "monster_level": 45,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101014"
        },
        {
          "zone": "Altgard",
          "area": "Lagta Fortress",
          "monster": "Lagta Brigade Seeker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe",
          "monster_level": 43,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400658"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-probe",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100866"
    },
    {
      "id": 1057,
      "name": "Coradon",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/coradon"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/coradon"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/coradon"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/coradon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/coradon",
      "id_mapping_verified": true
    },
    {
      "id": 1058,
      "name": "Black Smoke Murute",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-smoke-murute"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-smoke-murute"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-smoke-murute"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-smoke-murute"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/black-smoke-murute",
      "id_mapping_verified": true
    },
    {
      "id": 1059,
      "name": "Giant Bee",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Giant Stripe Bee",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-bee",
          "monster_level": 27,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100551"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-bee"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-bee"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-bee"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/giant-bee"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/giant-bee",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100551"
    },
    {
      "id": 1060,
      "name": "Starturtle",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Pond Starturtle",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle",
          "monster_level": 39,
          "spawn_count": 33,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100808"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Marsh and Collapsed Verteron Barrier Tower",
          "monster": "Coastal Starturtle",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle",
          "monster_level": 14,
          "spawn_count": 29,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100033"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Starturtle",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle",
          "monster_level": 49,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101082"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Starturtle",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle",
          "monster_level": 49,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400808"
        },
        {
          "zone": "Altgard",
          "area": "Western Gribade Highland",
          "monster": "Starturtle",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle",
          "monster_level": 37,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400519"
        },
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Beach Starturtle",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle",
          "monster_level": 32,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400374"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/starturtle",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100808"
    },
    {
      "id": 1061,
      "name": "Slime",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Unruly Slime",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slime",
          "monster_level": 29,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400320"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slime"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slime"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slime"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/slime"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/slime",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400320"
    },
    {
      "id": 1062,
      "name": "Contaminated Slime",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Sulfur Slime",
          "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime",
          "monster_level": 50,
          "spawn_count": 80,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600423"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Branding Island, Sulfur Tree Island - River of Rotten Sap, and Sulfur Tree Island - Sulfur Swamp",
          "monster": "Abyss Sulfur Slime",
          "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime",
          "monster_level": 46,
          "spawn_count": 69,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600023"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Marsh",
          "monster": "Marsh Slime",
          "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime",
          "monster_level": 13,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100025"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Contaminated Poison Slime",
          "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime",
          "monster_level": 36,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100717"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/contaminated-slime",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600423"
    },
    {
      "id": 1063,
      "name": "Vigilant Oculazen",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Vigilant Oculazen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vigilant-oculazen",
          "monster_level": 32,
          "spawn_count": 19,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400364"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vigilant-oculazen"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vigilant-oculazen"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vigilant-oculazen"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vigilant-oculazen"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/vigilant-oculazen",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400364"
    },
    {
      "id": 1064,
      "name": "Oculazen",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Drana Cultivation Area",
          "monster": "Labor Manager Oculazen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/oculazen",
          "monster_level": 40,
          "spawn_count": 45,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100854"
        },
        {
          "zone": "Verteron",
          "area": "Drana Processing Area",
          "monster": "Labor Manager Oculazen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/oculazen",
          "monster_level": 40,
          "spawn_count": 2,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100854"
        },
        {
          "zone": "Altgard",
          "area": "Impetusium Square",
          "monster": "Oculazen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/oculazen",
          "monster_level": 44,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400711"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/oculazen"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/oculazen"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/oculazen"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/oculazen"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/oculazen",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100854"
    },
    {
      "id": 1065,
      "name": "Biruta",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eastern Tolbas Forest",
          "monster": "Biruta Wanderer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta",
          "monster_level": 26,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100183"
        },
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery",
          "monster": "Biruta Wanderer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta",
          "monster_level": 17,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400920"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/biruta",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100183"
    },
    {
      "id": 1066,
      "name": "Papis",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Tranein Highland, Sanctum Outpost, and Tranein Pond",
          "monster": "Faded Papis",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
          "monster_level": 19,
          "spawn_count": 98,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000929"
        },
        {
          "zone": "Altgard",
          "area": "Southern Gribade Highland and Western Gribade Highland",
          "monster": "Faded Papis",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
          "monster_level": 40,
          "spawn_count": 56,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400594"
        },
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland and Amunta's Hideout",
          "monster": "Faded Papis",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
          "monster_level": 40,
          "spawn_count": 33,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400594"
        },
        {
          "zone": "Verteron",
          "area": "Western Cantas Valley and Eastern Cantas Valley",
          "monster": "Gentle Papis",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
          "monster_level": 10,
          "spawn_count": 85,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100009"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream, Miros Post, and Anguish Hill",
          "monster": "Ellun River Papis",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
          "monster_level": 18,
          "spawn_count": 78,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100220"
        },
        {
          "zone": "Altgard",
          "area": "Safe Haven and Nameless Cemetery",
          "monster": "Faded Papis",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
          "monster_level": 11,
          "spawn_count": 74,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400903"
        },
        {
          "zone": "Altgard",
          "area": "Silent Hill, Nameless Cemetery, and Sanctum Outpost",
          "monster": "Faded Papis",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
          "monster_level": 17,
          "spawn_count": 41,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000926"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Garden Papis",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
          "monster_level": 44,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100654"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/papis"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/papis",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000929"
    },
    {
      "id": 1067,
      "name": "Scorpion",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Contaminated Scorpion",
          "source_url": "https://metabot.gg/en/aion-2/mounts/scorpion",
          "monster_level": 36,
          "spawn_count": 46,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100709"
        },
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Ore Scorpion",
          "source_url": "https://metabot.gg/en/aion-2/mounts/scorpion",
          "monster_level": 35,
          "spawn_count": 19,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400470"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/scorpion"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/scorpion"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/scorpion"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/scorpion"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/scorpion",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100709"
    },
    {
      "id": 1068,
      "name": "Krao Test Subject",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-test-subject"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-test-subject"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-test-subject"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-test-subject"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/krao-test-subject",
      "id_mapping_verified": true
    },
    {
      "id": 1069,
      "name": "Stone Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Hill Stone Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/stone-spirit",
          "monster_level": 40,
          "spawn_count": 38,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100812"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Grave of Steel",
          "monster": "Abyss Rock Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/stone-spirit",
          "monster_level": 48,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600056"
        },
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Faded Stone Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/stone-spirit",
          "monster_level": 26,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400301"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/stone-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/stone-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/stone-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/stone-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/stone-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100812"
    },
    {
      "id": 1071,
      "name": "Cadaver Insectoid",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Dredgion Crash Site",
          "monster": "Drana Cadaver Insectoid",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-insectoid",
          "monster_level": 12,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400018"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-insectoid"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-insectoid"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-insectoid"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-insectoid"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-insectoid",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400018"
    },
    {
      "id": 1072,
      "name": "Tog",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Silent Hill",
          "monster": "Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tog",
          "monster_level": 18,
          "spawn_count": 21,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400912"
        },
        {
          "zone": "Altgard",
          "area": "Sanctum Outpost",
          "monster": "Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tog",
          "monster_level": 18,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400912"
        },
        {
          "zone": "Altgard",
          "area": "Sanctum Outskirts Watch",
          "monster": "Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tog",
          "monster_level": 18,
          "spawn_count": 3,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400912"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tog"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tog"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tog"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tog"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/tog",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400912"
    },
    {
      "id": 1073,
      "name": "Nepenthes",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Left Wing",
          "monster": "Abyss Nasty Nepenthes",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes",
          "monster_level": 46,
          "spawn_count": 35,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600049"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Right Wing",
          "monster": "Abyss Nasty Nepenthes",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes",
          "monster_level": 46,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600049"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Abyss Nasty Nepenthes",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes",
          "monster_level": 51,
          "spawn_count": 67,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600449"
        },
        {
          "zone": "Verteron",
          "area": "Northern Tolbas Forest",
          "monster": "Tolbas Nepenthes",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes",
          "monster_level": 24,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100160"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Altamia Highland",
          "monster": "Scarlet Highland Nepenthes",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes",
          "monster_level": 35,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100744"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/nepenthes",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600049"
    },
    {
      "id": 1074,
      "name": "Kuru Worker",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Kuru Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker",
          "monster_level": 50,
          "spawn_count": 80,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101136"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Kuru Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker",
          "monster_level": 50,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400831"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Tolbas Forest",
          "monster": "Tolbas Kuru Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker",
          "monster_level": 26,
          "spawn_count": 45,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100180"
        },
        {
          "zone": "Verteron",
          "area": "Forest of Exiles",
          "monster": "Harsh Kuru Tinkerer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker",
          "monster_level": 28,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100964"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-worker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101136"
    },
    {
      "id": 1075,
      "name": "Kuru Tinkerer",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Kuru Tinkerer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-tinkerer",
          "monster_level": 50,
          "spawn_count": 83,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101137"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Tolbas Forest",
          "monster": "Tolbas Kuru Tinkerer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-tinkerer",
          "monster_level": 26,
          "spawn_count": 40,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100181"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Kuru Tinkerer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-tinkerer",
          "monster_level": 50,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400832"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-tinkerer"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-tinkerer"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-tinkerer"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-tinkerer"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-tinkerer",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101137"
    },
    {
      "id": 1077,
      "name": "Harcon",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/harcon"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/harcon"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/harcon"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/harcon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/harcon",
      "id_mapping_verified": true
    },
    {
      "id": 1078,
      "name": "Urugugu Brawler",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/urugugu-brawler"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/urugugu-brawler"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/urugugu-brawler"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/urugugu-brawler"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/urugugu-brawler",
      "id_mapping_verified": true
    },
    {
      "id": 1079,
      "name": "Ultimate Wind Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-wind-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-wind-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-wind-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-wind-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-wind-spirit",
      "id_mapping_verified": true
    },
    {
      "id": 1080,
      "name": "Sentinel K'nash",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sentinel-knash"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sentinel-knash"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sentinel-knash"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/sentinel-knash"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/sentinel-knash",
      "id_mapping_verified": true
    },
    {
      "id": 1081,
      "name": "Dionae",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dionae"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dionae"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dionae"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dionae"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/dionae",
      "id_mapping_verified": true
    },
    {
      "id": 1082,
      "name": "Ultimate Fire Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-fire-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-fire-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-fire-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-fire-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-fire-spirit",
      "id_mapping_verified": true
    },
    {
      "id": 1083,
      "name": "Spider",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Left Wing and Archipelago of Siel's Wings - Siel's Right Wing",
          "monster": "Abyss Odyle Mutated Insectoid",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spider",
          "monster_level": 46,
          "spawn_count": 105,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600046"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Abyss Odyle Mutated Insectoid",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spider",
          "monster_level": 50,
          "spawn_count": 80,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600446"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spider"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spider"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spider"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spider"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/spider",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600046"
    },
    {
      "id": 1084,
      "name": "Kalgolem",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Western Cantas Valley",
          "monster": "Hard Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem",
          "monster_level": 10,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100002"
        },
        {
          "zone": "Verteron",
          "area": "Destroyed Temple Site",
          "monster": "Ashen Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem",
          "monster_level": 34,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100700"
        },
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Angry Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem",
          "monster_level": 29,
          "spawn_count": 27,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400328"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Reshanta's Root",
          "monster": "Root Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem",
          "monster_level": 48,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600070"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Corroded Heart",
          "monster": "Abyss Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem",
          "monster_level": 53,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600470"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kalgolem",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100002"
    },
    {
      "id": 1086,
      "name": "Fungen",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eastern Cantas Valley",
          "monster": "Red Cap Fungen",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungen",
          "monster_level": 12,
          "spawn_count": 56,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100456"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungen"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungen"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungen"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/fungen"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/fungen",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100456"
    },
    {
      "id": 1087,
      "name": "Pino",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Aullaeu Village",
          "monster": "Pino Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino",
          "monster_level": 27,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100953"
        },
        {
          "zone": "Verteron",
          "area": "Aullaeu Village",
          "monster": "Pino Laborer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino",
          "monster_level": 27,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100954"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/pino",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100953"
    },
    {
      "id": 1088,
      "name": "Pino Worker",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Aullaeu Village",
          "monster": "Harsh Pino Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino-worker",
          "monster_level": 28,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100955"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino-worker"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino-worker"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino-worker"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pino-worker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/pino-worker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100955"
    },
    {
      "id": 1089,
      "name": "Aberrant Skama",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Sulfur Skama",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-skama",
          "monster_level": 51,
          "spawn_count": 132,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600424"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - River of Rotten Sap and Sulfur Tree Island - Branding Island",
          "monster": "Abyss Sulfur Skama",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-skama",
          "monster_level": 46,
          "spawn_count": 37,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600024"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Yellow-Tailed Skama",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-skama",
          "monster_level": 36,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100710"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-skama"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-skama"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-skama"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-skama"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-skama",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600424"
    },
    {
      "id": 1090,
      "name": "Ultimate Water Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-water-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-water-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-water-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-water-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-water-spirit",
      "id_mapping_verified": true
    },
    {
      "id": 1091,
      "name": "Red Spark Ignus",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/red-spark-ignus"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/red-spark-ignus"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/red-spark-ignus"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/red-spark-ignus"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/red-spark-ignus",
      "id_mapping_verified": true
    },
    {
      "id": 1092,
      "name": "Lesser Wind Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Soft Breeze Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-wind-spirit",
          "monster_level": 26,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400324"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Wind Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-wind-spirit",
          "monster_level": 51,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101096"
        },
        {
          "zone": "Verteron",
          "area": "Altamia Canyon",
          "monster": "Air Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-wind-spirit",
          "monster_level": 33,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100605"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-wind-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-wind-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-wind-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-wind-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-wind-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400324"
    },
    {
      "id": 1093,
      "name": "Phantasmal Lakshmi",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/phantasmal-lakshmi"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/phantasmal-lakshmi"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/phantasmal-lakshmi"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/phantasmal-lakshmi"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/phantasmal-lakshmi",
      "id_mapping_verified": true
    },
    {
      "id": 1094,
      "name": "Intermediate Wind Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Wandering Wind Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-wind-spirit",
          "monster_level": 44,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100658"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Immortal Wind Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-wind-spirit",
          "monster_level": 51,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400824"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-wind-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-wind-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-wind-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-wind-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-wind-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100658"
    },
    {
      "id": 1095,
      "name": "Superior Wind Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Whirlwind Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-wind-spirit",
          "monster_level": 26,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400302"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Immortal Wind Spirit Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-wind-spirit",
          "monster_level": 51,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400818"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Brisk Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-wind-spirit",
          "monster_level": 45,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100666"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-wind-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-wind-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-wind-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-wind-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/superior-wind-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400302"
    },
    {
      "id": 1096,
      "name": "Superior Fire Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Flame Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit",
          "monster_level": 27,
          "spawn_count": 45,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400303"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Superior Fire Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit",
          "monster_level": 48,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400749"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Hellfire Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit",
          "monster_level": 45,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100664"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Immortal Fire Spirit Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit",
          "monster_level": 51,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400815"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/superior-fire-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400303"
    },
    {
      "id": 1097,
      "name": "Karnif",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Tamed Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif",
          "monster_level": 40,
          "spawn_count": 83,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100802"
        },
        {
          "zone": "Verteron",
          "area": "Western Altamia Highland and Rock Tomb Hill",
          "monster": "Toughmane Highland Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif",
          "monster_level": 32,
          "spawn_count": 61,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100742"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Altamia Highland",
          "monster": "Highland Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif",
          "monster_level": 34,
          "spawn_count": 46,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100752"
        },
        {
          "zone": "Verteron",
          "area": "Northern Tolbas Forest",
          "monster": "Ferocious Tolbas Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif",
          "monster_level": 24,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100349"
        },
        {
          "zone": "Verteron",
          "area": "Northern Tolbas Forest",
          "monster": "Tolbas Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif",
          "monster_level": 24,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100348"
        },
        {
          "zone": "Verteron",
          "area": "Southern Tolbas Forest",
          "monster": "Ferocious Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif",
          "monster_level": 25,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100174"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/karnif"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/karnif",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100802"
    },
    {
      "id": 1098,
      "name": "Modified Karnif",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Steel Titan's Grave",
          "monster": "Abyss Search Party Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
          "monster_level": 53,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600404"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Eroded Fragment Area",
          "monster": "Abyss Search Party Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
          "monster_level": 53,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600404"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Devastated Remnants - Dusk Battlefield",
          "monster": "Abyss Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
          "monster_level": 46,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600004"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Devastated Remnants - Weathered Outcrop",
          "monster": "Abyss Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
          "monster_level": 46,
          "spawn_count": 12,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600004"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Devastated Remnants - Exile Island",
          "monster": "Abyss Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
          "monster_level": 46,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600004"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Black Fragments Area - Kration Conflict Zone, Black Fragments Area - Kibelium Fragment, and Black Fragments Area - Abandoned Island",
          "monster": "Abyss Search Party Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
          "monster_level": 46,
          "spawn_count": 42,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600014"
        },
        {
          "zone": "Verteron",
          "area": "Verteron Fortress Ruins",
          "monster": "Trained Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
          "monster_level": 20,
          "spawn_count": 12,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100130"
        },
        {
          "zone": "Verteron",
          "area": "Verteron Fortress Ruins",
          "monster": "Unruly Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
          "monster_level": 19,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100096"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/modified-karnif",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600404"
    },
    {
      "id": 1099,
      "name": "Elite Karnif",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-karnif"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-karnif"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-karnif"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-karnif"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-karnif",
      "id_mapping_verified": true
    },
    {
      "id": 1100,
      "name": "Ultimate Earth Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-earth-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-earth-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-earth-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-earth-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ultimate-earth-spirit",
      "id_mapping_verified": true
    },
    {
      "id": 1101,
      "name": "Forest Guardian",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Enraged Forest Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-guardian",
          "monster_level": 53,
          "spawn_count": 47,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600454"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Garden Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-guardian",
          "monster_level": 45,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100660"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-guardian"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-guardian"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-guardian"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-guardian"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/forest-guardian",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600454"
    },
    {
      "id": 1102,
      "name": "Dried Up Forest Guardian",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dried-up-forest-guardian"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dried-up-forest-guardian"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dried-up-forest-guardian"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dried-up-forest-guardian"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/dried-up-forest-guardian",
      "id_mapping_verified": true
    },
    {
      "id": 1103,
      "name": "Pretor Veil Administrator",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pretor-veil-administrator"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pretor-veil-administrator"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pretor-veil-administrator"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/pretor-veil-administrator"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/pretor-veil-administrator",
      "id_mapping_verified": true
    },
    {
      "id": 1104,
      "name": "Manduri Trebuchet Worker",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Black Claw Village and Kumrica's Cellar",
          "monster": "Black Claw Manduri Scout",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker",
          "monster_level": 41,
          "spawn_count": 62,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400615"
        },
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Hill Manduri",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker",
          "monster_level": 39,
          "spawn_count": 55,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100816"
        },
        {
          "zone": "Verteron",
          "area": "Romlon's Hideout",
          "monster": "Hill Manduri",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker",
          "monster_level": 39,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100816"
        },
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Manduri Slinger",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker",
          "monster_level": 48,
          "spawn_count": 46,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110507"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/manduri-trebuchet-worker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400615"
    },
    {
      "id": 1105,
      "name": "Biruta Herbalist",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery",
          "monster": "Biruta Herbalist",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta-herbalist",
          "monster_level": 17,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400919"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta-herbalist"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta-herbalist"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta-herbalist"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/biruta-herbalist"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/biruta-herbalist",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400919"
    },
    {
      "id": 1106,
      "name": "Tayga",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Black Claw Village",
          "monster": "Tamed Tayga",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tayga",
          "monster_level": 41,
          "spawn_count": 65,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400611"
        },
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland",
          "monster": "Search Party Tayga",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tayga",
          "monster_level": 40,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400564"
        },
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland",
          "monster": "Guard Troopers Tayga",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tayga",
          "monster_level": 40,
          "spawn_count": 24,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400583"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tayga"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tayga"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tayga"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tayga"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/tayga",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400611"
    },
    {
      "id": 1107,
      "name": "Krao Seal Guardian",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-seal-guardian"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-seal-guardian"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-seal-guardian"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/krao-seal-guardian"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/krao-seal-guardian",
      "id_mapping_verified": true
    },
    {
      "id": 1108,
      "name": "Enhanced Krall Combatant",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Verteron Fortress Ruins",
          "monster": "Enhanced Krall Combatant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-combatant",
          "monster_level": 22,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100097"
        },
        {
          "zone": "Verteron",
          "area": "Illusion Oratory",
          "monster": "Enhanced Krall Combatant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-combatant",
          "monster_level": 22,
          "spawn_count": 1,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100097"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-combatant"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-combatant"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-combatant"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-combatant"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-combatant",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100097"
    },
    {
      "id": 1109,
      "name": "Enhanced Krall Sentry",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Verteron Fortress Ruins",
          "monster": "Enhanced Krall Sentry",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-sentry",
          "monster_level": 22,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100072"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-sentry"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-sentry"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-sentry"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-sentry"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/enhanced-krall-sentry",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100072"
    },
    {
      "id": 1110,
      "name": "Blue Kalgolem",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Abyss Blue Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem",
          "monster_level": 52,
          "spawn_count": 89,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600451"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Left Wing",
          "monster": "Abyssal Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem",
          "monster_level": 47,
          "spawn_count": 31,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600051"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Grave of Steel",
          "monster": "Abyssal Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem",
          "monster_level": 47,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600051"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Right Wing",
          "monster": "Abyssal Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem",
          "monster_level": 47,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600051"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Cantas Valley",
          "monster": "Splendent Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem",
          "monster_level": 12,
          "spawn_count": 54,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100454"
        },
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Blue Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem",
          "monster_level": 36,
          "spawn_count": 24,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400471"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/blue-kalgolem",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600451"
    },
    {
      "id": 1111,
      "name": "Swift Lugi",
      "genus": "Special",
      "faction": "unknown",
      "locations": [],
      "bonuses": [],
      "source_url": "https://metabot.gg/en/aion-2/mounts/swift-lugi",
      "id_mapping_verified": true
    },
    {
      "id": 1112,
      "name": "Wandering Merchant Lugi",
      "genus": "Special",
      "faction": "unknown",
      "locations": [],
      "bonuses": [],
      "source_url": "https://metabot.gg/en/aion-2/mounts/wandering-merchant-lugi",
      "id_mapping_verified": true
    },
    {
      "id": 1114,
      "name": "Ashen Spider",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Moslan Forest",
          "monster": "Ashen Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-spider",
          "monster_level": 21,
          "spawn_count": 48,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400230"
        },
        {
          "zone": "Verteron",
          "area": "Anguish Hill",
          "monster": "White Shell Octaside",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-spider",
          "monster_level": 18,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100283"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-spider"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-spider"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-spider"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-spider"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-spider",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400230"
    },
    {
      "id": 1115,
      "name": "Kuru Overseer",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Kuru Overseer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-overseer",
          "monster_level": 50,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101139"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Kuru Overseer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-overseer",
          "monster_level": 50,
          "spawn_count": 12,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400833"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-overseer"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-overseer"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-overseer"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-overseer"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kuru-overseer",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101139"
    },
    {
      "id": 1116,
      "name": "Withered Branch Spider",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery and Crypt",
          "monster": "Withered Branch Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider",
          "monster_level": 13,
          "spawn_count": 67,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000956"
        },
        {
          "zone": "Altgard",
          "area": "Silent Hill, Calderon Canyon, and Tranein Highland",
          "monster": "Withered Branch Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider",
          "monster_level": 13,
          "spawn_count": 41,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000956"
        },
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins and Battlescar Mound",
          "monster": "Withered Branch Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider",
          "monster_level": 33,
          "spawn_count": 68,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400939"
        },
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Withered Branch Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider",
          "monster_level": 27,
          "spawn_count": 53,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400933"
        },
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery, Safe Haven, and Calderon Canyon",
          "monster": "Withered Branch Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider",
          "monster_level": 11,
          "spawn_count": 44,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000957"
        },
        {
          "zone": "Altgard",
          "area": "Southern Gribade Highland and Idun's Lake",
          "monster": "Withered Branch Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider",
          "monster_level": 40,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400948"
        },
        {
          "zone": "Altgard",
          "area": "Mahindel Cliff and Mahindel River",
          "monster": "Withered Branch Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider",
          "monster_level": 34,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400946"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/withered-branch-spider",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000956"
    },
    {
      "id": 1117,
      "name": "Unstable Spider",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Flame Rock Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider",
          "monster_level": 27,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400319"
        },
        {
          "zone": "Verteron",
          "area": "Forest of Exiles",
          "monster": "Aullaeu Forest Odyle Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider",
          "monster_level": 30,
          "spawn_count": 44,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101023"
        },
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider",
          "monster_level": 48,
          "spawn_count": 33,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110509"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Poison Blood Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider",
          "monster_level": 47,
          "spawn_count": 24,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400745"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Grave of Steel",
          "monster": "Abyss Red Mutated Insectoid",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider",
          "monster_level": 46,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600045"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/unstable-spider",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400319"
    },
    {
      "id": 1118,
      "name": "Aberrant Bee",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery, Silent Hill, and Calderon Canyon",
          "monster": "Black Armor Bee",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee",
          "monster_level": 13,
          "spawn_count": 85,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400900"
        },
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery and Silent Hill",
          "monster": "Black Armor Bee",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee",
          "monster_level": 17,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400930"
        },
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Stripe Bee",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee",
          "monster_level": 27,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100550"
        },
        {
          "zone": "Verteron",
          "area": "Pamos Farm",
          "monster": "Black Pattern Bee",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee",
          "monster_level": 18,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100286"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Black Pattern Bee",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee",
          "monster_level": 18,
          "spawn_count": 2,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100286"
        },
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins",
          "monster": "Black Armor Bee",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee",
          "monster_level": 33,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000955"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-bee",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400900"
    },
    {
      "id": 1119,
      "name": "Aberrant Coradon",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Hill Coradon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon",
          "monster_level": 39,
          "spawn_count": 123,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100821"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Garden Coradon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon",
          "monster_level": 44,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100699"
        },
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins",
          "monster": "Aberrant Coradon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon",
          "monster_level": 33,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000952"
        },
        {
          "zone": "Altgard",
          "area": "Flauke Legion Outpost",
          "monster": "Aberrant Coradon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon",
          "monster_level": 33,
          "spawn_count": 1,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000952"
        },
        {
          "zone": "Altgard",
          "area": "Tranein Highland",
          "monster": "Aberrant Coradon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon",
          "monster_level": 20,
          "spawn_count": 9,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400907"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-coradon",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100821"
    },
    {
      "id": 1120,
      "name": "Young Kailin",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Tranein Highland, Sanctum Outpost, and Tranein Pond",
          "monster": "Young Kailin",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin",
          "monster_level": 20,
          "spawn_count": 107,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400906"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Ellun River Young Kailin",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin",
          "monster_level": 18,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101022"
        },
        {
          "zone": "Altgard",
          "area": "Battlescar Mound and Purifying Forest",
          "monster": "Young Kailin",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin",
          "monster_level": 32,
          "spawn_count": 56,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400935"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Young Kailin",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin",
          "monster_level": 46,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400737"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/young-kailin",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400906"
    },
    {
      "id": 1121,
      "name": "Young Slink",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Young Wetland Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink",
          "monster_level": 18,
          "spawn_count": 52,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100189"
        },
        {
          "zone": "Altgard",
          "area": "Idun's Lake and Southern Gribade Highland",
          "monster": "Young Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink",
          "monster_level": 40,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400950"
        },
        {
          "zone": "Verteron",
          "area": "Southern Tolbas Forest",
          "monster": "Tolbas Young Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink",
          "monster_level": 23,
          "spawn_count": 24,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100473"
        },
        {
          "zone": "Altgard",
          "area": "Tranein Pond and Tranein Highland",
          "monster": "Young Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink",
          "monster_level": 20,
          "spawn_count": 12,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400910"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Left Wing",
          "monster": "Abyss Young Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink",
          "monster_level": 46,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600047"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Right Wing",
          "monster": "Abyss Young Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink",
          "monster_level": 46,
          "spawn_count": 2,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600047"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Abyss Young Slink",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink",
          "monster_level": 50,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600447"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/young-slink",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100189"
    },
    {
      "id": 1122,
      "name": "Young Tog",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-tog"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-tog"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-tog"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-tog"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/young-tog",
      "id_mapping_verified": true
    },
    {
      "id": 1123,
      "name": "Young Ursus",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Hill Young Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus",
          "monster_level": 39,
          "spawn_count": 50,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100818"
        },
        {
          "zone": "Altgard",
          "area": "Silent Hill",
          "monster": "Young Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus",
          "monster_level": 17,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400917"
        },
        {
          "zone": "Verteron",
          "area": "Southern Tolbas Forest",
          "monster": "Baby Horn Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus",
          "monster_level": 25,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100173"
        },
        {
          "zone": "Verteron",
          "area": "Night Dew Cave",
          "monster": "Baby Horn Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus",
          "monster_level": 25,
          "spawn_count": 2,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100173"
        },
        {
          "zone": "Altgard",
          "area": "Battlescar Mound",
          "monster": "Young Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus",
          "monster_level": 32,
          "spawn_count": 12,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400377"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/young-ursus",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100818"
    },
    {
      "id": 1124,
      "name": "Zaif",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Southern Altamia Highland",
          "monster": "Highland Zaif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zaif",
          "monster_level": 33,
          "spawn_count": 77,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100797"
        },
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Hill Zaif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zaif",
          "monster_level": 40,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100813"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Altamia Highland",
          "monster": "Highland Forest Zaif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zaif",
          "monster_level": 35,
          "spawn_count": 42,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100748"
        },
        {
          "zone": "Verteron",
          "area": "Rock Tomb Hill",
          "monster": "Rock Hill Zaif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zaif",
          "monster_level": 32,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100573"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zaif"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zaif"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zaif"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zaif"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/zaif",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100797"
    },
    {
      "id": 1125,
      "name": "Aberrant Zaif",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Yellow-Maned Zaif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-zaif",
          "monster_level": 27,
          "spawn_count": 27,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100558"
        },
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland",
          "monster": "Golden Zaif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-zaif",
          "monster_level": 40,
          "spawn_count": 19,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400578"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-zaif"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-zaif"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-zaif"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-zaif"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-zaif",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100558"
    },
    {
      "id": 1126,
      "name": "Aberrant Tog",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Hill Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog",
          "monster_level": 39,
          "spawn_count": 83,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100819"
        },
        {
          "zone": "Altgard",
          "area": "Battlescar Mound and Purifying Forest",
          "monster": "Aberrant Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog",
          "monster_level": 32,
          "spawn_count": 63,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400936"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Cantas Valley",
          "monster": "Cairn Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog",
          "monster_level": 13,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100006"
        },
        {
          "zone": "Verteron",
          "area": "Southern Altamia Highland",
          "monster": "Wild Stripe Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog",
          "monster_level": 33,
          "spawn_count": 47,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100793"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Field Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog",
          "monster_level": 18,
          "spawn_count": 46,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100288"
        },
        {
          "zone": "Verteron",
          "area": "Pamos Farm and Ellun River Midstream",
          "monster": "Hungry Tog",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog",
          "monster_level": 18,
          "spawn_count": 35,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100145"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/aberrant-tog",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100819"
    },
    {
      "id": 1127,
      "name": "Odyle Stone Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Faded Odyle Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/odyle-stone-spirit",
          "monster_level": 46,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400734"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/odyle-stone-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/odyle-stone-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/odyle-stone-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/odyle-stone-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/odyle-stone-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400734"
    },
    {
      "id": 1128,
      "name": "Drana Slime",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Dredgion Crash Site",
          "monster": "Drana Slime",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-slime",
          "monster_level": 11,
          "spawn_count": 21,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400015"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-slime"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-slime"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-slime"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-slime"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drana-slime",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400015"
    },
    {
      "id": 1129,
      "name": "Drana Swarm",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Drana Swarm",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-swarm",
          "monster_level": 46,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110501"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-swarm"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-swarm"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-swarm"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-swarm"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drana-swarm",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110501"
    },
    {
      "id": 1130,
      "name": "Mutated Cadaver Insectoid",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Ridge Spider",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-cadaver-insectoid",
          "monster_level": 27,
          "spawn_count": 35,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100554"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-cadaver-insectoid"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-cadaver-insectoid"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-cadaver-insectoid"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-cadaver-insectoid"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-cadaver-insectoid",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100554"
    },
    {
      "id": 1131,
      "name": "Drana Spore",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Mutated Spore",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-spore",
          "monster_level": 47,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110502"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-spore"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-spore"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-spore"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-spore"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drana-spore",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110502"
    },
    {
      "id": 1132,
      "name": "Ashen Lupyllini",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-lupyllini"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-lupyllini"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-lupyllini"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-lupyllini"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-lupyllini",
      "id_mapping_verified": true
    },
    {
      "id": 1133,
      "name": "Forest Dionae",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-dionae"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-dionae"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-dionae"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-dionae"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/forest-dionae",
      "id_mapping_verified": true
    },
    {
      "id": 1134,
      "name": "Eternal Coradon",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Southern Gribade Highland",
          "monster": "Eternal Coradon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/eternal-coradon",
          "monster_level": 40,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400941"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Right Wing",
          "monster": "Abyss Coradon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/eternal-coradon",
          "monster_level": 48,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600061"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Abyss Eternal Coradon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/eternal-coradon",
          "monster_level": 52,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600461"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/eternal-coradon"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/eternal-coradon"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/eternal-coradon"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/eternal-coradon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/eternal-coradon",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400941"
    },
    {
      "id": 1135,
      "name": "Ashen Dionae",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Moslan Forest",
          "monster": "Ashen Dionae",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-dionae",
          "monster_level": 21,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400248"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-dionae"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-dionae"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-dionae"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-dionae"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-dionae",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400248"
    },
    {
      "id": 1136,
      "name": "Rafflesia",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Rafflesia",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia",
          "monster_level": 49,
          "spawn_count": 48,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400813"
        },
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery",
          "monster": "Rafflesia",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia",
          "monster_level": 14,
          "spawn_count": 36,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400056"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Rafflesia",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia",
          "monster_level": 46,
          "spawn_count": 33,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400735"
        },
        {
          "zone": "Altgard",
          "area": "Sanctum Outpost",
          "monster": "Rafflesia",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia",
          "monster_level": 20,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000925"
        },
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Rafflesia",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia",
          "monster_level": 47,
          "spawn_count": 21,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110513"
        },
        {
          "zone": "Altgard",
          "area": "Southern Gribade Highland",
          "monster": "Rafflesia",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia",
          "monster_level": 40,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400949"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/rafflesia",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400813"
    },
    {
      "id": 1137,
      "name": "Mumu Worker",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Mumu Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-worker",
          "monster_level": 32,
          "spawn_count": 62,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400351"
        },
        {
          "zone": "Altgard",
          "area": "Battlescar Mound",
          "monster": "Escaped Mumu Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-worker",
          "monster_level": 33,
          "spawn_count": 33,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400390"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-worker"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-worker"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-worker"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-worker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-worker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400351"
    },
    {
      "id": 1138,
      "name": "Mumu Overseer",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-overseer"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-overseer"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-overseer"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-overseer"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mumu-overseer",
      "id_mapping_verified": true
    },
    {
      "id": 1139,
      "name": "Swamp Monster",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swamp-monster"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swamp-monster"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swamp-monster"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/swamp-monster"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/swamp-monster",
      "id_mapping_verified": true
    },
    {
      "id": 1140,
      "name": "Forest Monster",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Northern Tolbas Forest",
          "monster": "Tolbas Forest Targon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-monster",
          "monster_level": 24,
          "spawn_count": 19,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100350"
        },
        {
          "zone": "Altgard",
          "area": "Moslan Forest",
          "monster": "Burned Forester",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-monster",
          "monster_level": 21,
          "spawn_count": 12,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400225"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-monster"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-monster"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-monster"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/forest-monster"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/forest-monster",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100350"
    },
    {
      "id": 1141,
      "name": "Marsh Targon",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Ellun River Marsh",
          "monster": "Marsh Targon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/marsh-targon",
          "monster_level": 14,
          "spawn_count": 46,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100021"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Marsh",
          "monster": "Marsh Targon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/marsh-targon",
          "monster_level": 14,
          "spawn_count": 43,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100021"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Marsh Targon",
          "source_url": "https://metabot.gg/en/aion-2/mounts/marsh-targon",
          "monster_level": 52,
          "spawn_count": 75,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600502"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/marsh-targon"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/marsh-targon"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/marsh-targon"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/marsh-targon"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/marsh-targon",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100021"
    },
    {
      "id": 1142,
      "name": "Distorted Mutant",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Consumed Spirit Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/distorted-mutant",
          "monster_level": 30,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400312"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/distorted-mutant"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/distorted-mutant"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/distorted-mutant"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/distorted-mutant"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/distorted-mutant",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400312"
    },
    {
      "id": 1143,
      "name": "Mutated Ursus",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Moslan Forest",
          "monster": "Ashen Ursus",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-ursus",
          "monster_level": 21,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400217"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-ursus"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-ursus"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-ursus"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-ursus"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-ursus",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400217"
    },
    {
      "id": 1144,
      "name": "Mutated Forest Guardian",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Forest Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-guardian",
          "monster_level": 48,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400751"
        },
        {
          "zone": "Altgard",
          "area": "Moslan Forest",
          "monster": "Mutated Forest Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-guardian",
          "monster_level": 22,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400214"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-guardian"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-guardian"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-guardian"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-guardian"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-forest-guardian",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400751"
    },
    {
      "id": 1145,
      "name": "Mutated Insectoid Valka",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-insectoid-valka"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-insectoid-valka"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-insectoid-valka"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-insectoid-valka"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mutated-insectoid-valka",
      "id_mapping_verified": true
    },
    {
      "id": 1146,
      "name": "Gatekeeper Pinopi",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gatekeeper-pinopi"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gatekeeper-pinopi"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gatekeeper-pinopi"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/gatekeeper-pinopi"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/gatekeeper-pinopi",
      "id_mapping_verified": true
    },
    {
      "id": 1147,
      "name": "Dratona",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Sanctum Outpost",
          "monster": "Dratona Tinkerer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona",
          "monster_level": 19,
          "spawn_count": 67,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400116"
        },
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Dratona",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona",
          "monster_level": 32,
          "spawn_count": 38,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400380"
        },
        {
          "zone": "Verteron",
          "area": "Scarlet Forest",
          "monster": "Scarlet Forest Dratona",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona",
          "monster_level": 41,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100901"
        },
        {
          "zone": "Altgard",
          "area": "Tranein Pond",
          "monster": "Dratona Supporter",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona",
          "monster_level": 20,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400161"
        },
        {
          "zone": "Altgard",
          "area": "Tranein Highland",
          "monster": "Dratona Supporter",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona",
          "monster_level": 20,
          "spawn_count": 7,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400161"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/dratona",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400116"
    },
    {
      "id": 1148,
      "name": "Drakana Kalgolem",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Dredgion Crash Site",
          "monster": "Crash Site Kalgolem",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakana-kalgolem",
          "monster_level": 11,
          "spawn_count": 13,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400014"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakana-kalgolem"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakana-kalgolem"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakana-kalgolem"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakana-kalgolem"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drakana-kalgolem",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400014"
    },
    {
      "id": 1153,
      "name": "Drana Mutant Brute",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Drana Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant-brute",
          "monster_level": 50,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400834"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Drana Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant-brute",
          "monster_level": 50,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101135"
        },
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Drana Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant-brute",
          "monster_level": 47,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110503"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant-brute"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant-brute"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant-brute"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant-brute"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant-brute",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400834"
    },
    {
      "id": 1154,
      "name": "Faded Mutant Brute",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Giant Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant-brute",
          "monster_level": 53,
          "spawn_count": 69,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600432"
        },
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Faded Mutant Brute",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant-brute",
          "monster_level": 35,
          "spawn_count": 7,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400476"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant-brute"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant-brute"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant-brute"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant-brute"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant-brute",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600432"
    },
    {
      "id": 1155,
      "name": "Superior Water Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Water Mist Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit",
          "monster_level": 29,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400306"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Superior Water Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit",
          "monster_level": 46,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400739"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Immortal Water Spirit Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit",
          "monster_level": 51,
          "spawn_count": 7,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400816"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Torrent Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit",
          "monster_level": 45,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100665"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/superior-water-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400306"
    },
    {
      "id": 1156,
      "name": "Elite Klaw",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-klaw"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-klaw"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-klaw"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-klaw"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-klaw",
      "id_mapping_verified": true
    },
    {
      "id": 1157,
      "name": "Cadaver Cleaner",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins",
          "monster": "Ferocious Cadaver Cleaner",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-cleaner",
          "monster_level": 34,
          "spawn_count": 61,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400418"
        },
        {
          "zone": "Altgard",
          "area": "Uruthumheim",
          "monster": "Ruins Corpse Cleaner",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-cleaner",
          "monster_level": 24,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400275"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-cleaner"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-cleaner"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-cleaner"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-cleaner"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/cadaver-cleaner",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400418"
    },
    {
      "id": 1158,
      "name": "Venomous Insect Sram",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/venomous-insect-sram"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/venomous-insect-sram"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/venomous-insect-sram"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/venomous-insect-sram"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/venomous-insect-sram",
      "id_mapping_verified": true
    },
    {
      "id": 1159,
      "name": "Parasite Swarm",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Giant Ore Insectoid Adult",
          "source_url": "https://metabot.gg/en/aion-2/mounts/parasite-swarm",
          "monster_level": 36,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400473"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/parasite-swarm"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/parasite-swarm"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/parasite-swarm"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/parasite-swarm"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/parasite-swarm",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400473"
    },
    {
      "id": 1160,
      "name": "Drana Contaminant",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-contaminant"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-contaminant"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-contaminant"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-contaminant"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drana-contaminant",
      "id_mapping_verified": true
    },
    {
      "id": 1161,
      "name": "Faded Floater",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Faded Floater",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-floater",
          "monster_level": 35,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400479"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-floater"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-floater"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-floater"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-floater"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/faded-floater",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400479"
    },
    {
      "id": 1162,
      "name": "Kerubar",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Kerubar",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubar",
          "monster_level": 49,
          "spawn_count": 91,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101075"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Kerubar",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubar",
          "monster_level": 49,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400801"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubar"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubar"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubar"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubar"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kerubar",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101075"
    },
    {
      "id": 1163,
      "name": "Basilisk",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Moslan Forest",
          "monster": "Black Ash Basilisk",
          "source_url": "https://metabot.gg/en/aion-2/mounts/basilisk",
          "monster_level": 21,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400240"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/basilisk"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/basilisk"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/basilisk"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/basilisk"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/basilisk",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400240"
    },
    {
      "id": 1164,
      "name": "Lesser Earth Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Earth Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-earth-spirit",
          "monster_level": 51,
          "spawn_count": 13,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101089"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-earth-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-earth-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-earth-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-earth-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-earth-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101089"
    },
    {
      "id": 1165,
      "name": "Intermediate Earth Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Wandering Earth Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-earth-spirit",
          "monster_level": 44,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100653"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Immortal Earth Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-earth-spirit",
          "monster_level": 51,
          "spawn_count": 7,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400823"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Violent Earth Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-earth-spirit",
          "monster_level": 51,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101102"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-earth-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-earth-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-earth-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-earth-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-earth-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100653"
    },
    {
      "id": 1166,
      "name": "Superior Earth Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Corroded Soil Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-earth-spirit",
          "monster_level": 28,
          "spawn_count": 49,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400310"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Immortal Earth Spirit Guardian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-earth-spirit",
          "monster_level": 51,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400817"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Peculiar Rock Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-earth-spirit",
          "monster_level": 45,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100667"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-earth-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-earth-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-earth-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/superior-earth-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/superior-earth-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400310"
    },
    {
      "id": 1167,
      "name": "Flame Stone Guardian Statue",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/flame-stone-guardian-statue"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/flame-stone-guardian-statue"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/flame-stone-guardian-statue"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/flame-stone-guardian-statue"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/flame-stone-guardian-statue",
      "id_mapping_verified": true
    },
    {
      "id": 1168,
      "name": "Lesser Water Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Spirit's Rest",
          "monster": "Water Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-water-spirit",
          "monster_level": 16,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100231"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Water Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-water-spirit",
          "monster_level": 51,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101088"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-water-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-water-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-water-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-water-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-water-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100231"
    },
    {
      "id": 1169,
      "name": "Intermediate Water Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Intermediate Water Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-water-spirit",
          "monster_level": 46,
          "spawn_count": 21,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400738"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Wandering Water Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-water-spirit",
          "monster_level": 45,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100657"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Immortal Water Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-water-spirit",
          "monster_level": 51,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400822"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-water-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-water-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-water-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-water-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-water-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400738"
    },
    {
      "id": 1170,
      "name": "Kerubian",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Kerubian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubian",
          "monster_level": 49,
          "spawn_count": 88,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101080"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Kerubian",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubian",
          "monster_level": 49,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400802"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubian"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubian"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubian"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubian"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kerubian",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101080"
    },
    {
      "id": 1171,
      "name": "Kerubiel",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Kerubiel",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubiel",
          "monster_level": 49,
          "spawn_count": 55,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101077"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Kerubiel",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubiel",
          "monster_level": 49,
          "spawn_count": 39,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400803"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubiel"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubiel"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubiel"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/kerubiel"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/kerubiel",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101077"
    },
    {
      "id": 1172,
      "name": "Duduka Worker",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Black Claw Village",
          "monster": "Duduka Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-worker",
          "monster_level": 41,
          "spawn_count": 75,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400612"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-worker"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-worker"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-worker"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-worker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-worker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400612"
    },
    {
      "id": 1173,
      "name": "Duduka Trebuchet Worker",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Black Claw Village",
          "monster": "Duduka Slinger",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-trebuchet-worker",
          "monster_level": 42,
          "spawn_count": 44,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400613"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-trebuchet-worker"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-trebuchet-worker"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-trebuchet-worker"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-trebuchet-worker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/duduka-trebuchet-worker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400613"
    },
    {
      "id": 1174,
      "name": "Drana Predator",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Drana Predator",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-predator",
          "monster_level": 48,
          "spawn_count": 41,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110505"
        },
        {
          "zone": "Altgard",
          "area": "Dredgion Crash Site",
          "monster": "Drana Predator",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-predator",
          "monster_level": 12,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400010"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-predator"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-predator"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-predator"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-predator"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drana-predator",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110505"
    },
    {
      "id": 1175,
      "name": "Faded Predator",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Faded Predator",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-predator",
          "monster_level": 35,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400480"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-predator"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-predator"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-predator"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-predator"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/faded-predator",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400480"
    },
    {
      "id": 1176,
      "name": "Mudthorn",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Impetusium Square",
          "monster": "Remnant of Subspace",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mudthorn",
          "monster_level": 44,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400707"
        },
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Addicted Mudthorn",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mudthorn",
          "monster_level": 36,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400481"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mudthorn"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mudthorn"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mudthorn"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/mudthorn"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/mudthorn",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400707"
    },
    {
      "id": 1177,
      "name": "Ancient Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ancient-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ancient-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ancient-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ancient-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ancient-spirit",
      "id_mapping_verified": true
    },
    {
      "id": 1178,
      "name": "Spirit King's Bodyguard Warrior",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Right Wing",
          "monster": "Old Tree Spirit Warrior",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spirit-kings-bodyguard-warrior",
          "monster_level": 49,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600066"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Spirit King's Bodyguard Warrior",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spirit-kings-bodyguard-warrior",
          "monster_level": 54,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600466"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spirit-kings-bodyguard-warrior"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spirit-kings-bodyguard-warrior"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spirit-kings-bodyguard-warrior"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/spirit-kings-bodyguard-warrior"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/spirit-kings-bodyguard-warrior",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600066"
    },
    {
      "id": 1179,
      "name": "Drana Mutant",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Dredgion Crash Site",
          "monster": "Twisted Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant",
          "monster_level": 10,
          "spawn_count": 50,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400001"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drana-mutant",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400001"
    },
    {
      "id": 1180,
      "name": "Faded Mutant",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Drana Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant",
          "monster_level": 53,
          "spawn_count": 135,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600430"
        },
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Faded Mutant",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant",
          "monster_level": 35,
          "spawn_count": 43,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400477"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/faded-mutant",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600430"
    },
    {
      "id": 1181,
      "name": "Brax",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Western Altamia Highland",
          "monster": "Docile Highland Brax",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
          "monster_level": 32,
          "spawn_count": 49,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100740"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Altamia Highland",
          "monster": "Docile Highland Brax",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
          "monster_level": 32,
          "spawn_count": 2,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100740"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Meadow",
          "monster": "Hungry Brax",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
          "monster_level": 18,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100303"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Hungry Brax",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
          "monster_level": 18,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100303"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Field Brax",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
          "monster_level": 18,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100217"
        },
        {
          "zone": "Altgard",
          "area": "Sanctum Outpost and Tranein Highland",
          "monster": "Brax",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
          "monster_level": 20,
          "spawn_count": 21,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400914"
        },
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins",
          "monster": "Brax",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
          "monster_level": 33,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2000954"
        },
        {
          "zone": "Altgard",
          "area": "Battlescar Mound",
          "monster": "Brax",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
          "monster_level": 32,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400375"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/brax"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/brax",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100740"
    },
    {
      "id": 1182,
      "name": "Elite Soulless Corpse Gnat",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-soulless-corpse-gnat"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-soulless-corpse-gnat"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-soulless-corpse-gnat"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-soulless-corpse-gnat"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-soulless-corpse-gnat",
      "id_mapping_verified": true
    },
    {
      "id": 1183,
      "name": "Soulless Corpse Gnat",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins",
          "monster": "Soulless Corpse Gnat",
          "source_url": "https://metabot.gg/en/aion-2/mounts/soulless-corpse-gnat",
          "monster_level": 33,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400413"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/soulless-corpse-gnat"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/soulless-corpse-gnat"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/soulless-corpse-gnat"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/soulless-corpse-gnat"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/soulless-corpse-gnat",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400413"
    },
    {
      "id": 1184,
      "name": "Drakan Watcher",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Eastern Gribade Highland",
          "monster": "Drakan Patrol Watcher",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher",
          "monster_level": 40,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400591"
        },
        {
          "zone": "Altgard",
          "area": "Barahta Extermination Unit Outpost",
          "monster": "Drakan Patrol Watcher",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher",
          "monster_level": 40,
          "spawn_count": 1,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400591"
        },
        {
          "zone": "Verteron",
          "area": "Drana Processing Area",
          "monster": "Processing Facility Drakan Scout",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher",
          "monster_level": 42,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100872"
        },
        {
          "zone": "Altgard",
          "area": "Dranactus",
          "monster": "Drakan Manager",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher",
          "monster_level": 32,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400384"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/drakan-watcher",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400591"
    },
    {
      "id": 1185,
      "name": "Dratona Tinkerer",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona-tinkerer"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona-tinkerer"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona-tinkerer"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dratona-tinkerer"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/dratona-tinkerer",
      "id_mapping_verified": true
    },
    {
      "id": 1186,
      "name": "Poison Blood",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Cursed Poison Blood",
          "source_url": "https://metabot.gg/en/aion-2/mounts/poison-blood",
          "monster_level": 29,
          "spawn_count": 28,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400311"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Poison Blood",
          "source_url": "https://metabot.gg/en/aion-2/mounts/poison-blood",
          "monster_level": 47,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400743"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/poison-blood"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/poison-blood"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/poison-blood"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/poison-blood"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/poison-blood",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400311"
    },
    {
      "id": 1187,
      "name": "Intermediate Fire Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Intermediate Fire Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-fire-spirit",
          "monster_level": 48,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400748"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Immortal Fire Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-fire-spirit",
          "monster_level": 51,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400821"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Violent Fire Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-fire-spirit",
          "monster_level": 51,
          "spawn_count": 4,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101100"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-fire-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-fire-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-fire-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-fire-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/intermediate-fire-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400748"
    },
    {
      "id": 1188,
      "name": "Vivel",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery",
          "monster": "Vampire Vivel",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vivel",
          "monster_level": 14,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400057"
        },
        {
          "zone": "Verteron",
          "area": "Western Altamia Highland",
          "monster": "Highland Vivel",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vivel",
          "monster_level": 32,
          "spawn_count": 44,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100583"
        },
        {
          "zone": "Verteron",
          "area": "Rock Tomb Hill",
          "monster": "Highland Vivel",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vivel",
          "monster_level": 32,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100583"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vivel"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vivel"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vivel"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/vivel"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/vivel",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400057"
    },
    {
      "id": 1189,
      "name": "Tamed Zaif",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Tamed Zaif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-zaif",
          "monster_level": 52,
          "spawn_count": 88,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600452"
        },
        {
          "zone": "Verteron",
          "area": "Pilgrim's Ridge",
          "monster": "Marauders Zaif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-zaif",
          "monster_level": 27,
          "spawn_count": 6,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100566"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-zaif"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-zaif"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-zaif"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-zaif"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-zaif",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600452"
    },
    {
      "id": 1190,
      "name": "Elite Poisonous Spore Fungen",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-poisonous-spore-fungen"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-poisonous-spore-fungen"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-poisonous-spore-fungen"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-poisonous-spore-fungen"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-poisonous-spore-fungen",
      "id_mapping_verified": true
    },
    {
      "id": 1191,
      "name": "Furious Feruk",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/furious-feruk"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/furious-feruk"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/furious-feruk"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/furious-feruk"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/furious-feruk",
      "id_mapping_verified": true
    },
    {
      "id": 1192,
      "name": "Silver Blade Rotan",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Steel Titan's Grave",
          "monster": "Abyss Silver Blade Rotan",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan",
          "monster_level": 53,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600403"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Eroded Fragment Area",
          "monster": "Abyss Silver Blade Rotan",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan",
          "monster_level": 53,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600403"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Devastated Remnants - Weathered Outcrop and Devastated Remnants - Shade Island",
          "monster": "Abyss Rusty Rotan",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan",
          "monster_level": 46,
          "spawn_count": 13,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600003"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Black Fragments Area - Kibelium Fragment",
          "monster": "Abyss Old Blade Rotan",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan",
          "monster_level": 46,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600013"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Black Fragments Area - Lonely Island",
          "monster": "Abyss Old Blade Rotan",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan",
          "monster_level": 46,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600013"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/silver-blade-rotan",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600403"
    },
    {
      "id": 1193,
      "name": "Addicted Shulak Cart Worker",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Rampaging Shulak Cart Worker",
          "source_url": "https://metabot.gg/en/aion-2/mounts/addicted-shulak-cart-worker",
          "monster_level": 36,
          "spawn_count": 29,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400455"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/addicted-shulak-cart-worker"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/addicted-shulak-cart-worker"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/addicted-shulak-cart-worker"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/addicted-shulak-cart-worker"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/addicted-shulak-cart-worker",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400455"
    },
    {
      "id": 1194,
      "name": "Guardite",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Uncontrollable Guardite",
          "source_url": "https://metabot.gg/en/aion-2/mounts/guardite",
          "monster_level": 36,
          "spawn_count": 33,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100712"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/guardite"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/guardite"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/guardite"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/guardite"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/guardite",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100712"
    },
    {
      "id": 1195,
      "name": "Dracuni Herbalist",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Drana Processing Area",
          "monster": "Dracuni Processing Laborer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dracuni-herbalist",
          "monster_level": 41,
          "spawn_count": 44,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100867"
        },
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Poison Blood Gatherer",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dracuni-herbalist",
          "monster_level": 47,
          "spawn_count": 33,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400746"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dracuni-herbalist"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dracuni-herbalist"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dracuni-herbalist"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dracuni-herbalist"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/dracuni-herbalist",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100867"
    },
    {
      "id": 1196,
      "name": "Elite Dratona",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-dratona"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-dratona"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-dratona"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-dratona"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-dratona",
      "id_mapping_verified": true
    },
    {
      "id": 1197,
      "name": "Watcher Guardite",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Contaminated Guardite",
          "source_url": "https://metabot.gg/en/aion-2/mounts/watcher-guardite",
          "monster_level": 37,
          "spawn_count": 44,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100716"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/watcher-guardite"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/watcher-guardite"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/watcher-guardite"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/watcher-guardite"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/watcher-guardite",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100716"
    },
    {
      "id": 1198,
      "name": "Ashen Basilisk",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-basilisk"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-basilisk"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-basilisk"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-basilisk"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-basilisk",
      "id_mapping_verified": true
    },
    {
      "id": 1199,
      "name": "Flame Barghest",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/flame-barghest"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/flame-barghest"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/flame-barghest"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/flame-barghest"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/flame-barghest",
      "id_mapping_verified": true
    },
    {
      "id": 1200,
      "name": "Naga Elite Priest",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Abyss Naga Dark Mage",
          "source_url": "https://metabot.gg/en/aion-2/mounts/naga-elite-priest",
          "monster_level": 54,
          "spawn_count": 23,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600536"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - River of Rotten Sap",
          "monster": "Abyss Naga Dark Mage",
          "source_url": "https://metabot.gg/en/aion-2/mounts/naga-elite-priest",
          "monster_level": 48,
          "spawn_count": 7,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600042"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/naga-elite-priest"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/naga-elite-priest"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/naga-elite-priest"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/naga-elite-priest"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/naga-elite-priest",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600536"
    },
    {
      "id": 1201,
      "name": "Modified Lupyllini",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Modified Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-lupyllini",
          "monster_level": 49,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400814"
        },
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Lupyllini Test Subject",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-lupyllini",
          "monster_level": 40,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100815"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-lupyllini",
          "monster_level": 49,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101086"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-lupyllini"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-lupyllini"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-lupyllini"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/modified-lupyllini"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/modified-lupyllini",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400814"
    },
    {
      "id": 1202,
      "name": "Decomposed Lupyllini",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Battlescar Mound",
          "monster": "Decomposed Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini",
          "monster_level": 32,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400378"
        },
        {
          "zone": "Altgard",
          "area": "Dredgion Crash Site and Galorik's Inspection Area",
          "monster": "Decomposed Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini",
          "monster_level": 10,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400004"
        },
        {
          "zone": "Altgard",
          "area": "Tranein Highland, Moslan Forest, and Munin's Bridge",
          "monster": "Decomposed Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini",
          "monster_level": 20,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400911"
        },
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins",
          "monster": "Ferocious Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini",
          "monster_level": 33,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400391"
        },
        {
          "zone": "Verteron",
          "area": "Eastern Altamia Highland",
          "monster": "Contaminated Highland Lupyllini",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini",
          "monster_level": 35,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100747"
        }
      ],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/decomposed-lupyllini",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400378"
    },
    {
      "id": 1203,
      "name": "Tamed Karnif",
      "genus": "Fera",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Western Gribade Highland",
          "monster": "Tamed Blades Beast",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-karnif",
          "monster_level": 37,
          "spawn_count": 56,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400503"
        },
        {
          "zone": "Altgard",
          "area": "Uruthumheim",
          "monster": "Blades Karnif",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-karnif",
          "monster_level": 24,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400257"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Ground Move Speed",
          "level": 1,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-karnif"
        },
        {
          "stat": "Mount Ground Move Speed",
          "level": 3,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-karnif"
        },
        {
          "stat": "Accuracy Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-karnif"
        },
        {
          "stat": "Dexterity",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-karnif"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/tamed-karnif",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400503"
    },
    {
      "id": 1204,
      "name": "Pagati",
      "genus": "Special",
      "faction": "unknown",
      "locations": [],
      "bonuses": [],
      "source_url": "https://metabot.gg/en/aion-2/mounts/pagati",
      "id_mapping_verified": true
    },
    {
      "id": 1206,
      "name": "Elite Guardite",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-guardite"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-guardite"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-guardite"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/elite-guardite"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/elite-guardite",
      "id_mapping_verified": true
    },
    {
      "id": 1207,
      "name": "Agrint",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Old Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
          "monster_level": 44,
          "spawn_count": 33,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100698"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Abyss Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
          "monster_level": 53,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600571"
        },
        {
          "zone": "Altgard",
          "area": "Basfelt Ruins",
          "monster": "Ruin Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
          "monster_level": 33,
          "spawn_count": 22,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400415"
        },
        {
          "zone": "Altgard",
          "area": "Moslan Forest",
          "monster": "Mutated Elim",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
          "monster_level": 22,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400221"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Midstream",
          "monster": "Decaying Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
          "monster_level": 18,
          "spawn_count": 19,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100143"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Sanctum",
          "monster": "Contaminated Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
          "monster_level": 37,
          "spawn_count": 16,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100714"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Island Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
          "monster_level": 49,
          "spawn_count": 11,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400825"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Reshanta's Root",
          "monster": "Root Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
          "monster_level": 48,
          "spawn_count": 10,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600071"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/agrint"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/agrint",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100698"
    },
    {
      "id": 1208,
      "name": "Ashen Agrint",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Spirit Isle",
          "monster": "Unstable Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-agrint",
          "monster_level": 48,
          "spawn_count": 8,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400750"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-agrint"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-agrint"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-agrint"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-agrint"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/ashen-agrint",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400750"
    },
    {
      "id": 1209,
      "name": "Thin Agrint",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Contaminated Marsh",
          "monster": "Thin Sulfur Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint",
          "monster_level": 52,
          "spawn_count": 81,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600531"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Sulfur Tree Island - Branding Island, Sulfur Tree Island - Sulfur Swamp, and Sulfur Tree Island - River of Rotten Sap",
          "monster": "Thin Sulfur Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint",
          "monster_level": 47,
          "spawn_count": 30,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600028"
        },
        {
          "zone": "Verteron",
          "area": "Crimson Isle",
          "monster": "Crimson Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint",
          "monster_level": 46,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2110508"
        },
        {
          "zone": "Altgard",
          "area": "Nameless Cemetery",
          "monster": "Red Eye Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint",
          "monster_level": 13,
          "spawn_count": 5,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400054"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/thin-agrint",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600531"
    },
    {
      "id": 1210,
      "name": "Dry Leaf Agrint",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Southern Tolbas Forest",
          "monster": "Forest Agrint",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dry-leaf-agrint",
          "monster_level": 25,
          "spawn_count": 32,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100179"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dry-leaf-agrint"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dry-leaf-agrint"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dry-leaf-agrint"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dry-leaf-agrint"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/dry-leaf-agrint",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100179"
    },
    {
      "id": 1213,
      "name": "Lesser Fire Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Purifying Forest",
          "monster": "Burning Ember Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-fire-spirit",
          "monster_level": 27,
          "spawn_count": 25,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400325"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Fire Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-fire-spirit",
          "monster_level": 51,
          "spawn_count": 15,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101087"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-fire-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-fire-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-fire-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-fire-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/lesser-fire-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400325"
    },
    {
      "id": 1214,
      "name": "Black Spirit",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Kraka Footpath",
          "monster": "Distorted Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit",
          "monster_level": 39,
          "spawn_count": 92,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100807"
        },
        {
          "zone": "Verteron",
          "area": "Romlon's Hideout",
          "monster": "Distorted Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit",
          "monster_level": 39,
          "spawn_count": 1,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100807"
        },
        {
          "zone": "Verteron",
          "area": "Contaminated Marsh",
          "monster": "Contaminated Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit",
          "monster_level": 15,
          "spawn_count": 40,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100460"
        },
        {
          "zone": "Altgard",
          "area": "Impetusium Square",
          "monster": "Black Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit",
          "monster_level": 44,
          "spawn_count": 18,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400708"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Reshanta's Root",
          "monster": "Abyss Corrupted Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit",
          "monster_level": 48,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600069"
        },
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Corroded Heart",
          "monster": "Abyss Corrupted Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit",
          "monster_level": 52,
          "spawn_count": 17,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600469"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/black-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100807"
    },
    {
      "id": 1215,
      "name": "Predator Saraswati",
      "genus": "Cogni",
      "faction": "unknown",
      "locations": [],
      "bonuses": [
        {
          "stat": "HP",
          "level": 1,
          "value": 10,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/predator-saraswati"
        },
        {
          "stat": "HP",
          "level": 3,
          "value": 30,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/predator-saraswati"
        },
        {
          "stat": "Critical Hit",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/predator-saraswati"
        },
        {
          "stat": "Might",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/predator-saraswati"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/predator-saraswati",
      "id_mapping_verified": true
    },
    {
      "id": 1216,
      "name": "Dark Spirit",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Verteron",
          "area": "Altamia Canyon",
          "monster": "Corrupted Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dark-spirit",
          "monster_level": 33,
          "spawn_count": 34,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100600"
        },
        {
          "zone": "Verteron",
          "area": "Garden of the Illusion God",
          "monster": "Wandering Dark Spirit",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dark-spirit",
          "monster_level": 45,
          "spawn_count": 20,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100656"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dark-spirit"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dark-spirit"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dark-spirit"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/dark-spirit"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/dark-spirit",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100600"
    },
    {
      "id": 1217,
      "name": "Congealed Drana",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Dredgion Crash Site",
          "monster": "Congealed Drana",
          "source_url": "https://metabot.gg/en/aion-2/mounts/congealed-drana",
          "monster_level": 12,
          "spawn_count": 26,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400009"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/congealed-drana"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/congealed-drana"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/congealed-drana"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/congealed-drana"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/congealed-drana",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400009"
    },
    {
      "id": 1218,
      "name": "Faded Drana",
      "genus": "Varian",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Altgard",
          "area": "Fafnite Deposit",
          "monster": "Faded Chunk",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-drana",
          "monster_level": 35,
          "spawn_count": 13,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400478"
        }
      ],
      "bonuses": [
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 1,
          "value": 0.1,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-drana"
        },
        {
          "stat": "Mount Sprint Stamina Cost Reduction Rate",
          "level": 3,
          "value": 0.3,
          "unit": "percent",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-drana"
        },
        {
          "stat": "Evasion Bonus",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-drana"
        },
        {
          "stat": "Constitution",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/faded-drana"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/faded-drana",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400478"
    },
    {
      "id": 1219,
      "name": "Zelophi",
      "genus": "Natura",
      "faction": "unknown",
      "locations": [
        {
          "zone": "Chaotic Middle Reshanta",
          "area": "Distorted Old Growth Forest",
          "monster": "Abyss Zelophi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi",
          "monster_level": 51,
          "spawn_count": 150,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600512"
        },
        {
          "zone": "Chaotic Lower Reshanta",
          "area": "Archipelago of Siel's Wings - Siel's Right Wing and Archipelago of Siel's Wings - Siel's Left Wing",
          "monster": "Abyss Zelophi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi",
          "monster_level": 46,
          "spawn_count": 60,
          "map_url": "https://metabot.gg/en/aion-2/map/chaotic-lower-reshanta?focus=npc:2600050"
        },
        {
          "zone": "Verteron",
          "area": "Ellun River Marsh",
          "monster": "Coastal Zelophi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi",
          "monster_level": 14,
          "spawn_count": 42,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2100458"
        },
        {
          "zone": "Altgard",
          "area": "Immortal Isle",
          "monster": "Zelophi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi",
          "monster_level": 49,
          "spawn_count": 31,
          "map_url": "https://metabot.gg/en/aion-2/map/altgard?focus=npc:2400811"
        },
        {
          "zone": "Verteron",
          "area": "Eternal Isle",
          "monster": "Eternal Zelophi",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi",
          "monster_level": 49,
          "spawn_count": 14,
          "map_url": "https://metabot.gg/en/aion-2/map/verteron?focus=npc:2101085"
        }
      ],
      "bonuses": [
        {
          "stat": "Stamina",
          "level": 1,
          "value": 3,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi"
        },
        {
          "stat": "Stamina",
          "level": 3,
          "value": 9,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi"
        },
        {
          "stat": "Critical Hit Resist",
          "level": 3,
          "value": 2,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi"
        },
        {
          "stat": "Precision",
          "level": 3,
          "value": 1,
          "unit": "points",
          "scope": "pet-owned",
          "verification": "cross-source-inference",
          "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi"
        }
      ],
      "source_url": "https://metabot.gg/en/aion-2/mounts/zelophi",
      "id_mapping_verified": true,
      "map_url": "https://metabot.gg/en/aion-2/map/chaotic-middle-reshanta?focus=npc:2600512"
    },
    {
      "id": 1240,
      "name": "White Bunny",
      "genus": "Special",
      "faction": "unknown",
      "locations": [],
      "bonuses": [],
      "source_url": "https://metabot.gg/en/aion-2/mounts/white-bunny",
      "id_mapping_verified": true
    },
    {
      "id": 1278,
      "name": "Chonky Hamster",
      "genus": "Special",
      "faction": "unknown",
      "locations": [],
      "bonuses": [],
      "source_url": "https://metabot.gg/en/aion-2/mounts/chonky-hamster",
      "id_mapping_verified": true
    },
    {
      "id": 1299,
      "name": "Two",
      "genus": "Special",
      "faction": "unknown",
      "locations": [],
      "bonuses": [],
      "source_url": "https://metabot.gg/en/aion-2/mounts/two",
      "id_mapping_verified": true
    }
  ]
});

export const PET_DATA_NOTICE = `MIT License

Copyright (c) 2026 MartinLVila

Copyright (c) 2026 AION2-pet-tracker contributors (pet_protocol.py is adapted from their work)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
