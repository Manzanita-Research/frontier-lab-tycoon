import { defineMod } from "@flt/mod-sdk";

// Optional typed version; bundle this directory to regenerate mod.json.
export default defineMod({
  "apiVersion": 1,
  "id": "starter-mod",
  "name": "Starter Mod",
  "version": "1.0.0",
  "description": "A small example of every v1 content section.",
  "content": {
    "rivals": {
      "override": [
        {
          "id": "anthro",
          "name": "Anthro-Paw-Morphic"
        }
      ]
    },
    "headlines": {
      "add": [
        {
          "id": "starter-news",
          "text": "The lab appoints a Chief Fetch Officer",
          "tone": "joke"
        }
      ]
    },
    "walkerKinds": {
      "add": [
        {
          "id": "retriever",
          "name": "Golden Retriever",
          "presentation": "sprite",
          "needs": []
        }
      ]
    },
    "buildings": {
      "add": [
        {
          "id": "opinion-booth",
          "kind": "opinion-booth",
          "name": "Opinion Booth",
          "size": [
            1,
            1
          ],
          "price": 1000,
          "upkeepPerDay": 10,
          "blurb": "Unlimited opinions. Limited seating.",
          "color": "#d8ac48",
          "hosts": [
            "researcher"
          ],
          "capacity": 2,
          "stay": [
            2,
            4
          ],
          "serves": {
            "researcher": {
              "focus": 0.2
            }
          }
        }
      ]
    },
    "thoughts": {
      "add": [
        {
          "id": "starter-thought",
          "kind": "protester",
          "when": "always",
          "text": "I oppose this policy. I support this tennis ball."
        }
      ]
    },
    "events": {
      "add": [
        {
          "id": "fetch-card",
          "title": "The Fetch Summit",
          "body": "The gate demands a ball and a position paper.",
          "tone": "joke",
          "when": {
            "stat": "day",
            "atLeast": 20
          },
          "cooldown": 30,
          "choices": [
            {
              "label": "Throw the ball",
              "hint": "The discourse fetches itself.",
              "effects": [
                {
                  "type": "discourse",
                  "add": -2
                },
                {
                  "type": "flag",
                  "name": "ball-thrown"
                }
              ]
            }
          ]
        }
      ]
    },
    "arcs": {
      "add": [
        {
          "id": "fetch-arc",
          "initial": "waiting",
          "states": {
            "waiting": {
              "on": {
                "DAY": {
                  "target": "resolved",
                  "guard": {
                    "type": "day.after",
                    "params": {
                      "day": 20
                    }
                  },
                  "actions": [
                    {
                      "type": "card",
                      "params": {
                        "id": "fetch-card"
                      }
                    }
                  ]
                }
              }
            },
            "resolved": {
              "type": "final"
            }
          }
        }
      ]
    },
    "endings": {
      "add": [
        {
          "id": "good-dog",
          "title": "A Good Lab",
          "text": "Everyone gets a biscuit.",
          "when": {
            "stat": "hype",
            "atLeast": 80
          }
        }
      ]
    },
    "tips": {
      "add": [
        {
          "id": "fetch-tip",
          "text": "Paths help people reach buildings. Opinions arrive unaided."
        }
      ]
    },
    "names": {
      "add": [
        {
          "id": "DOG_NAMES",
          "values": [
            "Dr. Biscuit Gradient",
            "Professor Fetch"
          ]
        }
      ]
    },
    "goals": {
      "override": [
        {
          "id": "release",
          "label": "Ship the fourth biscuit"
        }
      ]
    }
  },
  "skin": {
    "id": "starter-mod",
    "name": "Starter Mod",
    "tokens": {
      "--accent": "#d8ac48"
    },
    "css": ".fetch-note { color: #d8ac48; }"
  }
});
