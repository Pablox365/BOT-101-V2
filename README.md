# Volta

La pantalla de un Tesla, pero para tu bici. Pon el iPhone en horizontal en el soporte del manillar y tendrás:

- **Velocidad** en grande (GPS).
- **Selector P · R · N · D**: detecta si vas hacia delante, hacia atrás o estás parado.
- **Intermitentes automáticos**: el giroscopio detecta en tiempo real cuándo giras y se encienden en la pantalla y en la bici 3D.
- **Vista 3D estilo Tesla**: tu bici vista desde detrás, con la carretera que avanza y se curva contigo, y las **personas, coches, bicis y motos** que ve la cámara dibujados en 3D a su distancia (en naranja si están cerca).
- **Mapa 3D de Apple Maps** que sigue a la bici, girado hacia donde vas, con el recorrido dibujado. Botón para cambiar a vista satélite 3D.
- **Modo demo** para probarlo todo desde el sofá.
- Modo claro y oscuro automático, y la pantalla no se apaga.

## Probarlo en tu iPhone (sin Mac)

1. Instala **Expo Go** desde la App Store.
2. En el ordenador (Windows, Mac o Linux), con [Node.js](https://nodejs.org) instalado:
   ```bash
   npm install
   npx expo start
   ```
3. Escanea el código QR con la cámara del iPhone y se abre en Expo Go.
   (Si el móvil y el ordenador no están en la misma Wi-Fi: `npx expo start --tunnel`.)
4. Acepta los permisos de ubicación y movimiento. Para la cámara, pulsa **Cámara** abajo a la derecha.

Pulsa **Demo** para ver una ruta simulada con giros, una parada, marcha atrás y tráfico alrededor.

## Cómo funciona

| Función | Sensor | Detalle |
| --- | --- | --- |
| Velocidad | GPS | Se actualiza cada ~0,5 s. A menos de 2 km/h el GPS es poco preciso. |
| Intermitentes | Giroscopio | Mide el giro alrededor del eje vertical (proyectando el giro sobre la gravedad), así que da igual cómo esté montado el móvil. Solo se activa a más de ~4 km/h. `src/logic/turnDetector.ts` |
| Marcha atrás | GPS + brújula | Compara hacia dónde te mueves con hacia dónde apunta el móvil. Los primeros ~10 s rodando hacia delante a más de 7 km/h aprende cómo está montado el móvil; a partir de ahí, si te mueves en sentido contrario, marca **R**. `src/logic/gearDetector.ts` |
| Objetos 3D | Cámara + IA | TensorFlow.js con el modelo COCO-SSD dentro de un WebView. La distancia se estima por el tamaño del objeto en la imagen (el iPhone 16 no tiene LiDAR), así que es aproximada. `src/vision/visionHtml.ts` |
| Mapa | Apple Maps | `react-native-maps` con cámara inclinada y edificios 3D. |

La detección descarga el modelo de internet la primera vez (unos 5 MB), así que necesitas datos móviles o Wi-Fi.

## Limitaciones honestas

- La cámara solo ve **hacia delante**; el Tesla tiene 8 cámaras alrededor.
- Cámara + IA + GPS + 3D gastan bastante batería y calientan el móvil al sol. Lleva una batería externa en rutas largas y apaga la cámara si no la necesitas.
- El intermitente se enciende **cuando ya estás girando** (no lo puedes poner antes, como en un coche) y es para ti: la pantalla no la ven los demás.
- Mira la carretera, no la pantalla.

## Desarrollo

```bash
npm test          # tests de la lógica (giros, marchas, seguimiento de objetos)
npm run typecheck
npm run lint
```

Estructura:

```
App.tsx                    pantalla principal (escena 3D + mapa)
src/logic/                 lógica pura y testeada: giros, marchas, tracker, geometría
src/ride/                  hook que junta GPS, brújula y giroscopio (y el modo demo)
src/scene/                 escena three.js: bici, carretera y figuras 3D
src/components/            Scene3D (expo-gl), Hud, MapPanel, VisionCamera
src/vision/visionHtml.ts   página del WebView con la cámara y TensorFlow.js
```

Todo funciona en **Expo Go**, sin necesidad de compilar la app. Más adelante, para mejor rendimiento de la IA (modelo nativo con la Neural Engine), se puede pasar a un *development build* con EAS.
