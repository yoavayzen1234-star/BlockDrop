export const SCALE = 12;
export const SNAP_THRESHOLD = 8;
export const WORKSPACE_SIZE = 50000;
/** Global origin: center of infinite canvas. Logical (0,0) = CSS (WORKSPACE_OFFSET, WORKSPACE_OFFSET) = [25000, 25000]. */
export const WORKSPACE_OFFSET = WORKSPACE_SIZE / 2;
export const GLOBAL_ORIGIN = [WORKSPACE_OFFSET, WORKSPACE_OFFSET];

/** Escape for safe use in HTML text (not attributes). */
export function escapeHtml(s) {
    if (s == null) return '';
    const t = String(s);
    return t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export const STANDARDS_DATA = {
    "ממד": "9 מ\"ר נטו מינימום. רוחב 1.60 מ' מינימום. קירות בטון 30/40 ס\"מ.",
    "נכים": "תא נגיש 1.50/2.00 מ'. רדיוס סיבוב 1.50 מ'. דלת 90 ס\"מ נפתחת החוצה.",
    "מסדרון": "ציבורי: 1.50 מ'. בתוך משרד: 90 ס\"מ. נתיב מילוט: 1.10 מ'.",
    "דלת": "נטו במילוט: 90 ס\"מ. דלת ממ\"ד: 80 ס\"מ. גובה: 2.00 מ'.",
    "מדרגות": "רום מקס' 17.5 ס\"מ. שלח מינימום 30 ס\"מ. רוחב: 1.10 מ'."
};
