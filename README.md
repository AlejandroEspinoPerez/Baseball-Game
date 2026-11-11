# ⚾ Jonrón Park — pelota arcade 3D

Juego de pelota (béisbol) en 3D que se juega en el navegador, en PC o en el móvil.
Usa el mismo estilo que [Remate Park](https://github.com/AlejandroEspinoPerez/Volleyball): personajes chibi con contorno, materiales toon y estadios hechos con primitivas de three.js.

**Jugar:** https://alejandroespinoperez.github.io/Baseball-Game/

## Modos

- **Partido contra la PC**: eliges tu equipo y el rival entre 9 equipos (cada uno con su estilo y sus atributos), 1, 2, 3 o 5 entradas, tres dificultades y cuatro estadios (Parque, Playa, Ciudad al atardecer y Estadio de noche).
- **🏆 Copa**: ocho equipos, eliminación directa (cuartos, semifinal y final). Los demás cruces se simulan según la media de cada equipo.
- **En línea (1 contra 1)**: 🌐 Crear sala y compartir el código, el link o el QR; tu amigo entra con 🔗 Unirme y cada uno elige su equipo en la sala. Si nadie entra, o alguien se desconecta, juega la PC; si vuelve a entrar (aunque sea por el relevo), recupera su equipo en el mismo partido.
- **Derby de jonrones**: batea hasta fallar 10 veces y bate tu récord.
- **📘 Tutorial**: cinco lecciones que se completan jugando (batear, modo poder, lanzar con el aro, tirar a una base y robar).
- **🎯 Retos y logros**: 3 retos diarios con XP y 16 logros.
- **Personalizar jugador**: piel, peinado, accesorios, color del bate y del guante, y celebración. Se desbloquean más opciones al subir de nivel.

## Más cosas

- **Equipos con atributos**: poder, contacto, velocidad, defensa y brazo para los bateadores; velocidad, control y resistencia para los lanzadores. Tu jugador es el capitán del equipo.
- **Cansancio y relevos**: el lanzador se cansa con cada lanzamiento (más lento y menos preciso). Cada equipo tiene dos relevistas; pides el cambio con el botón 🔄 Relevo o la tecla R.
- **Repeticiones** a cámara lenta de jonrones, triples, dobles plays, outs en home y atrapadas en plancha (toca para saltarlas).
- **Ambiente de estadio**: público que reacciona a cada jugada, aplausos, abucheos y un narrador con la voz del navegador (se pueden quitar en la pausa).

## Cómo se juega

- **Al bate (con cursor)**: mueve el círculo del bate hasta donde va a pasar la pelota y batea justo cuando llega. Si la pelota pasa por arriba del centro del círculo sale elevada; por abajo, rola. Adelantado va hacia la izquierda y tarde hacia la derecha. **PODER** achica el círculo y pega más fuerte. También hay bateo **simple** (solo cuenta el momento).
- **Lanzando**: apunta en la zona, elige recta, curva, slider o cambio y suelta cuando el aro se cierre en el círculo verde. Cuanto más justo, más preciso y rápido.
- **Defendiendo**: controlas al jugador más cerca de la pelota (si no lo mueves, corre solo). Con el **rombo de bases** eliges a qué base tirar, incluso antes de atrapar. Los tiros pueden ser manuales o automáticos.
- **Corriendo**: CORRER / VOLVER mueven a todos; tocando una base del rombo mandas o regresas a un solo corredor. Antes del lanzamiento puedes **robar base**.

## Controles

| | PC | Móvil |
|---|---|---|
| Círculo del bate / apuntar lanzamiento | Ratón | Joystick |
| Batear · modo poder · toque | Clic izq · Espacio · E | BATEAR · PODER · TOQUE |
| Lanzar | 1-4 o clic der eligen lanzamiento; clic empieza y suelta el aro | RECTA / CURVA / SLIDER / CAMBIO (tocar otra vez para soltar) |
| Mover al defensor | WASD | Joystick |
| Tirar a una base | 1 2 3 4, rombo o apuntar con el ratón + clic | Rombo de bases |
| Saltar · lanzarse en plancha | Espacio · Clic der | SALTO · PLANCHA |
| Corredores | Clic / Espacio = todos corren · E = todos vuelven · 1-4 = uno | CORRER / VOLVER · rombo |
| Robar base | 2 3 4 o rombo antes del lanzamiento | Rombo antes del lanzamiento |
| Cambiar de lanzador | R o botón 🔄 Relevo | Botón 🔄 Relevo |
| Pausa · pantalla completa · sonido | Esc · F · M | Botones ⛶ y II |

## Archivos

- `index.html`: pantallas, HUD y estilos.
- `game.js`: todo el juego (render, personajes, física, reglas, IA, controles, modo en línea y sonido sintetizado). Usa three.js desde jsDelivr y PeerJS (con relevo MQTT de respaldo) para jugar en línea; no hay que instalar nada.

Para probarlo en local hace falta un servidor (los módulos ES no cargan con `file://`), por ejemplo:

```bash
npx http-server .
```

Con `?touch=1` en la URL se fuerza la interfaz táctil para probarla en el PC y con `?relevo=1` el modo en línea usa solo el relevo MQTT.
