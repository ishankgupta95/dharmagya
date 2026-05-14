import type { Deity } from 'hindu-devotional-texts';

/**
 * Maps a festival's canonical (English) name — as stored in
 * `data/static/festivals.json` — to a deity in the app's roster, so a
 * "Share greeting" card can carry that deity's portrait + accent colour.
 *
 * Only the deities present in `src/config/deities.ts` are valid targets (the
 * no-new-deities roster constraint, §4). Festivals with no obvious single
 * deity (Sankranti variants beyond Surya, eclipses, generic Purnima/Amavasya)
 * are intentionally absent — those cards fall back to a yantra mark.
 *
 * Matching is case-insensitive substring: the festival name "Diwali / Deepavali"
 * matches the `diwali` key. Keep keys lower-case and distinctive.
 */
const FESTIVAL_DEITY: Record<string, Deity> = {
  diwali: 'lakshmi',
  deepavali: 'lakshmi',
  'lakshmi puja': 'lakshmi',
  'sharad purnima': 'lakshmi',
  dhanteras: 'lakshmi',
  holi: 'krishna',
  'holika': 'krishna',
  janmashtami: 'krishna',
  'krishna janmashtami': 'krishna',
  gokulashtami: 'krishna',
  radhashtami: 'krishna',
  govardhan: 'krishna',
  'ganesh chaturthi': 'ganesha',
  'ganesha chaturthi': 'ganesha',
  'vinayaka chaturthi': 'ganesha',
  'angarki': 'ganesha',
  'maha shivaratri': 'shiva',
  'mahashivratri': 'shiva',
  shivratri: 'shiva',
  pradosh: 'shiva',
  'shravan': 'shiva',
  'sawan somwar': 'shiva',
  'nag panchami': 'shiva',
  navratri: 'durga',
  navaratri: 'durga',
  'durga puja': 'durga',
  'durga ashtami': 'durga',
  dussehra: 'durga',
  vijayadashami: 'durga',
  'gupt navratri': 'durga',
  'ram navami': 'rama',
  ramnavami: 'rama',
  'rama navami': 'rama',
  'hanuman jayanti': 'hanuman',
  'hanuman janmotsav': 'hanuman',
  'bada mangal': 'hanuman',
  'saraswati puja': 'saraswati',
  'vasant panchami': 'saraswati',
  'basant panchami': 'saraswati',
  'sri panchami': 'saraswati',
  'makar sankranti': 'surya',
  'ratha saptami': 'surya',
  'chhath': 'surya',
  'chhath puja': 'surya',
  'samba dashami': 'surya',
  'sita navami': 'sita',
  'janaki navami': 'sita',
  'narasimha jayanti': 'narasimha',
  'narsimha jayanti': 'narasimha',
  'akshaya tritiya': 'vishnu',
  'vaikuntha ekadashi': 'vishnu',
  'devshayani ekadashi': 'vishnu',
  'devutthana ekadashi': 'vishnu',
  'prabodhini ekadashi': 'vishnu',
  'vamana jayanti': 'vishnu',
  'anant chaturdashi': 'vishnu',
  'guru purnima': 'vishnu',
  'parvati': 'parvati',
  'hartalika teej': 'parvati',
  'hariyali teej': 'parvati',
  'gangaur': 'parvati',
  'kali puja': 'kali',
  'syamaa': 'kali',
  'sai baba': 'sai-baba',
  'shirdi sai': 'sai-baba',
  'guru poornima': 'sai-baba',
  'santoshi': 'santoshi-mata',
  'khatu shyam': 'khatu-shyam',
  'phalguna mela': 'khatu-shyam',
  'vaishno devi': 'vaishno-devi',
  'navreh': 'vaishno-devi',
  'brahma': 'brahma',
};

/** Best-effort deity slug for a festival's English name, or null. */
export function getFestivalDeity(name: string): Deity | null {
  const n = name.toLowerCase();
  for (const key in FESTIVAL_DEITY) {
    if (n.includes(key)) return FESTIVAL_DEITY[key];
  }
  return null;
}
