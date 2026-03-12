Hacking Terminal – Foundry VTT Module

Una terminal de hacking interactiva y sincronizada para partidas de rol en Foundry VTT.
Permite crear escenas de infiltración donde un jugador intenta acceder a un sistema mientras todos los participantes ven la terminal en tiempo real.

Diseñado para momentos cinematográficos en partidas de ciencia ficción, cyberpunk o espionaje.

Características

Terminal estilo retro / hacking

Sincronización en tiempo real entre GM y jugadores

El GM configura el sistema

El jugador autorizado introduce usuario y contraseña

Todos los jugadores ven lo que se escribe en directo

Sistema de intentos limitados

Bloqueo del sistema al superar intentos

Efectos de sonido integrados

Interfaz estilo consola con feedback visual

Cómo funciona
- El GM abre la terminal

Desde el botón del menú izquierdo en los controles de Token.

- Configura el sistema

El GM introduce:

Usuario correcto

Contraseña correcta

Número máximo de intentos

Jugador autorizado a escribir en la terminal

- Lanza la terminal

Al pulsar Launch Terminal:

La terminal se abre para todos

Todos ven la misma pantalla

El jugador autorizado puede escribir

-  Intento de acceso

El jugador introduce:

usuario
contraseña

El sistema verifica y muestra:

acceso concedido

acceso denegado

intentos restantes

Sincronización

El módulo utiliza socket communication de Foundry para que:

todos los jugadores vean la misma terminal

el GM vea todo lo que escribe el jugador

el estado del sistema sea compartido

Ejemplo de escena
ACCESO RESTRINGIDO – AUTENTICACIÓN REQUERIDA

Intentos disponibles: 3

> USUARIO: root
> CONTRASEÑA: ********

[SISTEMA] Verificando credenciales...

X ACCESO DENEGADO X

[ADVERTENCIA] Intentos restantes: 2
Instalación
Instalación por Manifest

En Foundry:

Setup → Add-on Modules → Install Module

Pega la URL del manifest:

MANIFEST_URL_AQUI
Estructura del módulo
hacking-terminal/
│
├─ module.json
├─ README.md
│
├─ scripts/
│   ├─ main.mjs
│   ├─ hacking-terminal.mjs
│   └─ sound-engine.mjs
│
├─ styles/
│   └─ terminal.css
│
├─ templates/
│   └─ terminal.hbs
│
└─ sounds/
Requisitos

Foundry VTT v13 o superior

Sistema compatible con módulos ES

Uso recomendado

Este módulo funciona especialmente bien para:

Starfinder

Cyberpunk

Shadowrun

Sci-Fi

Operaciones de infiltración

Créditos

Desarrollado por:

Jonnhy Garcia

Licencia

MIT License

Futuras mejoras

Minijuego de hacking tipo Fallout

Terminales con archivos y comandos

Sistemas con varios niveles de seguridad

Eventos narrativos desbloqueables