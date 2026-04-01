import { deityColors } from './theme';

export interface DeityMeta {
  id: string;        // URL-safe slug, e.g. "ganesh"
  name: string;      // Matches DB `deity` column, e.g. "Ganesh"
  nameHindi: string; // Devanagari name
  initial: string;   // Devanagari initial for DeityAvatar
  color: string;     // From deityColors
  description: string; // Short one-line Hindi description
}

export const ALL_DEITIES: DeityMeta[] = [
  { id: 'ganesh',        name: 'Ganesh',        nameHindi: 'गणेश',       initial: 'ग',  color: deityColors.Ganesh,          description: 'विघ्नहर्ता, प्रथम पूज्य' },
  { id: 'shiva',         name: 'Shiva',         nameHindi: 'शिव',        initial: 'श',  color: deityColors.Shiva,           description: 'महादेव, संहारकर्ता' },
  { id: 'vishnu',        name: 'Vishnu',        nameHindi: 'विष्णु',     initial: 'वि', color: deityColors.Vishnu,          description: 'पालनहार, जगत के रक्षक' },
  { id: 'hanuman',       name: 'Hanuman',       nameHindi: 'हनुमान',     initial: 'ह',  color: deityColors.Hanuman,         description: 'बजरंगबली, राम भक्त' },
  { id: 'lakshmi',       name: 'Lakshmi',       nameHindi: 'लक्ष्मी',    initial: 'ल',  color: deityColors.Lakshmi,         description: 'धन और समृद्धि की देवी' },
  { id: 'krishna',       name: 'Krishna',       nameHindi: 'कृष्ण',      initial: 'कृ', color: deityColors.Krishna,         description: 'गोविन्द, गीता उपदेशक' },
  { id: 'rama',          name: 'Rama',          nameHindi: 'राम',        initial: 'रा', color: deityColors.Rama,            description: 'मर्यादा पुरुषोत्तम' },
  { id: 'durga',         name: 'Durga',         nameHindi: 'दुर्गा',     initial: 'दु', color: deityColors.Durga,           description: 'शक्ति स्वरूपा, महिषासुरमर्दिनी' },
  { id: 'saraswati',     name: 'Saraswati',     nameHindi: 'सरस्वती',    initial: 'स',  color: deityColors.Saraswati,       description: 'विद्या और कला की देवी' },
  { id: 'parvati',       name: 'Parvati',       nameHindi: 'पार्वती',    initial: 'पा', color: deityColors.Parvati,         description: 'शिव अर्धांगिनी, जगदम्बा' },
  { id: 'kali',          name: 'Kali',          nameHindi: 'काली',       initial: 'का', color: deityColors.Kali,            description: 'महाकाली, भयहारिणी' },
  { id: 'surya',         name: 'Surya',         nameHindi: 'सूर्य',      initial: 'सू', color: deityColors.Surya,           description: 'सूर्य देव, प्रकाश दाता' },
  { id: 'kartikeya',     name: 'Kartikeya',     nameHindi: 'कार्तिकेय',  initial: 'का', color: deityColors.Kartikeya,       description: 'देवसेनापति, षडानन' },
  { id: 'brahma',        name: 'Brahma',        nameHindi: 'ब्रह्मा',    initial: 'ब्र', color: deityColors.Brahma,          description: 'सृष्टिकर्ता, चतुर्मुख' },
  { id: 'sai-baba',      name: 'Sai Baba',      nameHindi: 'साईं बाबा',  initial: 'सा', color: deityColors['Sai Baba'],     description: 'शिर्डी वाले, सबका मालिक एक' },
  { id: 'jagannath',     name: 'Jagannath',     nameHindi: 'जगन्नाथ',   initial: 'ज',  color: deityColors.Jagannath,       description: 'जगत के नाथ, पुरी धाम' },
  { id: 'santoshi-mata', name: 'Santoshi Mata', nameHindi: 'संतोषी माता', initial: 'सं', color: deityColors['Santoshi Mata'], description: 'संतोष और सुख की देवी' },
  { id: 'radha',         name: 'Radha',         nameHindi: 'राधा',       initial: 'रा', color: deityColors.Radha,           description: 'कृष्ण प्रिया, प्रेम स्वरूपा' },
];

export const DEITY_BY_ID = Object.fromEntries(ALL_DEITIES.map(d => [d.id, d])) as Record<string, DeityMeta>;
export const DEITY_BY_NAME = Object.fromEntries(ALL_DEITIES.map(d => [d.name, d])) as Record<string, DeityMeta>;
