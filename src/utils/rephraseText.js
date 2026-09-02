const phraseReplacements = [
  [/\bmousee\b/gi, "mouse"],
  [/\bmose\b/gi, "mouse"],
  [/\bmousse\b/gi, "mouse"],
  [/\bkeybord\b/gi, "keyboard"],
  [/\bkeybaord\b/gi, "keyboard"],
  [/\bmoniter\b/gi, "monitor"],
  [/\bmonitr\b/gi, "monitor"],
  [/\bprintar\b/gi, "printer"],
  [/\bprinterr\b/gi, "printer"],
  [/\bscannar\b/gi, "scanner"],
  [/\bscaner\b/gi, "scanner"],
  [/\binternate\b/gi, "internet"],
  [/\binternettt\b/gi, "internet"],
  [/\bwifi\b/gi, "Wi-Fi"],
  [/\bwi fi\b/gi, "Wi-Fi"],
  [/\bconection\b/gi, "connection"],
  [/\bconnecton\b/gi, "connection"],
  [/\bavilable\b/gi, "available"],
  [/\bavialable\b/gi, "available"],
  [/\bsoftwere\b/gi, "software"],
  [/\bhardwere\b/gi, "hardware"],
  [/\bsystm\b/gi, "system"],
  [/\bsytem\b/gi, "system"],
  [/\bcomputr\b/gi, "computer"],
  [/\bcompuer\b/gi, "computer"],
  [/\blaptp\b/gi, "laptop"],
  [/\bladptop\b/gi, "laptop"],
  [/\bwrking\b/gi, "working"],
  [/\bwroking\b/gi, "working"],
  [/\bpropery\b/gi, "properly"],
  [/\bproparly\b/gi, "properly"],
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
  text = text.replace(/\bnot available\b/gi, "is not available");
  text = text.replace(/\bis is not available\b/gi, "is not available");
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
