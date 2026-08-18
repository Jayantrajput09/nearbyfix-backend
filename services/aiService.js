// services/aiService.js

// =====================================================
// NEARBYFIX AI SERVICE
// =====================================================
// This version does NOT require OpenAI/Gemini/Ollama.
// It provides a reliable local AI-style diagnosis system.
//
// Later we can replace this with a real AI provider.
// =====================================================

const SERVICE_RULES = [
  {
    service: "electrician",
    keywords: [
      "fan",
      "pankha",
      "light",
      "bulb",
      "switch",
      "socket",
      "wire",
      "wiring",
      "electric",
      "electricity",
      "bijli",
      "current",
      "power",
      "voltage",
      "mcb",
      "short circuit",
    ],
    reply:
      "Aapki problem electrical related lag rahi hai. ⚡ Electrician technician suitable rahega.",
  },

  {
    service: "plumber",
    keywords: [
      "pipe",
      "tap",
      "nal",
      "leak",
      "leakage",
      "water",
      "paani",
      "drain",
      "drainage",
      "sink",
      "toilet",
      "flush",
      "tank",
    ],
    reply:
      "Ye plumbing related problem lag rahi hai. 🔧 Plumber technician suitable rahega.",
  },

  {
    service: "ac-repair",
    keywords: [
      "ac",
      "air conditioner",
      "cooling",
      "cool nahi",
      "cooling nahi",
      "thanda",
      "compressor",
      "gas",
      "ac gas",
      "split ac",
      "window ac",
    ],
    reply:
      "AC mein cooling/service issue lag raha hai. ❄️ AC Repair technician suitable rahega.",
  },

  {
    service: "carpenter",
    keywords: [
      "door",
      "darwaza",
      "furniture",
      "wood",
      "wooden",
      "lakdi",
      "table",
      "chair",
      "bed",
      "cabinet",
      "drawer",
      "almirah",
    ],
    reply:
      "Ye furniture/woodwork related problem lag rahi hai. 🪚 Carpenter suitable rahega.",
  },

  {
    service: "mechanic",
    keywords: [
      "bike",
      "car",
      "vehicle",
      "gaadi",
      "gadi",
      "engine",
      "tyre",
      "tire",
      "brake",
      "clutch",
      "battery",
      "scooty",
      "motorcycle",
      "car repair",
    ],
    reply:
      "Vehicle related problem lag rahi hai. 🚗 Mechanic technician suitable rahega.",
  },

  {
    service: "appliance-repair",
    keywords: [
      "fridge",
      "refrigerator",
      "washing machine",
      "microwave",
      "oven",
      "cooler",
      "geyser",
      "appliance",
      "tv",
      "television",
    ],
    reply:
      "Ye home appliance related problem lag rahi hai. 🔌 Appliance Repair technician suitable rahega.",
  },
];

// =====================================================
// NORMALIZE TEXT
// =====================================================

const normalizeText = (text) => {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
};

// =====================================================
// FIND SERVICE
// =====================================================

const detectService = (message) => {
  const text = normalizeText(message);

  for (const rule of SERVICE_RULES) {
    const matchedKeyword = rule.keywords.find((keyword) =>
      text.includes(keyword)
    );

    if (matchedKeyword) {
      return {
        service: rule.service,
        reply: rule.reply,
        matchedKeyword,
      };
    }
  }

  return null;
};

// =====================================================
// AI SUGGESTION
// =====================================================

const getSuggestion = async (message) => {
  const text = normalizeText(message);

  if (!text) {
    return {
      success: false,
      reply: "Please describe your problem.",
      suggestedService: null,
    };
  }

  // Greeting
  const greetings = [
    "hi",
    "hello",
    "hey",
    "namaste",
    "hii",
    "helo",
  ];

  if (greetings.some((word) => text === word)) {
    return {
      success: true,
      reply:
        "Namaste 👋 Main NearbyFix Assistant hoon. Aap apni repair problem Hindi ya English mein batao.",
      suggestedService: null,
    };
  }

  // Detect service
  const result = detectService(text);

  if (result) {
    return {
      success: true,
      reply: result.reply,
      suggestedService: result.service,
      matchedKeyword: result.matchedKeyword,
    };
  }

  // General response
  return {
    success: true,
    reply:
      "Mujhe problem samajhne ke liye thoda aur detail batao. Jaise: fan kaam nahi kar raha, pipe leak ho raha hai, AC cooling nahi kar raha, bike start nahi ho rahi, etc.",
    suggestedService: null,
  };
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getSuggestion,
  detectService,
};