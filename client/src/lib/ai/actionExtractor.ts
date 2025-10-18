/**
 * Helper to extract structured actions from assistant replies.
 * It looks for a fenced ```json block or for the first {...} JSON object in the reply.
 * Returns the parsed object.actions array or null if none found/invalid.
 */

export function extractActionsFromReply(reply: string): any[] | null {
  if (!reply || typeof reply !== 'string') return null;

  // Try to find a ```json ... ``` fenced block first
  const fencedJsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/i);
  let jsonText: string | null = null;

  if (fencedJsonMatch && fencedJsonMatch[1]) {
    jsonText = fencedJsonMatch[1].trim();
  } else {
    // Fallback: find the first { ... } block
    const firstBrace = reply.indexOf('{');
    const lastBrace = reply.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = reply.substring(firstBrace, lastBrace + 1).trim();
    }
  }

  if (!jsonText) return null;

  // Try to clean common markdown wrapping and trailing text
  // Remove surrounding backticks if any remain
  jsonText = jsonText.replace(/^```+|```+$/g, '').trim();

  try {
    const parsed = JSON.parse(jsonText);

    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.actions)) return null;

    // Basic validation of each action (must have a string 'type')
    for (const a of parsed.actions) {
      if (!a || typeof a !== 'object' || typeof a.type !== 'string') {
        return null;
      }
    }

    return parsed.actions;
  } catch (e) {
    // If parsing fails, give up — don't try to be too clever
    console.error('actionExtractor: JSON parse failed', e);
    return null;
  }
}

export default extractActionsFromReply;
