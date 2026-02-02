# ToDo List App - Requirements Definition

## 1. App Overview

### App Name
ToDo List App

### Purpose
Enable simple ToDo list management, time measurement, and memo recording quickly on a web browser.

### Target Users
- General users who want simple task management
- Beginner developers learning HTML / CSS / JavaScript

## 2. Functional Requirements

### Required Features

#### 2.1 ToDo List
- Add tasks
- Delete tasks
- Display tasks in a list
- Content resets on page reload (temporary storage)

#### 2.2 Timer
- Start timer
- Stop timer
- Display elapsed time on screen
- Measure time in seconds

#### 2.3 Memo
- Free text input
- Display memo content on screen
- Content resets on page reload

---

### Optional Features (if time permits)
- Task completion checkbox
- Timer reset
- Simple memo persistence (localStorage)

## 3. Non-Functional Requirements

### Performance
- Screen updates immediately after button press
- No unnecessary page reloads

### Usability
- Simple, intuitive screen layout
- Clear labels for buttons and inputs

### Maintainability
- Simple, readable JavaScript
- Meaningful variable and function names
- Structure understandable by beginners
- Avoid putting all logic in a single file

---

## 4. Screen Layout (UI)

- Single-page layout
- Minimize scrolling

---

## 5. Data

### ToDo Data
- Task content (string)
- Managed temporarily in a JavaScript array

### Timer Data
- Start time
- Elapsed time (seconds)

### Memo Data
- Memo content (string)
- Display only (no persistence)

All data is temporary.

---

## 6. Constraints

- Technology: HTML, CSS, JavaScript only
- No frameworks or libraries
- No server communication
- Target: Web browser (e.g. Google Chrome)

---

## 7. Out of Scope

- User authentication
- Database storage
- Multi-device sync
- Advanced animations
- Mobile-specific UI optimization
