import api from "./api";
import { rephraseHtmlDescription, rephraseSentence } from "../utils/rephraseText";

export const rephraseSubjectText = async (text) => {
  try {
    const res = await api.post("/api/dashboard/rephrase-text", { text, format: "text" });
    return res.data?.data?.text || rephraseSentence(text);
  } catch (error) {
    console.warn("Dictionary rephrase failed, using local fallback", error.message);
    return rephraseSentence(text);
  }
};

export const rephraseDescriptionHtml = async (html) => {
  try {
    const res = await api.post("/api/dashboard/rephrase-text", { text: html, format: "html" });
    return res.data?.data?.text || rephraseHtmlDescription(html);
  } catch (error) {
    console.warn("Dictionary rephrase failed, using local fallback", error.message);
    return rephraseHtmlDescription(html);
  }
};
