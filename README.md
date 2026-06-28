# 🎴 PokéRun Builder

PokéRun Builder is a modern team-building tool for **PokéRun**, designed to help players create, analyze and optimize their teams through an intuitive interface.

The application supports both official Pokémon and custom Fakemon, providing real-time team analysis, type coverage visualization and multilingual support.

---

## ✨ Features

### Team Builder

* Build teams of up to 6 Pokémon.
* Search Pokémon by name.
* Drag & drop to reorder team members.
* Save teams locally.
* Duplicate or remove Pokémon from the team.

### Fakemon Support

* Create fully custom Fakemon.
* Upload custom sprites.
* Customize:

  * Name
  * Types
  * Stats
  * Ability
  * Moves
* Live sprite preview.
* Sprite editor with crop/zoom controls.
* Custom sprites are displayed throughout the application.

### Move Search

* Search moves in **English** or **Spanish**.
* Autocomplete suggestions.
* Automatic localization based on the selected language.

Example:

* Flamethrower
* Lanzallamas

Both return the same move.

### Team Analysis

Real-time analysis including:

* Offensive type coverage.
* Defensive weaknesses.
* Defensive resistances.
* Immunities.
* Role analysis.
* Team weaknesses overview.

### Multilanguage

* 🇬🇧 English
* 🇪🇸 Spanish

The interface automatically updates all supported texts and move names.

---

## 🚀 Technologies

* Next.js (App Router)
* React
* TypeScript
* Tailwind CSS
* GraphQL
* PokéAPI

---

## 📦 Installation

Clone the repository:

```bash
git clone <repository-url>
cd pokerun-builder
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 📂 Project Structure

```text
app/
components/
public/
```

The main application logic lives in:

```text
app/page.tsx
```

---

## 🎨 Future Improvements

Some planned features include:

* Team import/export.
* Share teams via URL.
* Smart team recommendations.
* Team comparison.
* Improved Fakemon sprite editor.
* Additional analysis tools.

---

## 🤝 Contributing

Contributions, suggestions and bug reports are always welcome.

Feel free to open an issue or submit a pull request.

---

## 📄 License

This project is licensed under the MIT License.
