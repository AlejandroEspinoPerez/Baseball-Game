# ⚾ Jonrón Park — pelota arcade 3D

Juego de pelota (béisbol) en 3D que se juega en el navegador, en PC o en el móvil.
Usa el mismo estilo que [Remate Park](https://github.com/AlejandroEspinoPerez/Volleyball): personajes chibi con contorno, materiales toon y estadios hechos con primitivas de three.js.

**Jugar:** https://alejandroespinoperez.github.io/Baseball-Game/

## Modos

- **Partido contra la PC**: 1, 2, 3 o 5 entradas, tres dificultades y cuatro estadios (Parque, Playa, Ciudad al atardecer y Estadio de noche).
- **Derby de jonrones**: batea hasta fallar 10 veces y bate tu récord.
- **Personalizar jugador**: piel, peinado, accesorios, color del bate y del guante, y celebración. Se desbloquean más opciones al subir de nivel.

## Controles

| | PC | Móvil |
|---|---|---|
| Apuntar el batazo | Ratón | Joystick |
| Batear / batazo de poder / toque | Clic izq / Espacio / E | BATEAR / PODER / TOQUE |
| Lanzar recta / curva / cambio | Clic izq / Clic der / E | RECTA / CURVA / CAMBIO |
| Mover al defensor | WASD | Joystick |
| Tirar a una base | Apuntar con el ratón + clic, o 1 2 3 4 | Inclinar el joystick hacia la base + LANZAR |
| Saltar / lanzarse en plancha | Espacio / Clic der | SALTO / PLANCHA |
| Corredores: avanzar / volver | Clic o Espacio / E o Clic der | CORRER / VOLVER |
| Pausa · pantalla completa · sonido | Esc · F · M | Botones ⛶ y II |

Si no mueves a tu defensor, corre solo hacia la pelota.

## Archivos

- `index.html`: pantallas, HUD y estilos.
- `game.js`: todo el juego (render, personajes, física, reglas, IA, controles y sonido sintetizado). Usa three.js desde jsDelivr; no hay que instalar nada.

Para probarlo en local hace falta un servidor (los módulos ES no cargan con `file://`), por ejemplo:

```bash
npx http-server .
```
