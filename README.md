# 📡 Radio Orchestrator

**Radio Orchestrator** is a MakeCode extension for the BBC micro:bit that lets you build **coordinated radio networks** using three roles:

- **Master**
- **Controller**
- **Device**

The Master automatically pairs Controllers and Devices, monitors connectivity, recovers from disconnections, and can remotely **start** and **stop** all clients.

This extension is designed for:
- Classrooms
- Robotics projects
- Multi-micro:bit systems
- Reliable radio coordination

---

## ✨ Key Features

- 🔗 Automatic pairing of Controllers and Devices  
- 📡 Dedicated pairing and control channel  
- 💓 Heartbeat monitoring between peers  
- 🔁 Automatic recovery when devices disconnect  
- ▶️ Start / Stop commands sent by the Master  
- 🧠 Self-healing radio network  
- 🧩 Simple, beginner-friendly Blocks API  

---

## 🧠 System Overview

The system uses **radio groups** to separate responsibilities:

| Radio Group | Purpose |
|------------|--------|
| Group 1 | Pairing, control, recovery (Master channel) |
| Group ≥ 2 | Controller ↔ Device communication |

### Roles

#### 🟣 Master
- Manages pairing
- Assigns radio groups
- Detects lost devices
- Sends Start / Stop commands

#### 🔵 Controller
- Pairs with the Master
- Communicates with a Device
- Monitors peer availability

#### 🟢 Device
- Pairs with the Master
- Communicates with a Controller
- Responds to Start / Stop commands

---

## 🚀 Getting Started

### 1️⃣ Add the Extension
Add **Radio Orchestrator** to your MakeCode project using the **Extensions** menu.

---

### 2️⃣ Program the Master

```blocks
on start
  start radio orchestrator as Master

on button A pressed
  allow new devices to pair

on button B pressed
  start all clients

on logo pressed
  stop all clients
```

---

### 3️⃣ Program the Controller

```blocks
on start
  start radio orchestrator as Controller
```
---


### 4️⃣ Program the Device

```blocks
on start
  start radio orchestrator as Device
```