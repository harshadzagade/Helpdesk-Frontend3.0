const phraseReplacements = [
  [/\bplz\b/gi, "please"],
  [/\bpls\b/gi, "please"],
  [/\breq\b/gi, "request"],
  [/\bprob\b/gi, "problem"],
  [/\bprblm\b/gi, "problem"],
  [/\bnot working\b/gi, "is not working"],
  [/\bdoesnt\b/gi, "does not"],
  [/\bdon't\b/gi, "do not"],
  [/\bcant\b/gi, "cannot"],
  [/\bcan't\b/gi, "cannot"],
  [/\burjent\b/gi, "urgent"],
  [/\bissue in\b/gi, "issue with"],
];

export const htmlToPlainText = (html = "") => {
  if (typeof document === "undefined") {
    return String(html || "").replace(/<[^>]+>/g, " ");
  }

  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent || element.innerText || "";
};

export const rephraseSentence = (value = "") => {
  let text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();

  phraseReplacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text.replace(/\bis is not working\b/gi, "is not working");
  text = text.replace(/\bi\b/g, "I");

  if (!text) return "";

  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (!/[.!?]$/.test(text)) {
    text += ".";
  }

  return text;
};

export const rephraseHtmlDescription = (html = "") => {
  const text = rephraseSentence(htmlToPlainText(html));
  return text ? `<p>${text}</p>` : "";
};
