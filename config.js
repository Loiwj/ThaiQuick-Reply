// ⚠️ API keys mặc định. Thay đổi trong tab ⚙️ API của extension.
globalThis.THAIQUICK_CONFIG = {
  // Gemini (Google AI)
  geminiKeys: [
    // ""
  ],
  geminiModel: "gemini-3.1-flash-lite-preview",

  // Kimi (Moonshot AI)
  kimiKey: "",
  kimiModel: "k2p5",

  // Cloudflare Workers AI (free models)
  cfAccountId: "",
  cfApiToken: "",
  cfModel: "@cf/meta/llama-3-8b-instruct",

  // CLIproxyAPI (OpenAI-compatible proxy)
  cliproxyUrl: "http://localhost:8317",
  cliproxyModel: "GPT-5.3-Codex",
  cliproxyApiKey: "",
  cliproxyManagementKey: "",

  // ZuneF Server (OpenAI Protocol)
  zunefUrl: "https://claude.zunef.com/v1",
  zunefApiKey: "",
  zunefModel: "claude-sonnet-4-20250514",

  // Default provider: "gemini", "kimi", "cloudflare", "cliproxy", or "zunef"
  defaultProvider: "gemini"
};
