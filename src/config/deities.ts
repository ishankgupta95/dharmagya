import type { Deity } from 'hindu-devotional-texts';

import { deityColors } from './theme';

export interface DeityMeta {
  id: Deity;         // Slug — matches `Deity` from hindu-devotional-texts (e.g. "ganesha")
  name: string;      // English display name (e.g. "Ganesha")
  nameHindi: string; // Devanagari name
  displayName: string; // Respectful display name with honorifics
  initial: string;   // Devanagari initial for DeityAvatar
  color: string;     // From deityColors
  description: string; // Short one-line Hindi description
}

export const ALL_DEITIES: DeityMeta[] = [
  { id: 'ganesha',       name: 'Ganesha',       nameHindi: 'गणेश',       displayName: 'श्री गणेश जी',      initial: 'ग',  color: deityColors.ganesha,         description: 'विघ्नहर्ता, प्रथम पूज्य' },
  { id: 'shiva',         name: 'Shiva',         nameHindi: 'शिव',        displayName: 'भगवान शिव',         initial: 'श',  color: deityColors.shiva,           description: 'महादेव, संहारकर्ता' },
  { id: 'vishnu',        name: 'Vishnu',        nameHindi: 'विष्णु',     displayName: 'भगवान विष्णु',      initial: 'वि', color: deityColors.vishnu,          description: 'पालनहार, जगत के रक्षक' },
  { id: 'hanuman',       name: 'Hanuman',       nameHindi: 'हनुमान',     displayName: 'श्री हनुमान जी',    initial: 'ह',  color: deityColors.hanuman,         description: 'बजरंगबली, राम भक्त' },
  { id: 'lakshmi',       name: 'Lakshmi',       nameHindi: 'लक्ष्मी',    displayName: 'माँ लक्ष्मी',       initial: 'ल',  color: deityColors.lakshmi,         description: 'धन और समृद्धि की देवी' },
  { id: 'krishna',       name: 'Krishna',       nameHindi: 'कृष्ण',      displayName: 'श्री कृष्ण जी',     initial: 'कृ', color: deityColors.krishna,         description: 'गोविन्द, गीता उपदेशक' },
  { id: 'rama',          name: 'Rama',          nameHindi: 'राम',        displayName: 'श्री राम जी',       initial: 'रा', color: deityColors.rama,            description: 'मर्यादा पुरुषोत्तम' },
  { id: 'durga',         name: 'Durga',         nameHindi: 'दुर्गा',     displayName: 'माँ दुर्गा',        initial: 'दु', color: deityColors.durga,           description: 'शक्ति स्वरूपा, महिषासुरमर्दिनी' },
  { id: 'saraswati',     name: 'Saraswati',     nameHindi: 'सरस्वती',    displayName: 'माँ सरस्वती',       initial: 'स',  color: deityColors.saraswati,       description: 'विद्या और कला की देवी' },
  { id: 'parvati',       name: 'Parvati',       nameHindi: 'पार्वती',    displayName: 'माँ पार्वती',       initial: 'पा', color: deityColors.parvati,         description: 'शिव अर्धांगिनी, जगदम्बा' },
  { id: 'kali',          name: 'Kali',          nameHindi: 'काली',       displayName: 'माँ काली',          initial: 'का', color: deityColors.kali,            description: 'महाकाली, भयहारिणी' },
  { id: 'surya',         name: 'Surya',         nameHindi: 'सूर्य',      displayName: 'सूर्य देव',         initial: 'सू', color: deityColors.surya,           description: 'सूर्य देव, प्रकाश दाता' },
  { id: 'brahma',        name: 'Brahma',        nameHindi: 'ब्रह्मा',    displayName: 'भगवान ब्रह्मा',     initial: 'ब्र', color: deityColors.brahma,          description: 'सृष्टिकर्ता, चतुर्मुख' },
  { id: 'sai-baba',      name: 'Sai Baba',      nameHindi: 'साईं बाबा',  displayName: 'श्री साईं बाबा',    initial: 'सा', color: deityColors['sai-baba'],     description: 'शिर्डी वाले, सबका मालिक एक' },
  { id: 'santoshi-mata', name: 'Santoshi Mata', nameHindi: 'संतोषी माता', displayName: 'संतोषी माता',       initial: 'सं', color: deityColors['santoshi-mata'], description: 'संतोष और सुख की देवी' },
  { id: 'sita',          name: 'Sita',          nameHindi: 'सीता',       displayName: 'माता सीता जी',      initial: 'सी', color: deityColors.sita,            description: 'जानकी, राम अर्धांगिनी' },
  { id: 'khatu-shyam',   name: 'Khatu Shyam',   nameHindi: 'खाटू श्याम', displayName: 'श्री खाटू श्याम जी', initial: 'खा', color: deityColors['khatu-shyam'],  description: 'बर्बरीक, हारे का सहारा' },
  { id: 'vaishno-devi',  name: 'Vaishno Devi',  nameHindi: 'वैष्णो देवी', displayName: 'माँ वैष्णो देवी',   initial: 'वै', color: deityColors['vaishno-devi'], description: 'त्रिकूट पर्वत वासिनी, जगजननी' },
  { id: 'narasimha',     name: 'Narasimha',     nameHindi: 'नरसिंह',     displayName: 'भगवान नरसिंह',      initial: 'नर', color: deityColors.narasimha,       description: 'प्रह्लाद रक्षक, उग्र अवतार' },
];

export const DEITY_BY_ID = Object.fromEntries(ALL_DEITIES.map(d => [d.id, d])) as Record<string, DeityMeta>;
