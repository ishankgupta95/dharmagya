import { deityColors } from './theme';

export interface DeityMeta {
  id: string;        // URL-safe slug, e.g. "ganesh"
  name: string;      // Matches DB `deity` column, e.g. "Ganesh"
  nameHindi: string; // Devanagari name
  displayName: string; // Respectful display name with honorifics
  initial: string;   // Devanagari initial for DeityAvatar
  color: string;     // From deityColors
  description: string; // Short one-line Hindi description
}

export const ALL_DEITIES: DeityMeta[] = [
  { id: 'ganesh',        name: 'Ganesh',        nameHindi: 'गणेश',       displayName: 'श्री गणेश जी',      initial: 'ग',  color: deityColors.Ganesh,          description: 'विघ्नहर्ता, प्रथम पूज्य' },
  { id: 'shiva',         name: 'Shiva',         nameHindi: 'शिव',        displayName: 'भगवान शिव',         initial: 'श',  color: deityColors.Shiva,           description: 'महादेव, संहारकर्ता' },
  { id: 'vishnu',        name: 'Vishnu',        nameHindi: 'विष्णु',     displayName: 'भगवान विष्णु',      initial: 'वि', color: deityColors.Vishnu,          description: 'पालनहार, जगत के रक्षक' },
  { id: 'hanuman',       name: 'Hanuman',       nameHindi: 'हनुमान',     displayName: 'श्री हनुमान जी',    initial: 'ह',  color: deityColors.Hanuman,         description: 'बजरंगबली, राम भक्त' },
  { id: 'lakshmi',       name: 'Lakshmi',       nameHindi: 'लक्ष्मी',    displayName: 'माँ लक्ष्मी',       initial: 'ल',  color: deityColors.Lakshmi,         description: 'धन और समृद्धि की देवी' },
  { id: 'krishna',       name: 'Krishna',       nameHindi: 'कृष्ण',      displayName: 'श्री कृष्ण जी',     initial: 'कृ', color: deityColors.Krishna,         description: 'गोविन्द, गीता उपदेशक' },
  { id: 'rama',          name: 'Rama',          nameHindi: 'राम',        displayName: 'श्री राम जी',       initial: 'रा', color: deityColors.Rama,            description: 'मर्यादा पुरुषोत्तम' },
  { id: 'durga',         name: 'Durga',         nameHindi: 'दुर्गा',     displayName: 'माँ दुर्गा',        initial: 'दु', color: deityColors.Durga,           description: 'शक्ति स्वरूपा, महिषासुरमर्दिनी' },
  { id: 'saraswati',     name: 'Saraswati',     nameHindi: 'सरस्वती',    displayName: 'माँ सरस्वती',       initial: 'स',  color: deityColors.Saraswati,       description: 'विद्या और कला की देवी' },
  { id: 'parvati',       name: 'Parvati',       nameHindi: 'पार्वती',    displayName: 'माँ पार्वती',       initial: 'पा', color: deityColors.Parvati,         description: 'शिव अर्धांगिनी, जगदम्बा' },
  { id: 'kali',          name: 'Kali',          nameHindi: 'काली',       displayName: 'माँ काली',          initial: 'का', color: deityColors.Kali,            description: 'महाकाली, भयहारिणी' },
  { id: 'surya',         name: 'Surya',         nameHindi: 'सूर्य',      displayName: 'सूर्य देव',         initial: 'सू', color: deityColors.Surya,           description: 'सूर्य देव, प्रकाश दाता' },
  { id: 'kartikeya',     name: 'Kartikeya',     nameHindi: 'कार्तिकेय',  displayName: 'भगवान कार्तिकेय',   initial: 'का', color: deityColors.Kartikeya,       description: 'देवसेनापति, षडानन' },
  { id: 'brahma',        name: 'Brahma',        nameHindi: 'ब्रह्मा',    displayName: 'भगवान ब्रह्मा',     initial: 'ब्र', color: deityColors.Brahma,          description: 'सृष्टिकर्ता, चतुर्मुख' },
  { id: 'sai-baba',      name: 'Sai Baba',      nameHindi: 'साईं बाबा',  displayName: 'श्री साईं बाबा',    initial: 'सा', color: deityColors['Sai Baba'],     description: 'शिर्डी वाले, सबका मालिक एक' },
  { id: 'jagannath',     name: 'Jagannath',     nameHindi: 'जगन्नाथ',   displayName: 'भगवान जगन्नाथ',    initial: 'ज',  color: deityColors.Jagannath,       description: 'जगत के नाथ, पुरी धाम' },
  { id: 'santoshi-mata', name: 'Santoshi Mata', nameHindi: 'संतोषी माता', displayName: 'संतोषी माता',       initial: 'सं', color: deityColors['Santoshi Mata'], description: 'संतोष और सुख की देवी' },
  { id: 'radha',         name: 'Radha',         nameHindi: 'राधा',       displayName: 'श्री राधा जी',      initial: 'रा', color: deityColors.Radha,           description: 'कृष्ण प्रिया, प्रेम स्वरूपा' },
  { id: 'sita',          name: 'Sita',          nameHindi: 'सीता',       displayName: 'माता सीता जी',      initial: 'सी', color: deityColors.Sita,            description: 'जानकी, राम अर्धांगिनी' },
  { id: 'venkateswara',  name: 'Venkateswara',  nameHindi: 'वेंकटेश्वर', displayName: 'भगवान वेंकटेश्वर',  initial: 'वें', color: deityColors.Venkateswara,    description: 'तिरुपति बालाजी, कलियुग के देव' },
  { id: 'khatu-shyam',   name: 'Khatu Shyam',   nameHindi: 'खाटू श्याम', displayName: 'श्री खाटू श्याम जी', initial: 'खा', color: deityColors['Khatu Shyam'],  description: 'बर्बरीक, हारे का सहारा' },
  { id: 'ayyappa',       name: 'Ayyappa',       nameHindi: 'अय्यप्पा',   displayName: 'भगवान अय्यप्पा',    initial: 'अ',  color: deityColors.Ayyappa,         description: 'शबरीमला के स्वामी, धर्मशास्ता' },
  { id: 'vaishno-devi',  name: 'Vaishno Devi',  nameHindi: 'वैष्णो देवी', displayName: 'माँ वैष्णो देवी',   initial: 'वै', color: deityColors['Vaishno Devi'], description: 'त्रिकूट पर्वत वासिनी, जगजननी' },
  { id: 'narasimha',     name: 'Narasimha',     nameHindi: 'नरसिंह',     displayName: 'भगवान नरसिंह',      initial: 'नर', color: deityColors.Narasimha,       description: 'प्रह्लाद रक्षक, उग्र अवतार' },
  { id: 'dattatreya',    name: 'Dattatreya',    nameHindi: 'दत्तात्रेय',  displayName: 'भगवान दत्तात्रेय',   initial: 'द',  color: deityColors.Dattatreya,      description: 'त्रिदेव स्वरूप, अवधूत' },
  { id: 'ganga',         name: 'Ganga',         nameHindi: 'गंगा',       displayName: 'माँ गंगा',          initial: 'गं', color: deityColors.Ganga,           description: 'पतित पावनी, मोक्षदायिनी' },
];

export const DEITY_BY_ID = Object.fromEntries(ALL_DEITIES.map(d => [d.id, d])) as Record<string, DeityMeta>;
export const DEITY_BY_NAME = Object.fromEntries(ALL_DEITIES.map(d => [d.name, d])) as Record<string, DeityMeta>;
