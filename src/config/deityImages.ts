import { ImageSourcePropType } from 'react-native';

import type { Deity } from 'hindu-devotional-texts';

// Full-resolution portraits (704×384 where available) — used only for the
// god-detail hero, where the image fills the screen width.
const images: Partial<Record<Deity, ImageSourcePropType>> = {
  ganesha:          require('../../assets/images/deities/ganesha.webp'),
  shiva:            require('../../assets/images/deities/shiva.webp'),
  vishnu:           require('../../assets/images/deities/vishnu.webp'),
  hanuman:          require('../../assets/images/deities/hanuman.webp'),
  lakshmi:          require('../../assets/images/deities/lakshmi.webp'),
  krishna:          require('../../assets/images/deities/krishna.webp'),
  rama:             require('../../assets/images/deities/rama.webp'),
  durga:            require('../../assets/images/deities/durga.webp'),
  saraswati:        require('../../assets/images/deities/saraswati.webp'),
  parvati:          require('../../assets/images/deities/parvati.webp'),
  kali:             require('../../assets/images/deities/kali.webp'),
  surya:            require('../../assets/images/deities/surya.webp'),
  brahma:           require('../../assets/images/deities/brahma.webp'),
  'sai-baba':       require('../../assets/images/deities/sai-baba.webp'),
  'santoshi-mata':  require('../../assets/images/deities/santoshi-mata.webp'),
  sita:             require('../../assets/images/deities/sita.webp'),
  'khatu-shyam':    require('../../assets/images/deities/khatu-shyam.webp'),
  'vaishno-devi':   require('../../assets/images/deities/vaishno-devi.webp'),
  narasimha:        require('../../assets/images/deities/narasimha.webp'),
};

// Right-sized portraits (≤512px wide) for grid cards + avatars. ~1.9× fewer
// pixels to decode than the full-res source, which matters on low-end devices
// where the deity grid + Home "Your Deities" strip render many at once.
const imagesSmall: Partial<Record<Deity, ImageSourcePropType>> = {
  ganesha:          require('../../assets/images/deities/ganesha@small.webp'),
  shiva:            require('../../assets/images/deities/shiva@small.webp'),
  vishnu:           require('../../assets/images/deities/vishnu@small.webp'),
  hanuman:          require('../../assets/images/deities/hanuman@small.webp'),
  lakshmi:          require('../../assets/images/deities/lakshmi@small.webp'),
  krishna:          require('../../assets/images/deities/krishna@small.webp'),
  rama:             require('../../assets/images/deities/rama@small.webp'),
  durga:            require('../../assets/images/deities/durga@small.webp'),
  saraswati:        require('../../assets/images/deities/saraswati@small.webp'),
  parvati:          require('../../assets/images/deities/parvati@small.webp'),
  kali:             require('../../assets/images/deities/kali@small.webp'),
  surya:            require('../../assets/images/deities/surya@small.webp'),
  brahma:           require('../../assets/images/deities/brahma@small.webp'),
  'sai-baba':       require('../../assets/images/deities/sai-baba@small.webp'),
  'santoshi-mata':  require('../../assets/images/deities/santoshi-mata@small.webp'),
  sita:             require('../../assets/images/deities/sita@small.webp'),
  'khatu-shyam':    require('../../assets/images/deities/khatu-shyam@small.webp'),
  'vaishno-devi':   require('../../assets/images/deities/vaishno-devi@small.webp'),
  narasimha:        require('../../assets/images/deities/narasimha@small.webp'),
};

/** Full-resolution portrait — use only for the full-width god-detail hero. */
export function getDeityImage(deity: string): ImageSourcePropType | null {
  return images[deity as Deity] ?? null;
}

/** Right-sized portrait for grid cards + avatars. Falls back to full-res. */
export function getDeityImageSmall(deity: string): ImageSourcePropType | null {
  return imagesSmall[deity as Deity] ?? images[deity as Deity] ?? null;
}
