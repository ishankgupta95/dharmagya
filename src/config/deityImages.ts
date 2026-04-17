import { ImageSourcePropType } from 'react-native';

import type { Deity } from 'hindu-devotional-texts';

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

export function getDeityImage(deity: string): ImageSourcePropType | null {
  return images[deity as Deity] ?? null;
}
