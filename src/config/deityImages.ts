import { ImageSourcePropType } from 'react-native';

/**
 * Static image map for deity portraits.
 * Metro bundler requires literal `require()` calls — no dynamic paths.
 *
 * Drop 400×400 .jpg portraits into assets/images/deities/
 * named exactly as shown below, then uncomment the require line.
 */

const images: Record<string, ImageSourcePropType> = {
  Ganesh:           require('../../assets/images/deities/ganesh.jpg'),
  Shiva:            require('../../assets/images/deities/shiva.jpg'),
  Vishnu:           require('../../assets/images/deities/vishnu.jpg'),
  Hanuman:          require('../../assets/images/deities/hanuman.jpg'),
  Lakshmi:          require('../../assets/images/deities/lakshmi.jpg'),
  Krishna:          require('../../assets/images/deities/krishna.jpg'),
  Rama:             require('../../assets/images/deities/rama.jpg'),
  Durga:            require('../../assets/images/deities/durga.jpg'),
  Saraswati:        require('../../assets/images/deities/saraswati.jpg'),
  Parvati:          require('../../assets/images/deities/parvati.jpg'),
  Kali:             require('../../assets/images/deities/kali.jpg'),
  Surya:            require('../../assets/images/deities/surya.jpg'),
  Kartikeya:        require('../../assets/images/deities/kartikeya.jpg'),
  Brahma:           require('../../assets/images/deities/brahma.jpg'),
  'Sai Baba':       require('../../assets/images/deities/sai-baba.jpg'),
  Jagannath:        require('../../assets/images/deities/jagannath.jpg'),
  'Santoshi Mata':  require('../../assets/images/deities/santoshi-mata.jpg'),
  Radha:            require('../../assets/images/deities/radha.jpg'),
};

export function getDeityImage(deityName: string): ImageSourcePropType | null {
  return images[deityName] ?? null;
}
