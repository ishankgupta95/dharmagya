import { ImageSourcePropType } from 'react-native';

/**
 * Static image map for deity portraits.
 * Metro bundler requires literal `require()` calls — no dynamic paths.
 *
 * Drop 400×400 .jpg portraits into assets/images/deities/
 * named exactly as shown below, then uncomment the require line.
 */

const images: Record<string, ImageSourcePropType> = {
  Ganesh:           require('../../assets/images/deities/ganesh.webp'),
  Shiva:            require('../../assets/images/deities/shiva.webp'),
  Vishnu:           require('../../assets/images/deities/vishnu.webp'),
  Hanuman:          require('../../assets/images/deities/hanuman.webp'),
  Lakshmi:          require('../../assets/images/deities/lakshmi.webp'),
  Krishna:          require('../../assets/images/deities/krishna.webp'),
  Rama:             require('../../assets/images/deities/rama.webp'),
  Durga:            require('../../assets/images/deities/durga.webp'),
  Saraswati:        require('../../assets/images/deities/saraswati.webp'),
  Parvati:          require('../../assets/images/deities/parvati.webp'),
  Kali:             require('../../assets/images/deities/kali.webp'),
  Surya:            require('../../assets/images/deities/surya.webp'),
  Kartikeya:        require('../../assets/images/deities/kartikeya.webp'),
  Brahma:           require('../../assets/images/deities/brahma.webp'),
  'Sai Baba':       require('../../assets/images/deities/sai-baba.webp'),
  Jagannath:        require('../../assets/images/deities/jagannath.webp'),
  'Santoshi Mata':  require('../../assets/images/deities/santoshi-mata.webp'),
  Radha:            require('../../assets/images/deities/radha.webp'),
  Sita:             require('../../assets/images/deities/sita.webp'),
  Venkateswara:     require('../../assets/images/deities/venkateswara.webp'),
  'Khatu Shyam':    require('../../assets/images/deities/khatu-shyam.webp'),
  Ayyappa:          require('../../assets/images/deities/ayyappa.webp'),
  'Vaishno Devi':   require('../../assets/images/deities/vaishno-devi.webp'),
  Narasimha:        require('../../assets/images/deities/narasimha.webp'),
  Dattatreya:       require('../../assets/images/deities/dattatreya.webp'),
  Ganga:            require('../../assets/images/deities/ganga.webp'),
};

export function getDeityImage(deityName: string): ImageSourcePropType | null {
  return images[deityName] ?? null;
}
