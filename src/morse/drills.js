/**
 * Common CW shorthand and on-air exchanges for send practice.
 * Prosigns are written as `<AR>`, `<BT>`, `<KN>`, `<SK>` and keyed as one
 * character with no inter-letter gap. Callsigns are fictional.
 */

/** @typedef {"abbrev" | "qcode" | "numbers" | "qso"} DrillCategory */
/** @typedef {{ text: string, meaning: string, category: DrillCategory }} Drill */

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "abbrev", label: "Abbrev" },
  { id: "qcode", label: "Q-codes" },
  { id: "numbers", label: "Numbers" },
  { id: "qso", label: "QSO" },
  { id: "missed", label: "Missed" },
];

/** @type {Drill[]} */
export const DRILLS = [
  // Abbreviations
  { text: "CQ", meaning: "Calling any station", category: "abbrev" },
  { text: "DE", meaning: "From / this is", category: "abbrev" },
  { text: "K", meaning: "Over — any station may reply", category: "abbrev" },
  { text: "<KN>", meaning: "Over — only the station called may reply", category: "abbrev" },
  { text: "BK", meaning: "Break — quick back-and-forth", category: "abbrev" },
  { text: "R", meaning: "Roger — received", category: "abbrev" },
  { text: "TNX", meaning: "Thanks", category: "abbrev" },
  { text: "TU", meaning: "Thank you", category: "abbrev" },
  { text: "FB", meaning: "Fine business — great", category: "abbrev" },
  { text: "OM", meaning: "Old man — any male operator", category: "abbrev" },
  { text: "YL", meaning: "Young lady — any female operator", category: "abbrev" },
  { text: "ES", meaning: "And", category: "abbrev" },
  { text: "HR", meaning: "Here", category: "abbrev" },
  { text: "UR", meaning: "Your / you are", category: "abbrev" },
  { text: "FER", meaning: "For", category: "abbrev" },
  { text: "AGN", meaning: "Again", category: "abbrev" },
  { text: "PSE", meaning: "Please", category: "abbrev" },
  { text: "CUL", meaning: "See you later", category: "abbrev" },
  { text: "GM", meaning: "Good morning", category: "abbrev" },
  { text: "GA", meaning: "Good afternoon / go ahead", category: "abbrev" },
  { text: "GE", meaning: "Good evening", category: "abbrev" },
  { text: "GN", meaning: "Good night", category: "abbrev" },
  { text: "WX", meaning: "Weather", category: "abbrev" },
  { text: "RIG", meaning: "Radio / station equipment", category: "abbrev" },
  { text: "ANT", meaning: "Antenna", category: "abbrev" },
  { text: "PWR", meaning: "Power", category: "abbrev" },
  { text: "RST", meaning: "Readability, strength, tone report", category: "abbrev" },
  { text: "<AR>", meaning: "End of message", category: "abbrev" },
  { text: "<BT>", meaning: "Pause / new paragraph", category: "abbrev" },
  { text: "<SK>", meaning: "End of contact", category: "abbrev" },

  // Q-codes
  { text: "QTH", meaning: "My location is…", category: "qcode" },
  { text: "QRZ", meaning: "Who is calling me?", category: "qcode" },
  { text: "QSL", meaning: "I acknowledge receipt", category: "qcode" },
  { text: "QRM", meaning: "Man-made interference", category: "qcode" },
  { text: "QRN", meaning: "Static / natural noise", category: "qcode" },
  { text: "QSB", meaning: "Your signal is fading", category: "qcode" },
  { text: "QRS", meaning: "Send more slowly", category: "qcode" },
  { text: "QRQ", meaning: "Send faster", category: "qcode" },
  { text: "QRL", meaning: "Is this frequency in use?", category: "qcode" },
  { text: "QSY", meaning: "Change frequency", category: "qcode" },
  { text: "QRT", meaning: "Stop sending / closing station", category: "qcode" },
  { text: "QSO", meaning: "A contact / conversation", category: "qcode" },
  { text: "QRP", meaning: "Low power", category: "qcode" },

  // Numbers and reports
  { text: "73", meaning: "Best regards", category: "numbers" },
  { text: "88", meaning: "Love and kisses", category: "numbers" },
  { text: "599", meaning: "Perfect signal report", category: "numbers" },
  { text: "5NN", meaning: "599 with cut numbers (N = 9)", category: "numbers" },
  { text: "RST 579", meaning: "Readable, good strength, clean tone", category: "numbers" },
  { text: "33", meaning: "Fraternal greetings (YL to YL)", category: "numbers" },
  { text: "PWR 100W", meaning: "Running 100 watts", category: "numbers" },
  { text: "UR 559", meaning: "Your report is 559", category: "numbers" },

  // QSO lines — a typical ragchew, in order
  { text: "CQ CQ CQ DE K2XYZ K2XYZ K", meaning: "General call from K2XYZ", category: "qso" },
  { text: "K2XYZ DE N3ABC <KN>", meaning: "N3ABC answers K2XYZ only", category: "qso" },
  { text: "N3ABC DE K2XYZ GM TNX FER CALL", meaning: "Good morning, thanks for the call", category: "qso" },
  { text: "UR RST 599 5NN", meaning: "Your signal report is 599", category: "qso" },
  { text: "NAME BOB QTH OHIO", meaning: "My name is Bob, location Ohio", category: "qso" },
  { text: "HW CPY <BT>", meaning: "How do you copy? (pause)", category: "qso" },
  { text: "R R FB OM UR 579", meaning: "Received, great, your report 579", category: "qso" },
  { text: "RIG HR IS QRP 5W ES ANT DIPOLE", meaning: "Low-power 5 W rig and a dipole", category: "qso" },
  { text: "WX HR SUNNY ES WARM", meaning: "Weather here is sunny and warm", category: "qso" },
  { text: "TNX FER QSO 73 <SK>", meaning: "Thanks for the contact, best regards, end", category: "qso" },
  { text: "QRZ DE K2XYZ K", meaning: "Who is calling? This is K2XYZ", category: "qso" },
  { text: "PSE QRS PSE QRS", meaning: "Please send more slowly", category: "qso" },
  { text: "QRL QRL DE N3ABC", meaning: "Is this frequency in use? This is N3ABC", category: "qso" },
];

/**
 * Split text into words, and words into committed tokens (`<AR>` is one token).
 * Characters with no Morse code are dropped.
 * @param {string} text
 * @param {(token: string) => boolean} isKnown
 * @returns {string[][]}
 */
export function tokenize(text, isKnown) {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => (word.match(/<[A-Z]{2}>|./g) || []).filter(isKnown))
    .filter((tokens) => tokens.length > 0);
}
