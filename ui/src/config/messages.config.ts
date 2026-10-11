export const TOOLTIP_TEXTS = {
  yourText: "This is the main text you want the AI to enhance or rewrite.",
  context: "Provide any background information here, like a previous email in a thread, to give the AI better context for its response.",
  aiPipelines: "Select a workflow to see its AI Assistants. Each assistant in the active workflow will run in parallel to process your text.",
  addConfig: "Add a new AI Assistant to the workflow below.",
  model: "Choose the underlying AI model. Different models have different capabilities and speeds.",
  aiRole: "The AI Role sets the AI's primary job: general text editing or professional email writing.",
  configOptions: "Fine-tune the behavior of the currently selected AI configuration from your pipeline.",
  improve: "Rewrites sentences for better clarity, flow, and engagement.",
  fixMistakes: "Corrects spelling, grammar, and punctuation errors.",
  format: "Applies formatting like lists and paragraphs for better readability.",
  shorten: "Condenses the text to be more concise while keeping the core message.",
  lengthen: "Expands on the original text to be more detailed or descriptive.",
  addEmojis: "Adds relevant emojis to make the text more expressive.",
  avoidCommonAiSymbols: "Instructs the model to remove em dashes, including those in source quotations or code, and prefer simpler punctuation and phrasing. Required formatting and enabled emojis remain allowed.",
  formality: "Adjusts the language to be casual, neutral, or professional.",
  tone: "Sets the emotional style of the writing (e.g., Confident, Witty, Polite).",
  level: "Adjusts the complexity of the language. When a translation is selected, this adjusts the translated text's level. Otherwise, it adjusts the original language.",
  translateTo: "Generates the final, enhanced text directly in the specified language.",
  applyWorkflow: "Select a saved workflow to apply its pipeline, or choose '+ Create New Workflow' to start from scratch.",
  saveWorkflow: "Save your entire AI pipeline and its configurations as a reusable workflow.",
  useThisText: "Copies this text to the 'Your Text' field to prepare for another enhancement."
};

export const ERROR_MESSAGES: Record<string, string> = {
  BATCH_SIZE_EXCEEDED: "Too many assistants selected. Please reduce the number of enabled assistants.",
  EMPTY_BATCH: "No assistants are enabled. Please enable at least one assistant.",
  AUTHENTICATION_FAILED: "Your session could not be restored. Please reload the page.",
  AUTHORIZATION_FAILED: "This feature is unavailable in the public demo.",
  NOT_FOUND: "Service is temporarily unavailable. Please try again later.",
  QUOTA_EXCEEDED: "You've reached this week's usage limit. It resets Monday at 00:00 UTC.",
  INTERNAL_ERROR: "A server error occurred. Please try again in a few moments.",
  LLM_ERROR: "The AI service is temporarily unavailable. Please try again."
};

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_QUOTA: "You've reached this week's token allowance. It resets Monday at 00:00 UTC.",
  MODEL_ACCESS_DENIED: "This model is unavailable in the public demo.",
  USER_TEXT_LIMIT_EXCEEDED: "Your text exceeds the maximum length. Please shorten it.",
  CONTEXT_TEXT_LIMIT_EXCEEDED: "Your context exceeds the maximum length. Please shorten it.",
  TIER_BATCH_SIZE_EXCEEDED: "You've reached the maximum number of assistants.",
  INVALID_TOKEN: "Your session expired. Please reload the page.",
  USER_BLOCKED: "Access is unavailable.",
  AUTHENTICATION_FAILED: "Your session could not be restored. Please reload the page.",
};
