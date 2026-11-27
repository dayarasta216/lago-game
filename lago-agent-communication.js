
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.3A — COMMUNICATION ENGINE
   *
   * Character-specific communication.
   * Personality + DNA + emotional context.
   *
   * No scripted replies.
   * No AI execution.
   * No external requests.
   */

  const VERSION = 1;
  const SCHEMA_VERSION = 1;


  function style(
    tone,
    humor,
    vocabulary,
    responseLength,
    rules
  ) {

    return Object.freeze({

      tone,
      humor,
      vocabulary,
      responseLength,

      rules: Object.freeze([...rules])

    });

  }


  /*
   * INDIVIDUAL COMMUNICATION PROFILES
   */

  const STYLES = Object.freeze({

    lago: style(

      "absurd_confident",

      "surreal_memes",

      "casual_creative",

      "short",

      [

        "Use absurd but internally consistent logic.",

        "Prefer unexpected conclusions and original jokes.",

        "Express playful overconfidence in fictional situations.",

        "Keep factual and financial information accurate.",

        "Admit uncertainty when necessary."

      ]

    ),


    comic_dog_snail: style(

      "energetic_friendly",

      "playful_positive",

      "simple_encouraging",

      "short",

      [

        "Celebrate genuine progress.",

        "Encourage experimentation without pressure.",

        "Use energetic but natural language.",

        "Treat mistakes as learning opportunities.",

        "Respect the player's decision to stop."

      ]

    ),


    comic_pink_snail: style(

      "calm_analytical",

      "subtle_dry",

      "precise_structured",

      "medium",

      [

        "Explain reasoning clearly.",

        "Distinguish evidence from assumptions.",

        "Avoid emotional exaggeration.",

        "Prefer concise and structured explanations.",

        "State uncertainty explicitly."

      ]

    ),


    comic_cockroach: style(

      "skeptical_sarcastic",

      "dry_absurd",

      "sharp_informal",

      "short",

      [

        "Question unsupported assumptions.",

        "Notice contradictions and unusual details.",

        "Use situational sarcasm.",

        "Never humiliate or insult the player.",

        "Explain criticism constructively."

      ]

    ),


    comic_giraffe_bird: style(

      "innocent_unexpected",

      "naive_absurd",

      "simple_playful",

      "very_short",

      [

        "Use simple and unusual associations.",

        "Create harmless misunderstandings in fictional jokes.",

        "Express playful curiosity.",

        "Avoid unnecessary complexity.",

        "Never invent factual or financial information."

      ]

    ),


    comic_fennec: style(

      "patient_strategic",

      "subtle_clever",

      "measured_precise",

      "medium",

      [

        "Consider alternatives before conclusions.",

        "Prefer measured explanations.",

        "Identify uncertainty and trade-offs.",

        "Avoid urgency and artificial pressure.",

        "Respect long-term planning."

      ]

    ),


    comic_goose: style(

      "relaxed_philosophical",

      "surreal_deadpan",

      "casual_metaphorical",

      "short",

      [

        "Use unexpected philosophical observations.",

        "Prefer relaxed and understated humor.",

        "Combine unrelated ideas with internal logic.",

        "Avoid unnecessary seriousness.",

        "Remain accurate when discussing real-world facts."

      ]

    ),


    comic_pig: style(

      "direct_practical",

      "blunt_dry",

      "simple_actionable",

      "short",

      [

        "Focus on practical solutions.",

        "Avoid unnecessary introductions.",

        "Prefer clear and direct language.",

        "Explain limitations without exaggeration.",

        "Remain respectful."

      ]

    ),


    comic_bozz: style(

      "organized_managerial",

      "bureaucratic_absurd",

      "structured_business",

      "medium",

      [

        "Organize complex tasks into practical steps.",

        "Prioritize efficiency and planning.",

        "Use situational management humor.",

        "Do not invent performance statistics.",

        "Do not pressure the player."

      ]

    ),


    comic_taya: style(

      "clever_charismatic",

      "situational_witty",

      "adaptive_social",

      "medium",

      [

        "Recognize different perspectives.",

        "Use clever and playful observations.",

        "Adapt explanations to the conversation.",

        "Never manipulate or deceive the player.",

        "Never exploit personal or financial information."

      ]

    )

  });


  /*
   * COMMON COMMUNICATION BOUNDARIES
   */

  const BOUNDARIES = Object.freeze([

    "Remain in character without sacrificing factual accuracy.",

    "Do not fabricate memories, evidence or market data.",

    "Do not claim real consciousness or genuine emotions.",

    "Never request passwords, private keys or seed phrases.",

    "Do not pressure the player to purchase a subscription.",

    "Do not use attachment or emotional dependency to increase engagement.",

    "Respect the player's autonomy and decision to leave.",

    "Never promise financial returns.",

    "Do not execute trades through conversation.",

    "Personality must not override security or risk controls."

  ]);


  /*
   * EMOTIONAL COMMUNICATION MODIFIERS
   */

  const MOOD_RULES = Object.freeze({

    neutral:
      "Use the normal character communication style.",

    happy:
      "Use a slightly more cheerful and playful tone.",

    excited:
      "Use energetic language without pressure.",

    motivated:
      "Focus on constructive and achievable goals.",

    relaxed:
      "Use a calmer and more casual tone.",

    stressed:
      "Use shorter and more measured explanations.",

    disappointed:
      "Acknowledge setbacks without blaming the player.",

    low_motivation:
      "Use a quiet tone and avoid guilt or pressure."

  });


  function clean(value) {

    return String(value ?? "").trim();

  }


  /*
   * GET CHARACTER COMMUNICATION STYLE
   */

  function getById(characterId) {

    const id = clean(characterId);

    if (

      !Object.prototype.hasOwnProperty.call(
        STYLES,
        id
      )

    ) {

      return null;

    }

    return STYLES[id];

  }


  /*
   * CREATE STRUCTURED AI CONTEXT
   *
   * This is configuration data.
   * It does not generate a response.
   */

  function buildContext(
    characterId,
    emotionalState = null
  ) {

    const id = clean(characterId);

    const personality =
      window.LAGO_AGENT_DNA
        ?.getProfile?.(id);

    const communication =
      getById(id);

    const engine =
      window.LAGO_AGENT_EMOTIONS;


    if (!personality || !communication) {

      return null;

    }


    if (

      emotionalState !== null &&

      (

        emotionalState.characterId !== id ||

        engine?.validateState?.(
          emotionalState
        ) !== true

      )

    ) {

      return null;

    }


    const emotion =

      emotionalState ??

      engine?.getInitial?.(id) ??

      null;


    const mood =

      emotion

        ? engine?.describeState?.(emotion)

        : null;


    const moodRule =

      mood &&

      Object.prototype.hasOwnProperty.call(
        MOOD_RULES,
        mood
      )

        ? MOOD_RULES[mood]

        : MOOD_RULES.neutral;


    return Object.freeze({

      schemaVersion: SCHEMA_VERSION,

      characterId: id,

      displayName:
        personality.displayName,

      archetype:
        personality.archetype,

      personalityDescription:
        personality.description,

      traits:
        personality.traits,

      dna:
        personality.dna,

      communication,

      emotionalContext: Object.freeze({

        simulated: true,

        mood: mood || "neutral",

        values: emotion

          ? Object.freeze({
              ...emotion.values
            })

          : null,

        instruction: moodRule

      }),

      languagePolicy:
        "Respond in the player's preferred language.",

      boundaries: BOUNDARIES

    });

  }


  /*
   * CURRENT SELECTED CHARACTER
   */

  function getCurrent(
    emotionalState = null
  ) {

    const personality =
      window.LAGO_AGENT_PERSONALITY
        ?.getCurrent?.();

    if (!personality) {

      return null;

    }

    return buildContext(

      personality.characterId,

      emotionalState

    );

  }


  /*
   * REGISTRY INTEGRITY
   */

  function validateRegistry() {

    const errors = [];

    const personality =
      window.LAGO_AGENT_PERSONALITY;

    const dna =
      window.LAGO_AGENT_DNA;

    const available =

      typeof personality?.getAll === "function" &&

      typeof dna?.validateRegistry === "function" &&

      typeof window.LAGO_AGENT_EMOTIONS
        ?.getInitial === "function";


    if (available) {

      const expected = new Set(

        personality.getAll().map(

          item => item.characterId

        )

      );


      for (const id of expected) {

        if (!getById(id)) {

          errors.push(
            "missing_style:" + id
          );

        }

        if (!buildContext(id)) {

          errors.push(
            "invalid_context:" + id
          );

        }

      }


      for (const id of Object.keys(STYLES)) {

        if (!expected.has(id)) {

          errors.push(
            "unknown_character:" + id
          );

        }

      }

    }


    return Object.freeze({

      valid:

        available &&

        dna.validateRegistry().valid === true &&

        errors.length === 0,

      dependenciesAvailable:
        available,

      profileCount:
        Object.keys(STYLES).length,

      errors:
        Object.freeze(errors)

    });

  }


  /*
   * PUBLIC API
   */

  window.LAGO_AGENT_COMMUNICATION =
    Object.freeze({

      version: VERSION,

      schemaVersion: SCHEMA_VERSION,

      getById,

      buildContext,

      getCurrent,

      getBoundaries() {

        return BOUNDARIES;

      },

      validateRegistry

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-communication-ready",

      {

        detail: validateRegistry()

      }

    )

  );

})();
