
(() => {

  "use strict";

  /*
   * LAGO GAME
   * R2.4A — STRATEGY ENGINE
   *
   * Individual analytical strategies.
   * Research and paper trading only.
   *
   * No real orders.
   * No wallet access.
   * No financial authorization.
   */

  const VERSION = 1;

  const SCHEMA_VERSION = 1;


  /*
   * SHARED SAFETY POLICY
   */

  const POLICY = Object.freeze({

    researchOnly: true,

    paperTradingOnly: true,

    liveTradingEnabled: false,

    walletAccessEnabled: false,

    leverageEnabled: false,

    borrowingEnabled: false,

    derivativesEnabled: false,

    guaranteedReturns: false,

    serverVerificationRequired: true,

    separateTradingAuthorization: true,

    personalityOverridesRisk: false,

    emotionsOverrideRisk: false,

    subscriptionAuthorizesTrading: false

  });


  /*
   * STRATEGY PROFILE FACTORY
   */

  function strategy(
    strategyId,
    title,
    description,
    indicators,
    timeframes,
    conditions,
    learningFocus
  ) {

    return Object.freeze({

      strategyId,

      title,

      description,

      indicators:
        Object.freeze([...indicators]),

      timeframes:
        Object.freeze([...timeframes]),

      conditions:
        Object.freeze([...conditions]),

      learningFocus:
        Object.freeze([...learningFocus]),

      mode: "research",

      liveTradingEnabled: false

    });

  }


  /*
   * INDIVIDUAL STRATEGY REGISTRY
   */

  const STRATEGIES = Object.freeze({

    lago: strategy(

      "adaptive_exploration",

      "Adaptive Exploration",

      "Research different market conditions and compare strategy performance.",

      [
        "market_regime",
        "volatility",
        "volume",
        "trend_strength"
      ],

      ["1h", "4h", "1d"],

      [
        "Identify the current market regime.",
        "Compare multiple research hypotheses.",
        "Reject insufficient market data.",
        "Avoid untested live execution."
      ],

      [
        "regime_detection",
        "hypothesis_testing",
        "strategy_comparison"
      ]

    ),


    comic_dog_snail: strategy(

      "momentum",

      "Momentum",

      "Research directional price momentum supported by market activity.",

      [
        "rate_of_change",
        "relative_strength_index",
        "volume",
        "trend_strength"
      ],

      ["15m", "1h", "4h"],

      [
        "Measure directional momentum.",
        "Check volume confirmation.",
        "Identify excessive price extension.",
        "Avoid impulsive execution."
      ],

      [
        "momentum_detection",
        "false_signal_filtering",
        "volume_confirmation"
      ]

    ),


    comic_pink_snail: strategy(

      "mean_reversion",

      "Mean Reversion",

      "Research statistically significant price deviations from a reference mean.",

      [
        "moving_average",
        "standard_deviation",
        "z_score",
        "volatility"
      ],

      ["1h", "4h", "1d"],

      [
        "Establish a valid reference mean.",
        "Measure statistical deviation.",
        "Check market regime compatibility.",
        "Reject unsupported reversal assumptions."
      ],

      [
        "statistical_analysis",
        "distribution_analysis",
        "regime_filtering"
      ]

    ),


    comic_cockroach: strategy(

      "contrarian",

      "Contrarian Analysis",

      "Research discrepancies between market expectations and observable evidence.",

      [
        "market_sentiment",
        "volume",
        "price_divergence",
        "volatility"
      ],

      ["4h", "1d"],

      [
        "Identify prevailing market expectations.",
        "Check independent evidence.",
        "Distinguish disagreement from opportunity.",
        "Reject unsupported contrarian signals."
      ],

      [
        "bias_detection",
        "divergence_analysis",
        "evidence_validation"
      ]

    ),


    comic_giraffe_bird: strategy(

      "rule_based_signals",

      "Rule-Based Signals",

      "Research simple and reproducible market signals.",

      [
        "moving_average",
        "volume",
        "price_change"
      ],

      ["4h", "1d"],

      [
        "Use explicit signal rules.",
        "Require sufficient historical data.",
        "Avoid contradictory signals.",
        "Keep decisions reproducible."
      ],

      [
        "rule_validation",
        "signal_consistency",
        "basic_market_analysis"
      ]

    ),


    comic_fennec: strategy(

      "trend_following",

      "Trend Following",

      "Research sustained directional market trends.",

      [
        "moving_average",
        "trend_strength",
        "average_true_range",
        "volume"
      ],

      ["4h", "1d"],

      [
        "Identify a sustained trend.",
        "Confirm trend strength.",
        "Monitor trend invalidation.",
        "Avoid unsupported predictions."
      ],

      [
        "trend_identification",
        "trend_invalidation",
        "multi_timeframe_analysis"
      ]

    ),


    comic_goose: strategy(

      "range_analysis",

      "Range Analysis",

      "Research established price ranges and their boundaries.",

      [
        "support",
        "resistance",
        "volatility",
        "relative_strength_index"
      ],

      ["1h", "4h"],

      [
        "Identify a measurable price range.",
        "Check boundary reliability.",
        "Detect possible regime changes.",
        "Avoid assuming permanent range stability."
      ],

      [
        "range_detection",
        "boundary_analysis",
        "regime_transition"
      ]

    ),


    comic_pig: strategy(

      "breakout_analysis",

      "Breakout Analysis",

      "Research confirmed price movements beyond established market boundaries.",

      [
        "support",
        "resistance",
        "volume",
        "average_true_range"
      ],

      ["1h", "4h"],

      [
        "Identify established price boundaries.",
        "Check breakout confirmation.",
        "Evaluate false breakout evidence.",
        "Reject unconfirmed price movements."
      ],

      [
        "breakout_detection",
        "confirmation_analysis",
        "false_breakout_filtering"
      ]

    ),


    comic_bozz: strategy(

      "portfolio_rebalancing",

      "Portfolio Rebalancing",

      "Research portfolio allocation and concentration risk.",

      [
        "asset_weight",
        "allocation_drift",
        "correlation",
        "portfolio_volatility"
      ],

      ["1d", "1w"],

      [
        "Use an explicitly defined target allocation.",
        "Measure allocation drift.",
        "Account for fees and liquidity.",
        "Reject unauthorized portfolio changes."
      ],

      [
        "allocation_analysis",
        "diversification",
        "concentration_analysis"
      ]

    ),


    comic_taya: strategy(

      "sentiment_analysis",

      "Sentiment Analysis",

      "Research market sentiment using verifiable information sources.",

      [
        "market_sentiment",
        "news_sentiment",
        "social_activity",
        "volume"
      ],

      ["1h", "4h", "1d"],

      [
        "Verify information sources.",
        "Distinguish facts from rumors.",
        "Check for coordinated manipulation.",
        "Avoid treating popularity as proof of value."
      ],

      [
        "source_validation",
        "sentiment_classification",
        "manipulation_detection"
      ]

    )

  });


  /*
   * READ-ONLY PROFILE ACCESS
   */

  function getById(characterId) {

    const id =
      String(characterId ?? "").trim();

    if (

      !Object.prototype.hasOwnProperty.call(
        STRATEGIES,
        id
      )

    ) {

      return null;

    }

    return Object.freeze({

      characterId: id,

      schemaVersion: SCHEMA_VERSION,

      ...STRATEGIES[id],

      policy: POLICY

    });

  }


  function getAll() {

    return Object.freeze(

      Object.keys(STRATEGIES)
        .map(getById)

    );

  }


  function getCurrent() {

    const personality =
      window.LAGO_AGENT_PERSONALITY
        ?.getCurrent?.();

    if (!personality) {

      return null;

    }

    return getById(
      personality.characterId
    );

  }


  /*
   * BUILD ANALYTICAL CONTEXT
   *
   * Configuration only.
   * No signal generation.
   */

  function buildContext(characterId) {

    const profile =
      getById(characterId);

    const personality =
      window.LAGO_AGENT_DNA
        ?.getProfile?.(characterId);

    if (!profile || !personality) {

      return null;

    }

    return Object.freeze({

      schemaVersion: SCHEMA_VERSION,

      characterId:
        personality.characterId,

      displayName:
        personality.displayName,

      archetype:
        personality.archetype,

      strategy: profile,

      policy: POLICY,

      marketDataAvailable: false,

      signalGenerationEnabled: false,

      backtestingAvailable: false,

      paperTradingAvailable: false,

      liveTradingAvailable: false,

      executionAuthorized: false

    });

  }


  /*
   * INTEGRITY VALIDATION
   */

  function validateRegistry() {

    const errors = [];

    const personality =
      window.LAGO_AGENT_PERSONALITY;

    const dna =
      window.LAGO_AGENT_DNA;

    const available =

      typeof personality?.getAll === "function" &&

      typeof dna?.validateRegistry === "function";


    const profiles = getAll();

    const strategyIds = new Set();


    for (const profile of profiles) {

      if (
        strategyIds.has(profile.strategyId)
      ) {

        errors.push(

          "duplicate_strategy:" +
          profile.strategyId

        );

      }

      strategyIds.add(
        profile.strategyId
      );


      if (

        profile.indicators.length === 0 ||

        profile.timeframes.length === 0 ||

        profile.conditions.length === 0 ||

        profile.learningFocus.length === 0

      ) {

        errors.push(

          "incomplete_strategy:" +
          profile.characterId

        );

      }

    }


    if (available) {

      const expected = new Set(

        personality.getAll().map(

          item => item.characterId

        )

      );


      for (const id of expected) {

        if (!buildContext(id)) {

          errors.push(

            "missing_strategy:" + id

          );

        }

      }


      for (const id of Object.keys(STRATEGIES)) {

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
        profiles.length,

      uniqueStrategyCount:
        strategyIds.size,

      liveTradingEnabled: false,

      errors:
        Object.freeze(errors)

    });

  }


  /*
   * PUBLIC API
   */

  window.LAGO_AGENT_STRATEGY =
    Object.freeze({

      version: VERSION,

      schemaVersion: SCHEMA_VERSION,

      getById,

      getAll,

      getCurrent,

      buildContext,

      validateRegistry,

      getPolicy() {

        return POLICY;

      },

      canExecuteTrades() {

        return false;

      }

    });


  document.dispatchEvent(

    new CustomEvent(

      "lago:agent-strategy-ready",

      {

        detail: validateRegistry()

      }

    )

  );

})();
