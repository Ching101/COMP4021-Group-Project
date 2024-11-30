# Arena Warriors

A multiplayer 2D arena battle game where 2-4 players compete in intense combat using various weapons and power-ups.

## Installation & Setup

1. Clone the repository

```bash
git clone https://github.com/Ching101/COMP4021-Group-Project.git
cd COMP4021-Group-Project
```

2. Install dependencies

```bash
npm install
```

3. Start the server

```bash
npm start
```

4. Open your browser and navigate to `http://localhost:8000`

## Features

### Authentication & Lobby

- Account creation with secure password requirements
- Login system
- Lobby system supporting up to 4 players
- Room-based matchmaking
- Player statistics display (wins/losses)

### Gameplay

- 2D arena-style combat
- Real-time multiplayer battles
- Health system (100 HP)
- Basic Controls:
  - WASD for movement
  - Mouse for attacking
  - Spacebar for jumping

### Weapons

Players can collect and use various weapons that spawn randomly:

- **Daggers**: Fast attacks, throwable, low damage
- **Sword**: Balanced weapon with medium damage/speed
- **Bow**: Long-range weapon with charge-up mechanic

### Power-ups

Random power-up spawns enhance gameplay:

- Health Potions (+20 HP)
- Attack Boost (2x damage, 10s duration)
- Speed Boost (1.5x speed, 8s duration)

### Match System

- 3-minute match duration
- Victory conditions:
  - Last player standing
  - Highest HP when time expires
- Post-match statistics including damage dealt and power-ups collected

### Developer Tools

Press `~` to access the developer panel with features:

- Speed Boost
- Power Up (2x damage)
