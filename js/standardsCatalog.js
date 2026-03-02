/**
 * קטלוג תקנים – מידע נפוץ ממקורות (תקנות התכנון והבנייה, ת"י, פקע"ר).
 * @type {StandardEntry[]}
 */
export const STANDARDS_CATALOG = [
  {
    id: 'head_clearance',
    title: 'גובה מזקף ראש / גובה תקרה מינימלי',
    aliases: ['מזקף ראש', 'גובה תקרה', 'גובה מינימלי', 'מרחב עמידה'],
    tags: ['גובה', 'תקרה', 'דירות', 'מבני ציבור'],
    rules: [
      { key: 'stairsHeadClearanceM', label: 'מדרגות – מזקף ראש', value: 2.1, unit: 'm', op: '>=' },
      { key: 'livingRoomsM', label: 'חדרי מגורים', value: 2.5, unit: 'm', op: '>=' },
      { key: 'smallKitchenM', label: 'מטבח קטן (עד 6 מ"ר)', value: 2.4, unit: 'm', op: '>=' },
      { key: 'bathCorridorM', label: 'חדרי שירות, מסדרונות', value: 2.2, unit: 'm', op: '>=' },
      { key: 'basementM', label: 'מרתף', value: 2.3, unit: 'm', op: '>=' },
      { key: 'publicOfficesM', label: 'מבני ציבור ומשרדים', value: 2.75, unit: 'm', op: '>=' }
    ],
    text: 'מזקף ראש: מדרגות 2.10 מ\'. דירות: מגורים 2.50 מ\', מטבח קטן 2.40 מ\', שירות/מסדרון 2.20 מ\', מרתף 2.30 מ\'. ציבור 2.75 מ\'.',
    citation: { standard: 'תקנות התכנון והבנייה, ת"י 1142' }
  },
  {
    id: 'mmad',
    title: 'ממ״ד',
    aliases: ['ממד', 'ממ"ד', 'מרחב מוגן דירתי'],
    tags: ['מיגון', 'דירות', 'בטון'],
    rules: [
      { key: 'minAreaM2', label: 'שטח נטו מינימלי', value: 9, unit: 'm2', op: '>=' },
      { key: 'minWidthM', label: 'רוחב מינימלי', value: 1.6, unit: 'm', op: '>=' },
      { key: 'minCeilingHeightM', label: 'גובה תקרה מינימלי', value: 2.5, unit: 'm', op: '>=' },
      { key: 'maxCeilingHeightM', label: 'גובה תקרה מקסימלי', value: 2.8, unit: 'm', op: '<=' },
      { key: 'wallThicknessCm', label: 'עובי קירות בטון', value: { min: 30, max: 40 }, unit: 'cm', op: 'range' }
    ],
    text: '9 מ"ר נטו. רוחב 1.60 מ\'. גובה תקרה 2.50–2.80 מ\'. קירות בטון 30/40 ס"מ.',
    citation: { standard: 'פקע"ר / תקנות' }
  },
  {
    id: 'accessibility_wc',
    title: 'נגישות – תא שירותים נגיש',
    aliases: ['נכים', 'שירותים נגישים', 'תא נגיש', 'ת"י 1918'],
    tags: ['נגישות', 'שירותים', 'דלת'],
    rules: [
      { key: 'minAreaM2', label: 'שטח מינימלי לתא', value: 3, unit: 'm2', op: '>=' },
      { key: 'minSizeM', label: 'מידות (רוחב×עומק)', value: { w: 2.0, h: 1.5 }, unit: 'm', op: '>=' },
      { key: 'turningDiameterM', label: 'קוטר סיבוב כיסא גלגלים', value: 1.5, unit: 'm', op: '>=' },
      { key: 'doorClearWidthM', label: 'רוחב דלת נטו', value: 0.9, unit: 'm', op: '>=' },
      { key: 'clearPassageCm', label: 'מעבר חופשי אסלה–קיר', value: 72, unit: 'cm', op: '>=' }
    ],
    text: 'ת"י 1918: תא נגיש 3 מ"ר, 2.0×1.5 מ\'. קוטר סיבוב 1.50 מ\'. דלת 90 ס"מ.',
    citation: { standard: 'ת״י 1918' }
  },
  {
    id: 'corridor',
    title: 'מסדרון',
    aliases: ['מסדרון ציבורי', 'נתיב מילוט', 'מילוט'],
    tags: ['תנועה', 'מילוט', 'משרדים'],
    rules: [
      { key: 'publicMinWidthM', label: 'ציבורי – רוחב מינימום', value: 1.5, unit: 'm', op: '>=' },
      { key: 'officeMinWidthM', label: 'בתוך משרד', value: 0.9, unit: 'm', op: '>=' },
      { key: 'egressMinWidthM', label: 'נתיב מילוט', value: 1.1, unit: 'm', op: '>=' }
    ],
    text: 'ציבורי: 1.50 מ\'. משרד: 90 ס"מ. נתיב מילוט: 1.10 מ\'.',
    citation: { standard: 'תקנות/ת״י' }
  },
  {
    id: 'doors',
    title: 'דלתות',
    aliases: ['דלת', 'דלת ממד', 'דלת מילוט'],
    tags: ['פתחים', 'מילוט', 'ממ״ד'],
    rules: [
      { key: 'egressDoorClearWidthM', label: 'דלת מילוט – נטו', value: 0.9, unit: 'm', op: '>=' },
      { key: 'mmadDoorClearWidthM', label: 'דלת ממ״ד – נטו', value: 0.8, unit: 'm', op: '>=' },
      { key: 'minHeightM', label: 'גובה מינימום', value: 2.0, unit: 'm', op: '>=' }
    ],
    text: 'מילוט: 90 ס"מ. ממ״ד: 80 ס"מ. גובה: 2.00 מ\'.',
    citation: { standard: 'תקנות/ת״י' }
  },
  {
    id: 'stairs',
    title: 'מדרגות',
    aliases: ['מדרגות', 'רום', 'שלח', 'ת"י 1142'],
    tags: ['תנועה', 'מילוט', 'ת"י 1142'],
    rules: [
      { key: 'headClearanceM', label: 'מזקף ראש (חוץ/מוצא)', value: 2.1, unit: 'm', op: '>=' },
      { key: 'maxRiserCm', label: 'רום מקסימום', value: 17.5, unit: 'cm', op: '<=' },
      { key: 'minRiserCm', label: 'רום מינימום', value: 10, unit: 'cm', op: '>=' },
      { key: 'minTreadCm', label: 'שלח מינימום', value: 26, unit: 'cm', op: '>=' },
      { key: 'minWidthM', label: 'רוחב מינימום', value: 1.1, unit: 'm', op: '>=' },
      { key: 'handrailHeightCm', label: 'גובה מעקה', value: 105, unit: 'cm', op: '>=' }
    ],
    text: 'ת"י 1142: מזקף ראש 2.10 מ\'. רום 10–17.5 ס"מ, שלח 26 ס"מ. רוחב 1.10 מ\'. מעקה 105 ס"מ.',
    citation: { standard: 'ת״י 1142' }
  },
  {
    id: 'accessible_parking',
    title: 'חניה נגישה (נכים)',
    aliases: ['חניית נכה', 'חניה נגישה'],
    tags: ['נגישות', 'חניה'],
    rules: [
      { key: 'minWidthStandardM', label: 'רוחב (רכב רגיל)', value: 3.5, unit: 'm', op: '>=' },
      { key: 'minWidthWithLiftM', label: 'רוחב עם מעלון', value: 5.0, unit: 'm', op: '>=' },
      { key: 'minLengthM', label: 'אורך מינימלי', value: 5.0, unit: 'm', op: '>=' }
    ],
    text: 'רוחב 3.50 מ\' או 5.00 מ\' עם מעלון. אורך 5 מ\'.',
    citation: { standard: 'חוק שוויון זכויות' }
  },
  {
    id: 'fire_access',
    title: 'דרך גישה לרכב כיבוי אש',
    aliases: ['רכב כיבוי', 'דרך גישה כבאים'],
    tags: ['בטיחות אש', 'כיבוי'],
    rules: [
      { key: 'minWidthNetM', label: 'רוחב נטו מינימלי', value: 3.5, unit: 'm', op: '>=' },
      { key: 'minWidthGrossM', label: 'רוחב ברוטו', value: 4.0, unit: 'm', op: '>=' }
    ],
    text: 'רוחב נטו 3.50 מ\', ברוטו 4.00 מ\'.',
    citation: { standard: 'הנחיות כבאות' }
  }
];
